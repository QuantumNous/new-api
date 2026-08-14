package service

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
)

const (
	autoPricingDownloadTimeout = 30 * time.Second
	autoPricingHashTimeout     = 10 * time.Second
	autoPricingMaxBytes        = 32 << 20
	autoPricingStateDir        = "auto-pricing"
	autoPricingStateFile       = "state.json"
	autoPricingArchiveFile     = "legacy-options.json"
	autoPricingCacheFile       = "model_pricing_catalog.json"
	autoPricingVersionFile     = "model_pricing_catalog.version"
	contentHashVersionPrefix   = "sha256:"
	autoPricingGuardThreshold  = 0.25
)

var takeoverOptionKeys = []string{
	"ModelRatio", "ModelPrice", "CompletionRatio", "CacheRatio", "CreateCacheRatio",
	"billing_setting.billing_mode", "billing_setting.billing_expr",
}

type autoPricingRemoteClient interface {
	FetchCatalog(ctx context.Context, url, knownVersion string) (body []byte, version string, notModified bool, err error)
	FetchChangeToken(ctx context.Context, url string) (string, error)
}

type AutoPricingSourceStatus struct {
	Source    autopricing.SourceID `json:"source"`
	URL       string               `json:"url,omitempty"`
	Version   string               `json:"version,omitempty"`
	Error     string               `json:"error,omitempty"`
	UpdatedAt time.Time            `json:"updated_at,omitempty"`
}

type AutoPricingStatus struct {
	Enabled           bool                      `json:"enabled"`
	FuzzyMatchEnabled bool                      `json:"fuzzy_match_enabled"`
	RemoteURL         string                    `json:"remote_url"`
	HashURL           string                    `json:"hash_url"`
	IntervalMinutes   int                       `json:"check_interval_minutes"`
	Loaded            bool                      `json:"loaded"`
	ModelCount        int                       `json:"model_count"`
	SkippedCount      int                       `json:"skipped_count"`
	Version           string                    `json:"version"`
	UpdatedAt         time.Time                 `json:"updated_at,omitempty"`
	LastSyncAt        time.Time                 `json:"last_sync_at,omitempty"`
	LastSuccessfulAt  time.Time                 `json:"last_successful_at,omitempty"`
	LastError         string                    `json:"last_error,omitempty"`
	Source            string                    `json:"source,omitempty"`
	PendingCount      int                       `json:"pending_count"`
	TakeoverComplete  bool                      `json:"takeover_complete"`
	Sources           []AutoPricingSourceStatus `json:"sources"`
}

type autoPricingPersistentState struct {
	SchemaVersion    int                                                 `json:"schema_version"`
	Active           *autopricing.CatalogSnapshot                        `json:"active,omitempty"`
	Candidate        *autopricing.CatalogSnapshot                        `json:"candidate,omitempty"`
	Pending          []autopricing.PendingReview                         `json:"pending,omitempty"`
	Rejected         map[string]bool                                     `json:"rejected_fingerprints,omitempty"`
	Sources          map[autopricing.SourceID]AutoPricingSourceStatus    `json:"sources,omitempty"`
	SourceCatalogs   map[autopricing.SourceID]*autopricing.SourceCatalog `json:"source_catalogs,omitempty"`
	TakeoverComplete bool                                                `json:"takeover_complete"`
	LastSyncAt       time.Time                                           `json:"last_sync_at,omitempty"`
	LastSuccessfulAt time.Time                                           `json:"last_successful_at,omitempty"`
	LastError        string                                              `json:"last_error,omitempty"`
	Source           string                                              `json:"source,omitempty"`
}

var (
	autoPricingClient  = autoPricingRemoteClient(&httpAutoPricingClient{})
	autoPricingSyncMu  sync.Mutex
	autoPricingStateMu sync.RWMutex
	autoPricingState   = newAutoPricingState()
)

func newAutoPricingState() *autoPricingPersistentState {
	return &autoPricingPersistentState{
		SchemaVersion:  1,
		Rejected:       map[string]bool{},
		Sources:        map[autopricing.SourceID]AutoPricingSourceStatus{},
		SourceCatalogs: map[autopricing.SourceID]*autopricing.SourceCatalog{},
	}
}

func InitAutoPricing() {
	if loadAutoPricingFromDisk() {
		common.SysLog("auto pricing catalog restored from local state")
	}
	go runAutoPricingRefreshLoop()
}

