package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

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

	previousDataRoot := autoPricingDataRoot
	autoPricingDataRoot = t.TempDir()

	t.Cleanup(func() {
		autoPricingClient = previousClient
		*setting = previousSetting
		autopricing.SetCatalog(nil)
		autoPricingStateMu.Lock()
		autoPricingState = newAutoPricingState()
		autoPricingStateMu.Unlock()
		autoPricingDataRoot = previousDataRoot
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
	setting.AllowedHosts = append(setting.EffectiveAllowedHosts(), "example.invalid")
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

	stateDir := filepath.Dir(autoPricingStatePath())
	require.NoError(t, os.RemoveAll(stateDir))
	require.NoError(t, os.WriteFile(stateDir, []byte("blocks state directory"), 0o600))
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
	assert.True(t, loadAutoPricingFromDisk())
	assert.Equal(t, "offline-snapshot", GetAutoPricingStatus().Source)
	_, ok := autopricing.Resolve("gpt-5.6-sol", false)
	assert.True(t, ok)
}

func TestLoadLegacyCacheCreatesRestorableMultiSourceState(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, os.WriteFile(autoPricingCachePath(), []byte(validCatalogDocument), 0o600))
	require.NoError(t, os.WriteFile(autoPricingVersionPath(), []byte(`"legacy-etag"`), 0o600))

	require.True(t, loadLegacyAutoPricingCache())
	state := snapshotAutoPricingState()
	require.NotNil(t, state.Active)
	assert.NotEmpty(t, state.Active.Records)
	_, err := autopricing.RestoreCatalog(state.Active)
	require.NoError(t, err)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	assert.Empty(t, GetAutoPricingStatus().LastError)
}

func TestLoadFromDiskReplacesUnrestorableStateFromLegacyCache(t *testing.T) {
	useFakeRemote(t, &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`})
	broken := newAutoPricingState()
	broken.Active = &autopricing.CatalogSnapshot{
		Version: "legacy-cache-without-records",
		Records: map[string]autopricing.PriceRecord{},
	}
	require.NoError(t, persistAutoPricingState(broken))
	require.NoError(t, os.WriteFile(autoPricingCachePath(), []byte(validCatalogDocument), 0o600))

	require.True(t, loadAutoPricingFromDisk())
	state := snapshotAutoPricingState()
	require.NotNil(t, state.Active)
	assert.NotEmpty(t, state.Active.Records)
	_, err := autopricing.RestoreCatalog(state.Active)
	require.NoError(t, err)
}

func TestLoadFromDiskRejectsCorruptCache(t *testing.T) {
	useFakeRemote(t, &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`})

	require.NoError(t, os.MkdirAll(filepath.Dir(autoPricingStatePath()), 0o700))
	require.NoError(t, os.WriteFile(autoPricingStatePath(), []byte("not json"), 0o600))
	assert.True(t, loadAutoPricingFromDisk())
	assert.True(t, autopricing.Loaded())
	assert.Equal(t, "offline-snapshot", GetAutoPricingStatus().Source)
}

func TestValidateAutoPricingURLRequiresHTTPSAllowlistedHost(t *testing.T) {
	valid, err := validateAutoPricingURLForHosts("https://mirror.example/catalog.json", []string{"mirror.example"})
	require.NoError(t, err)
	assert.Equal(t, "https://mirror.example/catalog.json", valid)
	_, err = validateAutoPricingURLForHosts("http://mirror.example/catalog.json", []string{"mirror.example"})
	assert.ErrorContains(t, err, "HTTPS")
	_, err = validateAutoPricingURLForHosts("https://other.example/catalog.json", []string{"mirror.example"})
	assert.ErrorContains(t, err, "allowlist")
	_, err = validateAutoPricingURLForHosts("https://user@mirror.example/catalog.json", []string{"mirror.example"})
	assert.ErrorContains(t, err, "userinfo")
}

func TestReviewByModelsRejectsStaleRevision(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)
	require.NoError(t, SyncAutoPricingOnce(context.Background(), false))
	client.body = []byte(updatedCatalogDocument)
	client.version = `"etag-2"`
	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))
	pending, revision := GetAutoPricingPendingWithRevision()
	require.Len(t, pending, 1)
	require.NotEmpty(t, revision)
	_, err := ReviewAutoPricingByModels([]string{pending[0].Model}, "approve", "stale-revision")
	var reviewErr *AutoPricingReviewError
	require.ErrorAs(t, err, &reviewErr)
	assert.Equal(t, http.StatusConflict, reviewErr.Status)
	results, err := ReviewAutoPricingByModels([]string{pending[0].Model}, "approve", revision)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, pending[0].Model, results[0].Model)
	assert.Equal(t, pending[0].Fingerprint, results[0].Fingerprint)
	assert.Equal(t, "approve", results[0].Action)
}

