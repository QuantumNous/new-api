package service

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const validCatalogDocument = `{
	"probe-model": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000008}
}`

const updatedCatalogDocument = `{
	"probe-model": {"input_cost_per_token": 0.000004, "output_cost_per_token": 0.000016}
}`

const validCatalogSHA256 = "1c9fed45a1f4983c0e7953389bffcf9cbb22cd5b323d779cf5461d877ddc134a"
const updatedCatalogSHA256 = "5f7dbeebb2909014b38af892e9a029478c64306d7fb0dc39b2110a8f91c46d9b"

// fakeRemoteClient records what the sync asked for and replays canned answers.
type fakeRemoteClient struct {
	body         []byte
	version      string
	notModified  bool
	fetchErr     error
	changeToken  string
	tokenErr     error
	catalogCalls int
	tokenCalls   int
	seenVersion  string
}

func (f *fakeRemoteClient) FetchCatalog(_ context.Context, _, knownVersion string) ([]byte, string, bool, error) {
	f.catalogCalls++
	f.seenVersion = knownVersion
	if f.fetchErr != nil {
		return nil, "", false, f.fetchErr
	}
	if f.notModified {
		return nil, knownVersion, true, nil
	}
	return f.body, f.version, false, nil
}

func (f *fakeRemoteClient) FetchChangeToken(_ context.Context, _ string) (string, error) {
	f.tokenCalls++
	return f.changeToken, f.tokenErr
}

// useFakeRemote installs a fake client and runs the sync inside a temp working
// directory so the on-disk cache never touches the repository.
func useFakeRemote(t *testing.T, client autoPricingRemoteClient) {
	t.Helper()

	previousClient := autoPricingClient
	autoPricingClient = client
	setting, ok := config.GlobalConfig.Get("auto_pricing").(*ratio_setting.AutoPricingSetting)
	require.True(t, ok, "auto_pricing config must be registered")
	previousSetting := *setting
	setting.HashURL = ""

	workDir, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(t.TempDir()))

	t.Cleanup(func() {
		autoPricingClient = previousClient
		*setting = previousSetting
		autopricing.SetCatalog(nil)
		_ = os.Chdir(workDir)
	})
}

// setHashURLForTest mutates the registered auto-pricing config through the
// config manager, which is the only exported handle on it from this package.
func setHashURLForTest(t *testing.T, hashURL string) {
	t.Helper()
	setting, ok := config.GlobalConfig.Get("auto_pricing").(*ratio_setting.AutoPricingSetting)
	require.True(t, ok, "auto_pricing config must be registered")

	previous := *setting
	setting.HashURL = hashURL
	t.Cleanup(func() { *setting = previous })
}

func TestSyncPublishesDownloadedCatalog(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)

	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)

	status := GetAutoPricingStatus()
	assert.Equal(t, 1, status.ModelCount)
	assert.Equal(t, `"etag-1"`, status.Version)
	assert.Empty(t, status.LastError)
	assert.Equal(t, "remote", status.Source)
}

func TestSyncSendsKnownVersionAndHandlesNotModified(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	client.notModified = true
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	assert.Equal(t, `"etag-1"`, client.seenVersion, "the stored token must be offered for conditional GET")
	assert.Equal(t, "unchanged", GetAutoPricingStatus().Source)
}

func TestContentHashVersionSkipsReparseWhenETagIsMissing(t *testing.T) {
	client := &fakeRemoteClient{
		body:    []byte(validCatalogDocument),
		version: contentHashVersionPrefix + validCatalogSHA256,
	}
	useFakeRemote(t, client)

	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	firstUpdatedAt := GetAutoPricingStatus().UpdatedAt
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	status := GetAutoPricingStatus()
	assert.Equal(t, "unchanged", status.Source)
	assert.Equal(t, "unchanged", status.State)
	assert.Equal(t, firstUpdatedAt, status.UpdatedAt)
}