func SyncAutoPricingOnce(ctx context.Context, force bool) error {
	autoPricingSyncMu.Lock()
	defer autoPricingSyncMu.Unlock()

	state := snapshotAutoPricingState()
	now := time.Now().UTC()
	state.LastSyncAt = now
	state.LastError = ""

	override, expired, err := autopricing.LoadBuiltInOverrides(now)
	if err != nil {
		return recordAutoPricingFailure(state, fmt.Errorf("load reviewed pricing overrides: %w", err))
	}
	overrideStatus := AutoPricingSourceStatus{Source: autopricing.SourceOverride, Version: override.Version, UpdatedAt: now}
	if len(expired) > 0 {
		overrideStatus.Error = "expired overrides excluded: " + strings.Join(expired, ", ")
	}
	state.Sources[autopricing.SourceOverride] = overrideStatus

	setting := ratio_setting.GetAutoPricingSetting()
	mirrorURL, err := validateAutoPricingURL(setting.AutoPricingRemoteURL())
	if err != nil {
		return recordAutoPricingFailure(state, err)
	}

	type sourceSpec struct {
		id     autopricing.SourceID
		url    string
		parser func([]byte, string) (*autopricing.SourceCatalog, error)
	}
	specs := []sourceSpec{
		{autopricing.SourceMirror, mirrorURL, autopricing.ParseMirrorSource},
		{autopricing.SourceModelsDev, autopricing.DefaultModelsDevURL, autopricing.ParseModelsDevSource},
		{autopricing.SourceLiteLLM, autopricing.DefaultLiteLLMURL, autopricing.ParseLiteLLMSource},
		{autopricing.SourceNewAPI, autopricing.DefaultNewAPIURL, autopricing.ParseNewAPISource},
	}

	collected := []*autopricing.SourceCatalog{override}
	remoteCount := 0
	successfulRemoteCount := 0
	for _, spec := range specs {
		previous := state.SourceCatalogs[spec.id]
		knownVersion := ""
		if previous != nil && !force {
			knownVersion = previous.Version
		}

		var source *autopricing.SourceCatalog
		var fetchErr error
		if spec.id == autopricing.SourceMirror {
			source, fetchErr = fetchMirrorSource(ctx, spec.url, setting.HashURL, knownVersion, previous, force)
		} else {
			source, fetchErr = fetchPricingSource(ctx, spec.url, knownVersion, previous, spec.parser)
		}

		status := AutoPricingSourceStatus{Source: spec.id, URL: spec.url, UpdatedAt: now}
		if fetchErr != nil {
			status.Error = fetchErr.Error()
			if previous != nil {
				source = previous
				status.Version = previous.Version
			}
		}
		if fetchErr == nil && source != nil {
			successfulRemoteCount++
		}
		if source != nil {
			status.Version = source.Version
			state.SourceCatalogs[spec.id] = source
			collected = append(collected, source)
			remoteCount++
		}
		state.Sources[spec.id] = status
	}
	if remoteCount == 0 {
		return recordAutoPricingFailure(state, fmt.Errorf("all remote pricing sources failed"))
	}
	if successfulRemoteCount == 0 {
		return recordAutoPricingFailure(state, fmt.Errorf("all remote pricing source refreshes failed"))
	}

	candidate, err := autopricing.MergeSources(collected...)
	if err != nil {
		return recordAutoPricingFailure(state, fmt.Errorf("merge pricing sources: %w", err))
	}
	active, err := autopricing.RestoreCatalog(state.Active)
	if err != nil {
		return recordAutoPricingFailure(state, fmt.Errorf("restore active pricing catalog: %w", err))
	}
	guarded, pending, err := autopricing.GuardCatalog(active, candidate, autoPricingGuardThreshold, state.Rejected)
	if err != nil {
		return recordAutoPricingFailure(state, fmt.Errorf("guard pricing catalog: %w", err))
	}

	state.Candidate = candidate.Snapshot()
	state.Pending = pending
	state.LastSuccessfulAt = now
	state.LastError = ""
	state.Source = "remote"

	changed := !sameCatalogPrices(state.Active, guarded.Snapshot())
	if state.Active == nil && !state.TakeoverComplete && canCompleteAutoPricingTakeover() {
		if err := persistAutoPricingState(state); err != nil {
			return recordAutoPricingFailure(state, fmt.Errorf("persist pricing candidate: %w", err))
		}
		if err := completeAutoPricingTakeover(state, guarded.Snapshot()); err != nil {
			return recordAutoPricingFailure(state, err)
		}
	} else {
		state.Active = guarded.Snapshot()
		if err := persistAutoPricingState(state); err != nil {
			return recordAutoPricingFailure(state, fmt.Errorf("persist pricing state: %w", err))
		}
	}

	publishAutoPricingState(state, guarded, changed)
	common.SysLog(fmt.Sprintf("auto pricing catalog updated: %d active models, %d pending reviews", guarded.ModelCount, len(pending)))
	return nil
}

