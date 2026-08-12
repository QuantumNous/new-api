package selfupdate

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"strings"
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

	downloadData  []byte
	checksumData  []byte
	downloadErr   error
	fetchBytesErr error
	downloadCalls int
	fetchCalls    int
}

func (f *fakeGitHubClient) FetchLatestRelease(_ context.Context, _ string) (*ReleaseInfo, error) {
	return f.release, f.err
}

func (f *fakeGitHubClient) Download(_ context.Context, _, destination string, _ int64) error {
	f.downloadCalls++
	if f.downloadErr != nil {
		return f.downloadErr
	}
	return os.WriteFile(destination, f.downloadData, 0o600)
}

func (f *fakeGitHubClient) FetchBytes(_ context.Context, _ string, _ int64) ([]byte, error) {
	f.fetchCalls++
	if f.fetchBytesErr != nil {
		return nil, f.fetchBytesErr
	}
	return append([]byte(nil), f.checksumData...), nil
}

// ----------------------------------------------------------------------------
// Fake Docker engine
// ----------------------------------------------------------------------------

type fakeDockerEngine struct {
	pingErr              error
	pullErr              error
	recreateErr          error
	recreateLocalErr     error
	buildErr             error
	inspectSelf          *ContainerInspect
	pullCalled           bool
	recreateCalled       bool
	recreateLocalCalled  bool
	buildCalled          bool
	buildTarget          string
	recreateImage        string
	recreateLocalImage   string
	recreateOptions      DockerRecreateOptions
	recreateLocalOptions DockerRecreateOptions
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

func (f *fakeDockerEngine) RecreateSelfWithOptions(ctx context.Context, image string, options DockerRecreateOptions) error {
	f.recreateImage = image
	f.recreateOptions = options
	return f.RecreateSelf(ctx, image)
}

func (f *fakeDockerEngine) BuildImageWithBinary(_ context.Context, _, _, targetImage string) error {
	f.buildCalled = true
	f.buildTarget = targetImage
	return f.buildErr
}

func (f *fakeDockerEngine) RecreateSelfLocal(_ context.Context, _ string) error {
	f.recreateLocalCalled = true
	return f.recreateLocalErr
}

func (f *fakeDockerEngine) RecreateSelfLocalWithOptions(ctx context.Context, image string, options DockerRecreateOptions) error {
	f.recreateLocalImage = image
	f.recreateLocalOptions = options
	return f.RecreateSelfLocal(ctx, image)
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

func resetGlobalCache(t *testing.T) {
	t.Helper()
	clear := func() {
		globalCache.mu.Lock()
		defer globalCache.mu.Unlock()
		globalCache.info = nil
		globalCache.release = nil
		globalCache.fetchedAt = time.Time{}
	}
	clear()
	t.Cleanup(clear)
}

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
	assert.False(t, fakeDocker.pullCalled, "RecreateSelf must own the single registry pull")
	assert.True(t, fakeDocker.recreateCalled)
	assert.False(t, fakeDocker.recreateOptions.DropDockerImageEnv)
	assert.Nil(t, fakeDocker.recreateOptions.ComposeSync)
}

func TestService_Perform_Docker_UnmatchedReleaseAssetsUseRegistryFallback(t *testing.T) {
	resetGlobalCache(t)

	t.Setenv("NEWAPI_DEPLOY_MODE", "docker")
	cfg := testConfig()
	cfg.ComposeSyncEnabled = true
	cfg.ComposeFile = "/app/compose.yaml"
	cfg.ComposeService = "new-api"
	gh := &fakeGitHubClient{release: makeRelease("v2.0.0", []Asset{
		{Name: "new-api-v2.0.0.exe", DownloadURL: "https://example.invalid/windows"},
		{Name: "checksums-linux.txt", DownloadURL: "https://example.invalid/checksums"},
		{Name: "README.md", DownloadURL: "https://example.invalid/readme"},
	})}
	docker := &fakeDockerEngine{}

	result, err := newService(cfg, gh, docker, "v1.0.0").Perform(context.Background())
	require.NoError(t, err)
	assert.Equal(t, DeployModeDocker, result.DeployMode)
	assert.False(t, result.NeedRestart)
	assert.False(t, docker.buildCalled)
	assert.False(t, docker.recreateLocalCalled)
	assert.True(t, docker.recreateCalled)
	assert.Equal(t, cfg.DockerImage, docker.recreateImage)
	assert.False(t, docker.recreateOptions.DropDockerImageEnv)
	assert.Nil(t, docker.recreateOptions.ComposeSync)
	assert.Zero(t, gh.downloadCalls)
	assert.Zero(t, gh.fetchCalls)
}

func TestService_Perform_Docker_ReleaseBinaryWithoutChecksumIsRejected(t *testing.T) {
	resetGlobalCache(t)

	t.Setenv("NEWAPI_DEPLOY_MODE", "docker")
	binaryName := dockerTestBinaryName()
	gh := &fakeGitHubClient{release: makeRelease("v2.0.0", []Asset{
		{Name: binaryName, DownloadURL: "https://example.invalid/binary"},
	})}
	docker := &fakeDockerEngine{}
	svc := newService(testConfig(), gh, docker, "v1.0.0")

	_, err := svc.Perform(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no checksum asset for linux/"+runtime.GOARCH+"; update rejected")
	assert.Equal(t, PhaseFailed, svc.Status().Phase)
	assert.False(t, docker.buildCalled)
	assert.False(t, docker.recreateCalled)
	assert.False(t, docker.recreateLocalCalled)
	assert.Zero(t, gh.downloadCalls)
	assert.Zero(t, gh.fetchCalls)
}

func TestService_Perform_Docker_ReleaseAssetDownloadOrChecksumFailureDoesNotFallback(t *testing.T) {
	for _, tc := range []struct {
		name      string
		download  error
		fetch     error
		checksum  []byte
		wantError string
	}{
		{name: "download failure", download: errors.New("download unavailable"), wantError: "download binary"},
		{name: "checksum fetch failure", fetch: errors.New("checksum unavailable"), wantError: "fetch checksum"},
		{name: "checksum mismatch", checksum: []byte("0000000000000000000000000000000000000000000000000000000000000000  placeholder\n"), wantError: "checksum mismatch"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resetGlobalCache(t)
			t.Setenv("NEWAPI_DEPLOY_MODE", "docker")
			binaryName := dockerTestBinaryName()
			if tc.checksum != nil {
				tc.checksum = []byte(strings.ReplaceAll(string(tc.checksum), "placeholder", binaryName))
			}
			gh := &fakeGitHubClient{
				release: makeRelease("v2.0.0", []Asset{
					{Name: binaryName, DownloadURL: "https://example.invalid/binary"},
					{Name: "checksums-linux.txt", DownloadURL: "https://example.invalid/checksums"},
				}),
				downloadData:  []byte("release binary"),
				checksumData:  tc.checksum,
				downloadErr:   tc.download,
				fetchBytesErr: tc.fetch,
			}
			docker := &fakeDockerEngine{}
			svc := newService(testConfig(), gh, docker, "v1.0.0")

			_, err := svc.Perform(context.Background())
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.wantError)
			assert.Equal(t, PhaseFailed, svc.Status().Phase)
			assert.False(t, docker.buildCalled)
			assert.False(t, docker.recreateLocalCalled)
			assert.False(t, docker.recreateCalled, "release verification failure must not fall back to the registry")
		})
	}
}
func TestService_Perform_Docker_ReleaseBinaryBuildsLocalImageAndEnablesComposeSync(t *testing.T) {
	resetGlobalCache(t)

	t.Setenv("NEWAPI_DEPLOY_MODE", "docker")
	binaryName := dockerTestBinaryName()
	binary := []byte("verified release binary")
	digest := sha256.Sum256(binary)
	gh := &fakeGitHubClient{
		release: makeRelease("v2.0.0", []Asset{
			{Name: binaryName, DownloadURL: "https://example.invalid/binary"},
			{Name: "checksums-linux.txt", DownloadURL: "https://example.invalid/checksums"},
		}),
		downloadData: binary,
		checksumData: []byte(fmt.Sprintf("%x  %s\n", digest, binaryName)),
	}
	cfg := testConfig()
	cfg.ComposeSyncEnabled = true
	cfg.ComposeFile = "/app/compose.yaml"
	cfg.ComposeService = "new-api"
	docker := &fakeDockerEngine{inspectSelf: &ContainerInspect{Image: "sha256:base"}}
	docker.inspectSelf.Config.Image = "calciumion/new-api:latest"

	result, err := newService(cfg, gh, docker, "v1.0.0").Perform(context.Background())
	require.NoError(t, err)
	assert.Equal(t, DeployModeDocker, result.DeployMode)
	assert.Equal(t, "local/new-api:v2.0.0", docker.buildTarget)
	assert.True(t, docker.buildCalled)
	assert.True(t, docker.recreateLocalCalled)
	assert.Equal(t, "local/new-api:v2.0.0", docker.recreateLocalImage)
	assert.False(t, docker.recreateCalled)
	assert.Empty(t, docker.recreateImage)
	assert.True(t, docker.recreateLocalOptions.DropDockerImageEnv)
	require.NotNil(t, docker.recreateLocalOptions.ComposeSync)
	assert.Equal(t, cfg.ComposeFile, docker.recreateLocalOptions.ComposeSync.ComposeFile)
	assert.Equal(t, cfg.ComposeService, docker.recreateLocalOptions.ComposeSync.ComposeService)
	assert.True(t, docker.recreateLocalOptions.ComposeSync.RejectDockerImageEnv)
	assert.Equal(t, 1, gh.downloadCalls)
	assert.Equal(t, 1, gh.fetchCalls)
}