func TestForceSyncIgnoresKnownVersion(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	client.body = []byte(updatedCatalogDocument)
	client.version = `"etag-2"`
	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))

	assert.Empty(t, client.seenVersion, "a forced sync must not send a conditional header")
	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 2.0, entry.ModelRatio)
}

func TestChangingCatalogURLForcesFreshDownload(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)

	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	setting, ok := config.GlobalConfig.Get("auto_pricing").(*ratio_setting.AutoPricingSetting)
	require.True(t, ok)
	setting.RemoteURL = "https://new.example.invalid/catalog.json"
	client.body = []byte(updatedCatalogDocument)
	client.version = `"etag-2"`

	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	assert.Empty(t, client.seenVersion, "a new source URL must not reuse the previous URL's change token")
	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 2.0, entry.ModelRatio)
}

func TestFailedSyncKeepsPreviousCatalog(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	cases := []struct {
		name    string
		prepare func()
	}{
		{name: "network error", prepare: func() { client.fetchErr = errors.New("connection refused") }},
		{name: "corrupt document", prepare: func() { client.fetchErr = nil; client.body = []byte("<html>404</html>") }},
		{name: "empty document", prepare: func() { client.fetchErr = nil; client.body = []byte("{}") }},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tc.prepare()
			client.version = `"etag-broken"`

			err := SyncAutoPricingOnce(context.Background(), true)
			require.Error(t, err)

			// Losing the fallback during an upstream problem would break every
			// model that depends on it, so the last good catalog must survive.
			entry, ok := autopricing.Resolve("probe-model", false)
			require.True(t, ok)
			assert.Equal(t, 1.0, entry.ModelRatio)
			assert.NotEmpty(t, GetAutoPricingStatus().LastError)
		})
	}
}

func TestChangeTokenSkipsDownloadWhenUnchanged(t *testing.T) {
	client := &fakeRemoteClient{
		body:        []byte(validCatalogDocument),
		version:     `"etag-1"`,
		changeToken: validCatalogSHA256,
	}
	useFakeRemote(t, client)

	setHashURLForTest(t, "https://example.invalid/catalog.sha256")

	// First run has no stored token, so it downloads and stores the published
	// hash as the comparison token.
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	require.Equal(t, 1, client.catalogCalls)
	assert.Equal(t, "sha256:"+validCatalogSHA256, GetAutoPricingStatus().Version)

	// Second run sees the same hash and must not download the document again.
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	assert.Equal(t, 1, client.catalogCalls, "an unchanged checksum must skip the download")
	assert.Equal(t, 2, client.tokenCalls)

	// A new hash triggers a fresh download.
	client.changeToken = updatedCatalogSHA256
	client.body = []byte(updatedCatalogDocument)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	assert.Equal(t, 2, client.catalogCalls)
	assert.Equal(t, "sha256:"+updatedCatalogSHA256, GetAutoPricingStatus().Version)
}

func TestLoadFromDiskRestoresLastGoodCatalog(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	cachePath := autoPricingCachePath()
	require.FileExists(t, cachePath)

	// Simulate a restart with the upstream unreachable.
	autopricing.SetCatalog(nil)
	require.True(t, loadAutoPricingFromDisk())

	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)
	assert.Equal(t, "cache", GetAutoPricingStatus().Source)
	assert.Equal(t, `"etag-1"`, GetAutoPricingStatus().Version)
}

func TestLoadFromDiskWithoutCacheIsNotAnError(t *testing.T) {
	useFakeRemote(t, &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`})
	assert.False(t, loadAutoPricingFromDisk())
}

func TestLoadFromDiskRejectsCorruptCache(t *testing.T) {
	useFakeRemote(t, &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`})

	require.NoError(t, os.WriteFile(autoPricingCachePath(), []byte("not json"), 0o600))
	assert.False(t, loadAutoPricingFromDisk())
	assert.False(t, autopricing.Loaded())
}
