package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const validCatalogDocument = `{
	"probe-model": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000008}
}`

const updatedCatalogDocument = `{
	"probe-model": {"input_cost_per_token": 0.000004, "output_cost_per_token": 0.000016}
}`

// fakeRemoteClient records what the sync asked for and replays canned answers.
type fakeRemoteClient struct {
	body          []byte
	version       string
	notModified   bool
	fetchErr      error
	changeToken   string
	tokenErr      error
	catalogCalls  int
	tokenCalls    int
	seenVersion   string
	callsByURL    map[string]int
	versionsByURL map[string]string
	fetchErrByURL map[string]error
}

func (f *fakeRemoteClient) FetchCatalog(_ context.Context, url, knownVersion string) ([]byte, string, bool, error) {
	f.catalogCalls++
	f.seenVersion = knownVersion
	if f.callsByURL == nil {
		f.callsByURL = map[string]int{}
		f.versionsByURL = map[string]string{}
	}
	f.callsByURL[url]++
	f.versionsByURL[url] = knownVersion
	if err := f.fetchErrByURL[url]; err != nil {
		return nil, "", false, err
	}
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
		autoPricingStateMu.Lock()
		autoPricingState = newAutoPricingState()
		autoPricingStateMu.Unlock()
		_ = os.Chdir(workDir)
	})
}

func testCatalogSHA256(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
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

func TestAutoPricingAPICollectionsAreNeverNil(t *testing.T) {
	autoPricingStateMu.Lock()
	previous := autoPricingState
	autoPricingState = newAutoPricingState()
	autoPricingStateMu.Unlock()
	t.Cleanup(func() {
		autoPricingStateMu.Lock()
		autoPricingState = previous
		autoPricingStateMu.Unlock()
	})

	assert.NotNil(t, GetAutoPricingStatus().Sources)
	assert.NotNil(t, GetAutoPricingPending())
}

func TestSyncPublishesDownloadedCatalog(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)

	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)

	status := GetAutoPricingStatus()
	assert.GreaterOrEqual(t, status.ModelCount, 1)
	assert.Contains(t, status.Version, `wei-shaw:"etag-1"`)
	assert.Empty(t, status.LastError)
	assert.Equal(t, "remote", status.Source)
}

func TestSyncSendsKnownVersionAndHandlesNotModified(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	client.notModified = true
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	assert.Equal(t, `"etag-1"`, client.versionsByURL[ratio_setting.GetAutoPricingSetting().AutoPricingRemoteURL()], "the stored token must be offered for conditional GET")
	assert.Equal(t, "remote", GetAutoPricingStatus().Source)
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
	assert.Equal(t, 1.0, entry.ModelRatio, "large changes stay on the active price before review")
	assert.Equal(t, 1, GetAutoPricingStatus().PendingCount)
}

func TestReviewApprovesCurrentPendingCandidate(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	client.body = []byte(updatedCatalogDocument)
	client.version = `"etag-2"`
	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))
	require.Len(t, GetAutoPricingPending(), 1)

	pending := GetAutoPricingPending()
	require.Len(t, pending, 1)
	require.NoError(t, ReviewAutoPricing([]string{pending[0].Fingerprint}, "approve"))
	assert.Empty(t, GetAutoPricingPending())
	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 2.0, entry.ModelRatio)
	assert.ErrorContains(t, ReviewAutoPricing([]string{pending[0].Fingerprint}, "approve"), "not pending or is stale")
}

func TestReviewRejectSuppressesOnlySameFingerprint(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	client.body = []byte(updatedCatalogDocument)
	client.version = `"etag-2"`
	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))
	pending := GetAutoPricingPending()
	require.Len(t, pending, 1)
	require.NoError(t, ReviewAutoPricing([]string{pending[0].Fingerprint}, "reject"))
	assert.Empty(t, GetAutoPricingPending())

	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))
	assert.Empty(t, GetAutoPricingPending(), "the same source version and price structure stays suppressed")

	client.version = `"etag-3"`
	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))
	require.Len(t, GetAutoPricingPending(), 1, "a new source version must produce a new fingerprint")
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

func TestSingleSourceFailureIsReportedWithoutBlockingCatalog(t *testing.T) {
	client := &fakeRemoteClient{
		body:    []byte(validCatalogDocument),
		version: `"etag-1"`,
		fetchErrByURL: map[string]error{
			autopricing.DefaultModelsDevURL: errors.New("models.dev unavailable"),
		},
	}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	status := GetAutoPricingStatus()
	require.True(t, status.Loaded)
	found := false
	for _, source := range status.Sources {
		if source.Source == autopricing.SourceModelsDev {
			found = true
			assert.Contains(t, source.Error, "models.dev unavailable")
		}
	}
	assert.True(t, found)
}

func TestPersistenceFailureKeepsPreviousEffectiveCatalog(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	require.NoError(t, os.RemoveAll(autoPricingStateDir))
	require.NoError(t, os.WriteFile(autoPricingStateDir, []byte("blocks state directory"), 0o600))
	client.body = []byte(updatedCatalogDocument)
	client.version = `"etag-2"`
	require.Error(t, SyncAutoPricingOnce(context.Background(), true))

	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)
	assert.NotEmpty(t, GetAutoPricingStatus().LastError)
}