func canCompleteAutoPricingTakeover() bool {
	return model.DB != nil && model.DB.Migrator().HasTable(&model.Option{})
}

func fetchMirrorSource(ctx context.Context, catalogURL, hashURL, knownVersion string, previous *autopricing.SourceCatalog, force bool) (*autopricing.SourceCatalog, error) {
	hashToken := ""
	if strings.TrimSpace(hashURL) != "" {
		validated, err := validateAutoPricingURL(hashURL)
		if err != nil {
			return nil, fmt.Errorf("invalid mirror checksum url: %w", err)
		}
		hashCtx, cancel := context.WithTimeout(ctx, autoPricingHashTimeout)
		hashToken, err = autoPricingClient.FetchChangeToken(hashCtx, validated)
		cancel()
		if err != nil {
			return nil, fmt.Errorf("fetch mirror checksum: %w", err)
		}
		if !force && previous != nil && hashToken != "" && strings.EqualFold(strings.TrimPrefix(previous.Version, contentHashVersionPrefix), hashToken) {
			return previous, nil
		}
	}
	source, err := fetchPricingSource(ctx, catalogURL, knownVersion, previous, autopricing.ParseMirrorSource)
	if err != nil {
		return nil, err
	}
	if hashToken != "" && source != nil {
		source.Version = contentHashVersionPrefix + hashToken
		for key, record := range source.Records {
			record.SourceVersion = source.Version
			source.Records[key] = record
		}
	}
	return source, nil
}

func fetchPricingSource(ctx context.Context, sourceURL, knownVersion string, previous *autopricing.SourceCatalog, parser func([]byte, string) (*autopricing.SourceCatalog, error)) (*autopricing.SourceCatalog, error) {
	downloadCtx, cancel := context.WithTimeout(ctx, autoPricingDownloadTimeout)
	defer cancel()
	body, version, notModified, err := autoPricingClient.FetchCatalog(downloadCtx, sourceURL, knownVersion)
	if err != nil {
		return nil, fmt.Errorf("download %s: %w", sourceURL, err)
	}
	if notModified {
		if previous == nil {
			return nil, fmt.Errorf("source returned not modified without a cached catalog")
		}
		return previous, nil
	}
	source, err := parser(body, version)
	if err != nil {
		return nil, err
	}
	return source, nil
}

func GetAutoPricingStatus() AutoPricingStatus {
	setting := ratio_setting.GetAutoPricingSetting()
	state := snapshotAutoPricingState()
	status := AutoPricingStatus{
		Enabled: setting.Enabled, FuzzyMatchEnabled: setting.FuzzyMatchEnabled,
		RemoteURL: setting.AutoPricingRemoteURL(), HashURL: setting.HashURL,
		IntervalMinutes: setting.EffectiveCheckIntervalMinutes(), LastSyncAt: state.LastSyncAt,
		LastSuccessfulAt: state.LastSuccessfulAt, LastError: state.LastError, Source: state.Source,
		PendingCount: len(state.Pending), TakeoverComplete: state.TakeoverComplete,
	}
	if catalog := autopricing.CurrentCatalog(); catalog != nil {
		status.Loaded = catalog.ModelCount > 0
		status.ModelCount = catalog.ModelCount
		status.SkippedCount = catalog.SkippedCount
		status.Version = catalog.Version
		status.UpdatedAt = catalog.UpdatedAt
	}
	for _, source := range state.Sources {
		status.Sources = append(status.Sources, source)
	}
	sort.Slice(status.Sources, func(i, j int) bool { return status.Sources[i].Source < status.Sources[j].Source })
	return status
}

func GetAutoPricingPending() []autopricing.PendingReview {
	state := snapshotAutoPricingState()
	return state.Pending
}