func TestSameCatalogPricesIgnoresSourceMetadataButDetectsBillingChanges(t *testing.T) {
	input, output, changedOutput := 2.0, 8.0, 9.0
	base := &autopricing.CatalogSnapshot{Records: map[string]autopricing.PriceRecord{
		"model": {
			Model: "model", PrimarySource: autopricing.SourceMirror,
			SourceVersion: "v1", SourceURL: "https://mirror.example/v1.json",
			Standard: autopricing.CostSet{Input: &input, Output: &output},
		},
	}}
	metadataOnly := &autopricing.CatalogSnapshot{Records: map[string]autopricing.PriceRecord{
		"model": {
			Model: "model", PrimarySource: autopricing.SourceModelsDev,
			SourceVersion: "v2", SourceURL: "https://models.dev/api.json",
			Standard: autopricing.CostSet{Input: &input, Output: &output},
		},
	}}
	assert.True(t, sameCatalogPrices(base, metadataOnly))
	metadataOnly.Records["model"] = autopricing.PriceRecord{
		Model: "model", PrimarySource: autopricing.SourceModelsDev,
		Standard: autopricing.CostSet{Input: &input, Output: &changedOutput},
	}
	assert.False(t, sameCatalogPrices(base, metadataOnly))
}

func TestAutoPricingRevisionIgnoresSnapshotTimestamp(t *testing.T) {
	first := &autopricing.CatalogSnapshot{
		Version:   "candidate-v1",
		UpdatedAt: time.Date(2026, time.August, 14, 1, 0, 0, 0, time.UTC),
	}
	second := &autopricing.CatalogSnapshot{
		Version:   first.Version,
		UpdatedAt: first.UpdatedAt.Add(time.Hour),
	}
	pending := []autopricing.PendingReview{{Model: "model", Fingerprint: "fingerprint-v1"}}

	assert.Equal(t, autoPricingRevision(first, pending), autoPricingRevision(second, pending))
	second.Version = "candidate-v2"
	assert.NotEqual(t, autoPricingRevision(first, pending), autoPricingRevision(second, pending))
}

func TestReadStateMigratesMissingReviewRevision(t *testing.T) {
	useFakeRemote(t, &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`})
	state := newAutoPricingState()
	state.Revision = ""
	require.NoError(t, persistAutoPricingState(state))

	restored, err := readAutoPricingState()
	require.NoError(t, err)
	require.NotNil(t, restored)
	assert.NotEmpty(t, restored.Revision)
	reloaded, err := readAutoPricingState()
	require.NoError(t, err)
	assert.Equal(t, restored.Revision, reloaded.Revision)
}

func TestAutoPricingProxyInitializationFailsClosed(t *testing.T) {
	useFakeRemote(t, &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`})
	setting, ok := config.GlobalConfig.Get("auto_pricing").(*ratio_setting.AutoPricingSetting)
	require.True(t, ok)
	setting.ProxyURL = "://invalid-proxy"
	setting.AllowDirectOnProxyFailure = false
	_, err := (&httpAutoPricingClient{}).client()
	assert.ErrorContains(t, err, "proxy")

	setting.AllowDirectOnProxyFailure = true
	client, err := (&httpAutoPricingClient{}).client()
	require.NoError(t, err)
	assert.NotNil(t, client)
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
	var marker model.Option
	require.NoError(t, db.Where("key = ?", autoPricingTakeoverKey).First(&marker).Error)
	assert.Equal(t, "true", marker.Value)
}

func TestFirstTakeoverRollsBackOptionsAndStateOnDatabaseFailure(t *testing.T) {
	client := &fakeRemoteClient{body: []byte(validCatalogDocument), version: `"etag-1"`}
	useFakeRemote(t, client)

	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "takeover-rollback.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	require.NoError(t, db.Create(&model.Option{Key: "ModelRatio", Value: `{"legacy-model":1}`}).Error)
	callbackName := "test:fail-auto-pricing-takeover-delete"
	require.NoError(t, db.Callback().Delete().Before("gorm:delete").Register(callbackName, func(tx *gorm.DB) {
		tx.AddError(errors.New("forced takeover delete failure"))
	}))
	model.DB = db
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		model.DB = previousDB
		_ = db.Callback().Delete().Remove(callbackName)
		_ = sqlDB.Close()
	})

	err = SyncAutoPricingOnce(context.Background(), false)
	assert.ErrorContains(t, err, "forced takeover delete failure")
	assert.False(t, GetAutoPricingStatus().TakeoverComplete)
	var count int64
	require.NoError(t, db.Model(&model.Option{}).Where("key = ?", "ModelRatio").Count(&count).Error)
	assert.EqualValues(t, 1, count)
	require.NoError(t, db.Model(&model.Option{}).Where("key = ?", autoPricingTakeoverKey).Count(&count).Error)
	assert.Zero(t, count)
}
