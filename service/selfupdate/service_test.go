package selfupdate

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ----------------------------------------------------------------------------
// Fake GitHub client
// ----------------------------------------------------------------------------

type fakeGitHubClient struct {
	release *ReleaseInfo
	err     error
}

func (f *fakeGitHubClient) FetchLatestRelease(_ context.Context, _ string) (*ReleaseInfo, error) {
	return f.release, f.err
}

func (f *fakeGitHubClient) Download(_ context.Context, _, _ string, _ int64) error {
	return nil
}

func (f *fakeGitHubClient) FetchBytes(_ context.Context, _ string, _ int64) ([]byte, error) {
	return nil, nil
}

// ----------------------------------------------------------------------------
// Fake Docker engine
// ----------------------------------------------------------------------------

type fakeDockerEngine struct {
	pingErr      error
	pullErr      error
	recreateErr  error
	inspectSelf  *ContainerInspect
	pullCalled   bool
	recreateCalled bool
}

func (f *fakeDockerEngine) Ping(_ context.Context) error { return f.pingErr }

func (f *fakeDockerEngine) InspectSelf(_ context.Context) (*ContainerInspect, error) {
	if f.inspectSelf != nil {
		return f.inspectSelf, nil
	}
	return &ContainerInspect{ID: "ctr123", Name: "/test"}, nil
}

func (f *fakeDockerEngine) PullImage(_ context.Context, _ string) error {
	f.pullCalled = true
	return f.pullErr
}

func (f *fakeDockerEngine) RecreateSelf(_ context.Context, _ string) error {
	f.recreateCalled = true
	return f.recreateErr
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

func makeRelease(tag string, assets []Asset) *ReleaseInfo {
	return &ReleaseInfo{
		TagName: tag,
		Assets:  assets,
	}
}

func testConfig() Config {
	return Config{
		Enabled:     true,
		Repo:        "owner/repo",
		DockerHost:  "unix:///tmp/fake.sock",
		DockerImage: "myimage:latest",
		CacheTTL:    20 * time.Minute,
	}
}

// ----------------------------------------------------------------------------
// TestService_Check_Disabled
// ----------------------------------------------------------------------------

func TestService_Check_Disabled(t *testing.T) {
	cfg := testConfig()
	cfg.Enabled = false
	svc := newService(cfg, nil, nil, "v1.0.0")

	info, err := svc.Check(context.Background(), false)
	require.NoError(t, err)
	assert.False(t, info.Enabled)
	assert.Equal(t, "v1.0.0", info.CurrentVersion)
}

func TestService_Check_NoReleases_AlreadyUpToDate(t *testing.T) {
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	gh := &fakeGitHubClient{err: ErrNoReleases}
	svc := newService(testConfig(), gh, nil, "v1.0.0-rc.20-oneclick.1")

	info, err := svc.Check(context.Background(), true)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.True(t, info.Enabled)
	assert.False(t, info.HasUpdate)
	assert.Equal(t, "v1.0.0-rc.20-oneclick.1", info.CurrentVersion)
	assert.Equal(t, "v1.0.0-rc.20-oneclick.1", info.LatestVersion)
	assert.Equal(t, "owner/repo", info.UpdateSource)
	assert.Empty(t, info.Warning)
}

// ----------------------------------------------------------------------------
// TestService_Check_HasUpdate
// ----------------------------------------------------------------------------

func TestService_Check_HasUpdate(t *testing.T) {
	// Bust any stale global cache from other tests.
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	rel := makeRelease("v2.0.0", nil)
	gh := &fakeGitHubClient{release: rel}
	svc := newService(testConfig(), gh, nil, "v1.0.0")

	info, err := svc.Check(context.Background(), true)
	require.NoError(t, err)
	assert.True(t, info.HasUpdate)
	assert.Equal(t, "v2.0.0", info.LatestVersion)
	assert.Equal(t, "v1.0.0", info.CurrentVersion)
}

// ----------------------------------------------------------------------------
// TestService_Check_NoUpdate (same version)
// ----------------------------------------------------------------------------

func TestService_Check_NoUpdate(t *testing.T) {
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	rel := makeRelease("v1.0.0", nil)
	gh := &fakeGitHubClient{release: rel}
	svc := newService(testConfig(), gh, nil, "v1.0.0")

	info, err := svc.Check(context.Background(), true)
	require.NoError(t, err)
	assert.False(t, info.HasUpdate)
}

// ----------------------------------------------------------------------------
// TestService_Perform_Disabled
// ----------------------------------------------------------------------------

func TestService_Perform_Disabled(t *testing.T) {
	cfg := testConfig()
	cfg.Enabled = false
	svc := newService(cfg, nil, nil, "v1.0.0")

	_, err := svc.Perform(context.Background())
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrUpdateDisabled))
}