func ReviewAutoPricing(models []string, action string) error {
	autoPricingSyncMu.Lock()
	defer autoPricingSyncMu.Unlock()
	if len(models) == 0 {
		return fmt.Errorf("models must contain at least one model")
	}
	approve := false
	switch action {
	case "approve":
		approve = true
	case "reject":
	default:
		return fmt.Errorf("action must be approve or reject")
	}
	state := snapshotAutoPricingState()
	active, err := autopricing.RestoreCatalog(state.Active)
	if err != nil {
		return fmt.Errorf("restore active pricing catalog: %w", err)
	}
	next, remaining, rejected, err := autopricing.ApplyReview(active, state.Pending, models, approve)
	if err != nil {
		return err
	}
	for _, fingerprint := range rejected {
		state.Rejected[fingerprint] = true
	}
	state.Active = next.Snapshot()
	state.Pending = remaining
	state.LastSuccessfulAt = time.Now().UTC()
	if err := persistAutoPricingState(state); err != nil {
		return fmt.Errorf("persist pricing review: %w", err)
	}
	publishAutoPricingState(state, next, true)
	return nil
}

func snapshotAutoPricingState() *autoPricingPersistentState {
	autoPricingStateMu.RLock()
	defer autoPricingStateMu.RUnlock()
	raw, _ := json.Marshal(autoPricingState)
	copy := newAutoPricingState()
	_ = json.Unmarshal(raw, copy)
	return copy
}

func publishAutoPricingState(state *autoPricingPersistentState, catalog *autopricing.Catalog, changed bool) {
	autoPricingStateMu.Lock()
	autoPricingState = state
	autoPricingStateMu.Unlock()
	autopricing.SetCatalog(catalog)
	if changed {
		model.InvalidatePricingCache()
	}
}

func recordAutoPricingFailure(state *autoPricingPersistentState, err error) error {
	state.LastError = err.Error()
	state.Source = "error"
	_ = persistAutoPricingState(state)
	autoPricingStateMu.Lock()
	autoPricingState = state
	autoPricingStateMu.Unlock()
	return err
}

func sameCatalogPrices(a, b *autopricing.CatalogSnapshot) bool {
	if a == nil || b == nil {
		return a == b
	}
	return reflect.DeepEqual(a.Records, b.Records)
}

func runAutoPricingRefreshLoop() {
	time.Sleep(10 * time.Second)
	for {
		setting := ratio_setting.GetAutoPricingSetting()
		if setting.Enabled {
			if err := SyncAutoPricingOnce(context.Background(), false); err != nil {
				common.SysError("auto pricing sync failed: " + err.Error())
			}
		}
		if !ratio_setting.GetAutoPricingSetting().Enabled {
			time.Sleep(time.Minute)
			continue
		}
		interval := ratio_setting.GetAutoPricingSetting().EffectiveCheckIntervalMinutes()
		time.Sleep(time.Duration(interval) * time.Minute)
	}
}

func validateAutoPricingURL(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", fmt.Errorf("invalid pricing catalog url: %w", err)
	}
	switch parsed.Scheme {
	case "https":
	case "http":
		common.SysError("auto pricing url uses plain HTTP; catalog contents can be tampered with in transit: " + parsed.Host)
	default:
		return "", fmt.Errorf("pricing catalog url must be http(s), got scheme %q", parsed.Scheme)
	}
	if parsed.Host == "" {
		return "", fmt.Errorf("pricing catalog url has no host")
	}
	return parsed.String(), nil
}

func autoPricingStatePath() string {
	return filepath.Join(".", autoPricingStateDir, autoPricingStateFile)
}
func autoPricingArchivePath() string {
	return filepath.Join(".", autoPricingStateDir, autoPricingArchiveFile)
}
func autoPricingCachePath() string   { return filepath.Join(".", autoPricingCacheFile) }
func autoPricingVersionPath() string { return filepath.Join(".", autoPricingVersionFile) }

func persistAutoPricingState(state *autoPricingPersistentState) error {
	raw, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return autoPricingWriteFileAtomic(autoPricingStatePath(), raw)
}