func dockerTestBinaryName() string {
	switch runtime.GOARCH {
	case "arm64":
		return "new-api-arm64-v2.0.0"
	case "amd64":
		return "new-api-v2.0.0"
	default:
		return "new-api-linux-" + runtime.GOARCH + "-v2.0.0"
	}
}

func TestDockerLocalImageRef(t *testing.T) {
	image, err := dockerLocalImageRef("v2.0.0-th.1")
	require.NoError(t, err)
	assert.Equal(t, "local/new-api:v2.0.0-th.1", image)

	for _, version := range []string{
		"",
		" v2.0.0",
		"v2.0.0\ninvalid",
		"v2@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	} {
		t.Run("reject "+strings.ReplaceAll(version, "\n", "-"), func(t *testing.T) {
			_, err := dockerLocalImageRef(version)
			require.Error(t, err)
		})
	}
}

func TestService_DockerRecreateOptions_ComposeSync(t *testing.T) {
	cfg := testConfig()
	cfg.ComposeSyncEnabled = true
	cfg.ComposeFile = "/app/docker-compose.yml"
	cfg.ComposeService = "new-api"
	svc := newService(cfg, nil, nil, "v1.0.0")

	releaseOptions := svc.dockerRecreateOptions(true)
	require.NotNil(t, releaseOptions.ComposeSync)
	assert.Equal(t, cfg.ComposeFile, releaseOptions.ComposeSync.ComposeFile)
	assert.Equal(t, cfg.ComposeService, releaseOptions.ComposeSync.ComposeService)
	assert.True(t, releaseOptions.DropDockerImageEnv)
	assert.True(t, releaseOptions.ComposeSync.RejectDockerImageEnv)

	registryOptions := svc.dockerRecreateOptions(false)
	assert.Nil(t, registryOptions.ComposeSync, "registry fallback must not synchronize Compose")
	assert.False(t, registryOptions.DropDockerImageEnv)
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