// ----------------------------------------------------------------------------
// TestService_Perform_AlreadyUpToDate
// ----------------------------------------------------------------------------

func TestService_Perform_AlreadyUpToDate(t *testing.T) {
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	rel := makeRelease("v1.0.0", nil)
	gh := &fakeGitHubClient{release: rel}
	svc := newService(testConfig(), gh, nil, "v1.0.0")

	result, err := svc.Perform(context.Background())
	require.NoError(t, err)
	assert.True(t, result.AlreadyUpToDate)
	assert.Equal(t, "v1.0.0", result.FromVersion)
}

// ----------------------------------------------------------------------------
// TestService_Perform_Lock
// ----------------------------------------------------------------------------

func TestService_Perform_Lock(t *testing.T) {
	// We manually acquire the internal lock, then verify that a second
	// Perform returns ErrUpdateInProgress.
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	rel := makeRelease("v1.0.0", nil)
	gh := &fakeGitHubClient{release: rel}
	svc := newService(testConfig(), gh, nil, "v1.0.0")

	// Hold the lock directly.
	svc.mu.Lock()
	svc.locked = true
	svc.mu.Unlock()

	_, err := svc.Perform(context.Background())
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrUpdateInProgress))

	// Release the lock so the service isn't left in a bad state.
	svc.mu.Lock()
	svc.locked = false
	svc.mu.Unlock()
}

// ----------------------------------------------------------------------------
// TestService_Perform_Lock_Concurrent
// ----------------------------------------------------------------------------

func TestService_Perform_Lock_Concurrent(t *testing.T) {
	// Use a fake GH that blocks until a gate is opened, so we can race two
	// goroutines and verify only one proceeds.
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	gate := make(chan struct{})
	blockingGH := &blockingGitHubClient{gate: gate, release: makeRelease("v1.0.0", nil)}
	svc := newService(testConfig(), blockingGH, nil, "v1.0.0")

	started := make(chan struct{})
	var wg sync.WaitGroup
	var firstErr, secondErr error

	wg.Add(1)
	go func() {
		defer wg.Done()
		close(started) // signal that goroutine has started
		_, firstErr = svc.Perform(context.Background())
	}()

	// Wait for the first goroutine to grab the lock (it blocks inside gh).
	<-started
	// Give it a moment to acquire the lock before we try to acquire it too.
	time.Sleep(20 * time.Millisecond)

	_, secondErr = svc.Perform(context.Background())
	assert.True(t, errors.Is(secondErr, ErrUpdateInProgress), "second Perform must return ErrUpdateInProgress")

	// Unblock the first goroutine.
	close(gate)
	wg.Wait()
	// The first goroutine may succeed or fail for other reasons; we only care
	// that second returned ErrUpdateInProgress.
	_ = firstErr
}

// blockingGitHubClient blocks FetchLatestRelease until gate is closed.
type blockingGitHubClient struct {
	gate    chan struct{}
	release *ReleaseInfo
}