func TestChangeTokenSkipsDownloadWhenUnchanged(t *testing.T) {
	firstHash := testCatalogSHA256([]byte(validCatalogDocument))
	client := &fakeRemoteClient{
		body:        []byte(validCatalogDocument),
		version:     `"etag-1"`,
		changeToken: firstHash,
	}
	useFakeRemote(t, client)

	setHashURLForTest(t, "https://example.invalid/catalog.sha256")

	// First run has no stored token, so it downloads and stores the published
	// hash as the comparison token.
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	mirrorURL := ratio_setting.GetAutoPricingSetting().AutoPricingRemoteURL()
	require.Equal(t, 1, client.callsByURL[mirrorURL])
	assert.Contains(t, GetAutoPricingStatus().Version, "wei-shaw:sha256:"+firstHash)

	// Second run sees the same hash and must not download the document again.
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	assert.Equal(t, 1, client.callsByURL[mirrorURL], "an unchanged checksum must skip the mirror download")
	assert.Equal(t, 2, client.tokenCalls)

	// A new hash triggers a fresh download.
	client.body = []byte(updatedCatalogDocument)
	secondHash := testCatalogSHA256(client.body)
	client.changeToken = secondHash
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	assert.Equal(t, 2, client.callsByURL[mirrorURL])
	assert.Contains(t, GetAutoPricingStatus().Version, "wei-shaw:sha256:"+secondHash)
}

func TestMirrorChecksumMismatchIsReportedAndKeepsLastGoodPrice(t *testing.T) {
	client := &fakeRemoteClient{
		body:        []byte(validCatalogDocument),
		version:     `"etag-1"`,
		changeToken: testCatalogSHA256([]byte(validCatalogDocument)),
	}
	useFakeRemote(t, client)
	setHashURLForTest(t, "https://example.invalid/catalog.sha256")
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	client.body = []byte(updatedCatalogDocument)
	client.changeToken = testCatalogSHA256([]byte("different document"))
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false), "another healthy source may still complete the sync")
	status := GetAutoPricingStatus()
	var mirrorStatus *AutoPricingSourceStatus
	for index := range status.Sources {
		if status.Sources[index].Source == autopricing.SourceMirror {
			mirrorStatus = &status.Sources[index]
			break
		}
	}
	require.NotNil(t, mirrorStatus)
	assert.Contains(t, mirrorStatus.Error, "checksum mismatch")
	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)
}

func TestLoadFromDiskRestoresLastGoodCatalog(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))

	cachePath := autoPricingStatePath()
	require.FileExists(t, cachePath)

	// Simulate a restart with the upstream unreachable.
	autopricing.SetCatalog(nil)
	require.True(t, loadAutoPricingFromDisk())

	entry, ok := autopricing.Resolve("probe-model", false)
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)
	assert.Equal(t, "cache", GetAutoPricingStatus().Source)
	assert.Contains(t, GetAutoPricingStatus().Version, `wei-shaw:"etag-1"`)
}

func TestLoadFromDiskWithoutCacheIsNotAnError(t *testing.T) {
	useFakeRemote(t, &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`})
	assert.False(t, loadAutoPricingFromDisk())
}

func TestLoadFromDiskRejectsCorruptCache(t *testing.T) {
	useFakeRemote(t, &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`})

	require.NoError(t, os.MkdirAll(autoPricingStateDir, 0o700))
	require.NoError(t, os.WriteFile(autoPricingStatePath(), []byte("not json"), 0o600))
	assert.False(t, loadAutoPricingFromDisk())
	assert.False(t, autopricing.Loaded())
}

func TestLoadFromDiskRestoresPendingReviews(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	client.body = []byte(updatedCatalogDocument)
	client.version = `"etag-2"`
	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))
	require.Len(t, GetAutoPricingPending(), 1)

	autopricing.SetCatalog(nil)
	autoPricingStateMu.Lock()
	autoPricingState = newAutoPricingState()
	autoPricingStateMu.Unlock()
	require.True(t, loadAutoPricingFromDisk())
	require.Len(t, GetAutoPricingPending(), 1)
}

func TestFirstTakeoverArchivesAndDeletesLegacyPricingOptions(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)

	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "takeover.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	require.NoError(t, db.Create(&model.Option{Key: "ModelRatio", Value: `{"legacy-model":1}`}).Error)
	require.NoError(t, db.Create(&model.Option{Key: "billing_setting.billing_expr", Value: `{"legacy-model":"p * 2"}`}).Error)
	model.DB = db
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})

	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	assert.True(t, GetAutoPricingStatus().TakeoverComplete)
	require.FileExists(t, autoPricingArchivePath())
	var count int64
	require.NoError(t, db.Model(&model.Option{}).Where("key IN ?", takeoverOptionKeys).Count(&count).Error)
	assert.Zero(t, count)
}