func autoPricingWriteFileAtomic(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tempPath := path + ".tmp"
	if err := os.WriteFile(tempPath, data, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	return nil
}

func loadAutoPricingFromDisk() bool {
	state, err := readAutoPricingState()
	if err != nil {
		common.SysError("auto pricing state is unusable: " + err.Error())
		return false
	}
	if state == nil {
		return loadLegacyAutoPricingCache()
	}
	active, err := autopricing.RestoreCatalog(state.Active)
	if err != nil {
		common.SysError("auto pricing active catalog is unusable: " + err.Error())
		return false
	}
	state.Source = "cache"
	autoPricingStateMu.Lock()
	autoPricingState = state
	autoPricingStateMu.Unlock()
	if active != nil {
		autopricing.SetCatalog(active)
		return true
	}
	return false
}

func readAutoPricingState() (*autoPricingPersistentState, error) {
	raw, err := os.ReadFile(autoPricingStatePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	state := newAutoPricingState()
	if err := json.Unmarshal(raw, state); err != nil {
		return nil, err
	}
	if state.SchemaVersion != 1 {
		return nil, fmt.Errorf("unsupported state schema version %d", state.SchemaVersion)
	}
	return state, nil
}

func loadLegacyAutoPricingCache() bool {
	body, err := os.ReadFile(autoPricingCachePath())
	if err != nil {
		return false
	}
	version := ""
	if raw, err := os.ReadFile(autoPricingVersionPath()); err == nil {
		version = strings.TrimSpace(string(raw))
	}
	catalog, err := autopricing.BuildCatalog(body, version)
	if err != nil {
		common.SysError("legacy auto pricing cache is unusable: " + err.Error())
		return false
	}
	state := newAutoPricingState()
	state.Active = catalog.Snapshot()
	state.Candidate = catalog.Snapshot()
	state.Source = "legacy-cache"
	_ = persistAutoPricingState(state)
	publishAutoPricingState(state, catalog, false)
	return true
}

func completeAutoPricingTakeover(state *autoPricingPersistentState, active *autopricing.CatalogSnapshot) error {
	var options []model.Option
	if err := model.DB.Where("key IN ?", takeoverOptionKeys).Find(&options).Error; err != nil {
		return fmt.Errorf("read legacy pricing options: %w", err)
	}
	archive := struct {
		ArchivedAt time.Time      `json:"archived_at"`
		Options    []model.Option `json:"options"`
	}{ArchivedAt: time.Now().UTC(), Options: options}
	raw, err := json.MarshalIndent(archive, "", "  ")
	if err != nil {
		return fmt.Errorf("encode legacy pricing archive: %w", err)
	}
	if err := autoPricingWriteFileAtomic(autoPricingArchivePath(), raw); err != nil {
		return fmt.Errorf("archive legacy pricing options: %w", err)
	}

	previousActive := state.Active
	state.Active = active
	state.TakeoverComplete = true
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("key IN ?", takeoverOptionKeys).Delete(&model.Option{}).Error; err != nil {
			return err
		}
		return persistAutoPricingState(state)
	}); err != nil {
		state.Active = previousActive
		state.TakeoverComplete = false
		_ = persistAutoPricingState(state)
		return fmt.Errorf("complete automatic pricing takeover: %w", err)
	}

	common.OptionMapRWMutex.Lock()
	for _, key := range takeoverOptionKeys {
		delete(common.OptionMap, key)
	}
	common.OptionMapRWMutex.Unlock()
	ratio_setting.ResetPricingForAutoCatalogTakeover()
	billing_setting.ResetPricingForAutoCatalogTakeover()
	return nil
}

type httpAutoPricingClient struct{}

func (c *httpAutoPricingClient) FetchCatalog(ctx context.Context, sourceURL, knownVersion string) ([]byte, string, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return nil, "", false, err
	}
	req.Header.Set("Accept", "application/json")
	if knownVersion != "" && !strings.HasPrefix(knownVersion, contentHashVersionPrefix) {
		req.Header.Set("If-None-Match", knownVersion)
	}
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return nil, "", false, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusNotModified {
		return nil, knownVersion, true, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", false, fmt.Errorf("unexpected status %s", resp.Status)
	}
	body, err := autoPricingReadBody(resp.Body, autoPricingMaxBytes)
	if err != nil {
		return nil, "", false, err
	}
	version := strings.TrimSpace(resp.Header.Get("ETag"))
	if version == "" {
		version = contentHashVersionPrefix + hex.EncodeToString(common.Sha256Raw(body))
	}
	return body, version, false, nil
}

func (c *httpAutoPricingClient) FetchChangeToken(ctx context.Context, sourceURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %s", resp.Status)
	}
	body, err := autoPricingReadBody(resp.Body, 4096)
	if err != nil {
		return "", err
	}
	fields := strings.Fields(string(body))
	if len(fields) == 0 {
		return "", nil
	}
	return fields[0], nil
}

func autoPricingReadBody(reader io.Reader, limit int64) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("response exceeds %d bytes", limit)
	}
	return body, nil
}