func (b *blockingGitHubClient) FetchLatestRelease(ctx context.Context, _ string) (*ReleaseInfo, error) {
	select {
	case <-b.gate:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return b.release, nil
}

func (b *blockingGitHubClient) Download(_ context.Context, _, _ string, _ int64) error { return nil }
func (b *blockingGitHubClient) FetchBytes(_ context.Context, _ string, _ int64) ([]byte, error) {
	return nil, nil
}

// ----------------------------------------------------------------------------
// TestService_Perform_Docker_NoSocket
// ----------------------------------------------------------------------------

func TestService_Perform_Docker_NoSocket(t *testing.T) {
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	rel := makeRelease("v2.0.0", nil)
	gh := &fakeGitHubClient{release: rel}

	cfg := testConfig()
	t.Setenv("NEWAPI_DEPLOY_MODE", "docker")

	// Docker engine that reports socket unavailable (Ping fails).
	fakeDocker := &fakeDockerEngine{pingErr: errors.New("connection refused")}
	svc := newService(cfg, gh, fakeDocker, "v1.0.0")

	_, err := svc.Perform(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "connection refused")
}

// ----------------------------------------------------------------------------
// TestService_Perform_Docker_Success
// ----------------------------------------------------------------------------

func TestService_Perform_Docker_Success(t *testing.T) {
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	rel := makeRelease("v2.0.0", nil)
	gh := &fakeGitHubClient{release: rel}
	t.Setenv("NEWAPI_DEPLOY_MODE", "docker")

	fakeDocker := &fakeDockerEngine{}
	cfg := testConfig()
	svc := newService(cfg, gh, fakeDocker, "v1.0.0")

	result, err := svc.Perform(context.Background())
	require.NoError(t, err)
	assert.False(t, result.NeedRestart, "docker update does not require separate restart")
	assert.Equal(t, DeployModeDocker, result.DeployMode)
	assert.True(t, fakeDocker.pullCalled)
	assert.True(t, fakeDocker.recreateCalled)
}

// ----------------------------------------------------------------------------
// TestService_Status
// ----------------------------------------------------------------------------

func TestService_Status(t *testing.T) {
	svc := newService(testConfig(), nil, nil, "v1.0.0")
	st := svc.Status()
	assert.Equal(t, PhaseIdle, st.Phase)
	assert.False(t, st.Updating)
}

// ----------------------------------------------------------------------------
// TestService_Restart_DockerMode
// ----------------------------------------------------------------------------

func TestService_Restart_DockerMode(t *testing.T) {
	t.Setenv("NEWAPI_DEPLOY_MODE", "docker")
	svc := newService(testConfig(), nil, nil, "v1.0.0")
	err := svc.Restart(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "docker mode")
}

// ----------------------------------------------------------------------------
// TestService_Check_GHError soft-fails as already up to date
// ----------------------------------------------------------------------------

func TestService_Check_GHError(t *testing.T) {
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	gh := &fakeGitHubClient{err: errors.New("network error")}
	svc := newService(testConfig(), gh, nil, "v1.0.0")

	info, err := svc.Check(context.Background(), true)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.False(t, info.HasUpdate)
	assert.Equal(t, "v1.0.0", info.CurrentVersion)
	assert.Equal(t, "v1.0.0", info.LatestVersion)
	assert.Contains(t, info.Warning, "network error")
}

// ----------------------------------------------------------------------------
// TestService_Check_Cache returns cached result without calling GH
// ----------------------------------------------------------------------------

func TestService_Check_Cache(t *testing.T) {
	cachedInfo := &Info{
		Enabled:        true,
		HasUpdate:      false,
		CurrentVersion: "v1.0.0",
		LatestVersion:  "v1.0.0",
	}
	globalCache.set(cachedInfo)
	defer func() {
		globalCache.mu.Lock()
		globalCache.info = nil
		globalCache.mu.Unlock()
	}()

	gh := &fakeGitHubClient{err: errors.New("should not be called")}
	svc := newService(testConfig(), gh, nil, "v1.0.0")

	info, err := svc.Check(context.Background(), false)
	require.NoError(t, err)
	assert.True(t, info.Cached)
}

// ----------------------------------------------------------------------------
// TestErrSentinels
// ----------------------------------------------------------------------------

func TestErrSentinels(t *testing.T) {
	assert.Equal(t, "update already in progress", ErrUpdateInProgress.Error())
	assert.Equal(t, "self-update is disabled", ErrUpdateDisabled.Error())
	assert.Equal(t, "already up to date", ErrAlreadyUpToDate.Error())

	wrapped := errors.New("wrapped: " + ErrUpdateInProgress.Error())
	_ = wrapped // just compile-check the format
	assert.True(t, errors.Is(ErrUpdateInProgress, ErrUpdateInProgress))
}

// ----------------------------------------------------------------------------
// Compile-time sanity: verify Service has the expected method set
// ----------------------------------------------------------------------------

func TestService_MethodSet(_ *testing.T) {
	var svc *Service
	_ = func() {
		_, _ = svc.Check(context.Background(), false)
		_, _ = svc.Perform(context.Background())
		_ = svc.Status()
		_ = svc.Restart(context.Background())
	}
}

// ----------------------------------------------------------------------------
// TestDefault_IsSingleton
// ----------------------------------------------------------------------------

func TestDefault_IsSingleton(t *testing.T) {
	// Reset singleton for test isolation — only do this in test binaries.
	defaultOnce = sync.Once{}
	defaultService = nil

	a := Default()
	b := Default()
	assert.Same(t, a, b, "Default() must return the same pointer")
}

// httptest-based fake GH server for integration-like Check test.
func TestService_Check_WithHTTPGitHub(t *testing.T) {
	globalCache.mu.Lock()
	globalCache.info = nil
	globalCache.mu.Unlock()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":"v3.0.0","assets":[]}`))
	}))
	defer srv.Close()

	hClient := NewHTTPGitHubClient("", srv.Client())
	hClient.APIBase = srv.URL

	cfg := testConfig()
	svc := newService(cfg, hClient, nil, "v1.0.0")

	info, err := svc.Check(context.Background(), true)
	require.NoError(t, err)
	assert.Equal(t, "v3.0.0", info.LatestVersion)
	assert.True(t, info.HasUpdate)
}
