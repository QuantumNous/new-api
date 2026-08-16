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
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const (
	autoPricingDownloadTimeout = 30 * time.Second
	autoPricingHashTimeout     = 10 * time.Second
	autoPricingMaxBytes        = 32 << 20
	autoPricingCacheFile       = "model_pricing_catalog.v2.json"
	contentHashVersionPrefix   = "sha256:"
	sha256HexLength            = 64
)

type autoPricingRemoteClient interface {
	FetchCatalog(ctx context.Context, url, knownVersion string) ([]byte, string, bool, error)
	FetchChangeToken(ctx context.Context, url string) (string, error)
}

// autoPricingMultiSourceClient is optional so existing integrations that
// implement the original client interface continue to work as LiteLLM-only
// clients. The production client implements both methods.
type autoPricingMultiSourceClient interface {
	FetchCatalogForSource(ctx context.Context, source, url, knownVersion string) ([]byte, string, bool, error)
	FetchChangeTokenForSource(ctx context.Context, source, url string) (string, error)
}

type autoPricingSourceSnapshot struct {
	Name         string                    `json:"name"`
	URL          string                    `json:"url"`
	HashURL      string                    `json:"hash_url,omitempty"`
	Version      string                    `json:"version"`
	Entries      autopricing.SourceEntries `json:"entries"`
	ModelCount   int                       `json:"model_count"`
	SkippedCount int                       `json:"skipped_count"`
	UpdatedAt    time.Time                 `json:"updated_at,omitempty"`
	LastSyncAt   time.Time                 `json:"last_sync_at,omitempty"`
	LastError    string                    `json:"last_error,omitempty"`
	State        string                    `json:"state"`
}

type autoPricingSnapshot struct {
	SchemaVersion        int                                  `json:"schema_version"`
	Version              string                               `json:"version"`
	UpdatedAt            time.Time                            `json:"updated_at"`
	Entries              autopricing.SourceEntries            `json:"entries"`
	Sources              map[string]autoPricingSourceSnapshot `json:"sources"`
	ModelsDevSupplements int                                  `json:"models_dev_supplements"`
	State                string                               `json:"state"`
}

type AutoPricingSourceStatus struct {
	Name         string    `json:"name"`
	URL          string    `json:"url"`
	HashURL      string    `json:"hash_url,omitempty"`
	Version      string    `json:"version,omitempty"`
	Loaded       bool      `json:"loaded"`
	ModelCount   int       `json:"model_count"`
	SkippedCount int       `json:"skipped_count"`
	State        string    `json:"state"`
	UpdatedAt    time.Time `json:"updated_at,omitempty"`
	LastSyncAt   time.Time `json:"last_sync_at,omitempty"`
	LastError    string    `json:"last_error,omitempty"`
}

type AutoPricingStatus struct {
	Enabled                  bool                      `json:"enabled"`
	FuzzyMatchEnabled        bool                      `json:"fuzzy_match_enabled"`
	RemoteURL                string                    `json:"remote_url"`
	HashURL                  string                    `json:"hash_url"`
	ModelsDevURL             string                    `json:"models_dev_url"`
	IntervalMinutes          int                       `json:"check_interval_minutes"`
	Loaded                   bool                      `json:"loaded"`
	ModelCount               int                       `json:"model_count"`
	SkippedCount             int                       `json:"skipped_count"`
	Version                  string                    `json:"version"`
	UpdatedAt                time.Time                 `json:"updated_at,omitempty"`
	LastSyncAt               time.Time                 `json:"last_sync_at,omitempty"`
	LastError                string                    `json:"last_error,omitempty"`
	Source                   string                    `json:"source,omitempty"`
	State                    string                    `json:"state"`
	PrimaryModelCount        int                       `json:"primary_model_count"`
	SecondaryModelCount      int                       `json:"secondary_model_count"`
	SecondarySupplementCount int                       `json:"secondary_supplement_count"`
	Sources                  []AutoPricingSourceStatus `json:"sources"`
}

var (
	autoPricingClient       autoPricingRemoteClient = &httpAutoPricingClient{}
	autoPricingSyncMu       sync.Mutex
	autoPricingMu           sync.Mutex
	autoPricingSnapshotLive *autoPricingSnapshot
	autoPricingLastSyncAt   time.Time
	autoPricingLastError    string
	autoPricingSource       string
)

func InitAutoPricing() {
	if loadAutoPricingFromDisk() {
		common.SysLog("auto pricing catalog restored from local cache")
	}
	go runAutoPricingRefreshLoop()
}

func SyncAutoPricingOnce(ctx context.Context, force bool) error {
	autoPricingSyncMu.Lock()
	defer autoPricingSyncMu.Unlock()
	setting := ratio_setting.GetAutoPricingSetting()

	previous := liveSnapshot()
	if previous == nil {
		previous = &autoPricingSnapshot{SchemaVersion: 2, Sources: make(map[string]autoPricingSourceSnapshot)}
	}
	multi, dual := autoPricingClient.(autoPricingMultiSourceClient)
	type sourceConfig struct{ name, url, hashURL string }
	sources := []sourceConfig{{"litellm", setting.AutoPricingRemoteURL(), setting.EffectiveHashURL()}}
	if dual {
		sources = append(sources, sourceConfig{"models.dev", setting.ModelsDevRemoteURL(), ""})
	}

	updated := &autoPricingSnapshot{SchemaVersion: 2, Sources: cloneSourceSnapshots(previous.Sources), UpdatedAt: previous.UpdatedAt}
	var successes int
	var errorsSeen []string
	for _, cfg := range sources {
		old := updated.Sources[cfg.name]
		previousURL := old.URL
		old.Name, old.URL, old.HashURL = cfg.name, cfg.url, cfg.hashURL
		old.LastSyncAt = time.Now()
		var sourceErrors []string
		validatedURL, urlErr := validateAutoPricingURL(cfg.url)
		if urlErr != nil {
			old.State, old.LastError = "unavailable", urlErr.Error()
			updated.Sources[cfg.name] = old
			errorsSeen = append(errorsSeen, cfg.name+": "+urlErr.Error())
			continue
		}
		cfg.url = validatedURL
		old.URL = validatedURL
		urlChanged := previousURL != "" && previousURL != validatedURL
		if cfg.hashURL != "" {
			if validatedHash, hashErr := validateAutoPricingURL(cfg.hashURL); hashErr == nil {
				cfg.hashURL = validatedHash
				old.HashURL = validatedHash
			} else {
				sourceErrors = append(sourceErrors, hashErr.Error())
				errorsSeen = append(errorsSeen, cfg.name+": "+hashErr.Error())
				cfg.hashURL = ""
			}
		}
		known := ""
		if !force && !urlChanged {
			known = old.Version
		}
		var body []byte
		var version string
		var notModified bool
		var err error
		hashToken := ""
		hashTokenValid := false
		checksumInvalid := false
		if cfg.hashURL != "" {
			hashCtx, cancel := context.WithTimeout(ctx, autoPricingHashTimeout)
			var token string
			var hashErr error
			if dual {
				token, hashErr = multi.FetchChangeTokenForSource(hashCtx, cfg.name, cfg.hashURL)
			} else {
				token, hashErr = autoPricingClient.FetchChangeToken(hashCtx, cfg.hashURL)
			}
			cancel()
			if hashErr != nil {
				sourceErrors = append(sourceErrors, "checksum: "+hashErr.Error())
				errorsSeen = append(errorsSeen, cfg.name+": checksum: "+hashErr.Error())
			} else {
				hashToken, hashTokenValid = normalizeSHA256Token(token)
				if !hashTokenValid {
					errMessage := "checksum: response is not a SHA256 digest"
					sourceErrors = append(sourceErrors, errMessage)
					errorsSeen = append(errorsSeen, cfg.name+": "+errMessage)
					checksumInvalid = true
				}
			}
			if checksumInvalid {
				old.State, old.LastError = "stale", strings.Join(sourceErrors, "; ")
				if len(old.Entries) == 0 {
					old.State = "unavailable"
				}
				updated.Sources[cfg.name] = old
				continue
			}
			if hashTokenValid && strings.EqualFold(strings.TrimPrefix(known, contentHashVersionPrefix), hashToken) && len(old.Entries) > 0 {
				old.State = "unchanged"
				old.LastError = strings.Join(sourceErrors, "; ")
				updated.Sources[cfg.name] = old
				successes++
				continue
			}
		}
		downloadCtx, cancel := context.WithTimeout(ctx, autoPricingDownloadTimeout)
		if dual {
			body, version, notModified, err = multi.FetchCatalogForSource(downloadCtx, cfg.name, cfg.url, known)
		} else {
			body, version, notModified, err = autoPricingClient.FetchCatalog(downloadCtx, cfg.url, known)
		}
		cancel()
		if err != nil {
			sourceErrors = append(sourceErrors, "download: "+err.Error())
			errorsSeen = append(errorsSeen, cfg.name+": download: "+err.Error())
			old.State, old.LastError = "stale", strings.Join(sourceErrors, "; ")
			if len(old.Entries) == 0 {
				old.State = "unavailable"
			}
			updated.Sources[cfg.name] = old
			continue
		}
		// When the upstream has no ETag, the HTTP client returns a content
		// SHA256 as the version. A second body fetch is unavoidable, but an
		// identical digest still means the source is unchanged and does not need
		// to be reparsed or replace the catalog timestamp.
		if !notModified && !urlChanged && cfg.hashURL == "" && !hashTokenValid && known != "" && version != "" &&
			strings.EqualFold(version, known) && len(old.Entries) > 0 {
			old.State, old.LastError = "unchanged", strings.Join(sourceErrors, "; ")
			updated.Sources[cfg.name] = old
			successes++
			continue
		}
		if notModified && !urlChanged && len(old.Entries) > 0 {
			old.State, old.LastError = "unchanged", strings.Join(sourceErrors, "; ")
			updated.Sources[cfg.name] = old
			successes++
			continue
		}
		var entries autopricing.SourceEntries
		var skipped int
		if cfg.name == "models.dev" {
			entries, skipped, err = autopricing.ParseModelsDev(body)
		} else {
			entries, skipped, err = autopricing.ParseLiteLLM(body)
		}
		if err != nil {
			sourceErrors = append(sourceErrors, "parse: "+err.Error())
			errorsSeen = append(errorsSeen, cfg.name+": parse: "+err.Error())
			old.State, old.LastError = "stale", strings.Join(sourceErrors, "; ")
			if len(old.Entries) == 0 {
				old.State = "unavailable"
			}
			updated.Sources[cfg.name] = old
			continue
		}
		if hashTokenValid {
			actualHash := hex.EncodeToString(common.Sha256Raw(body))
			if !strings.EqualFold(actualHash, hashToken) {
				errMessage := fmt.Sprintf("checksum: body digest %s does not match %s", actualHash, hashToken)
				sourceErrors = append(sourceErrors, errMessage)
				errorsSeen = append(errorsSeen, cfg.name+": "+errMessage)
				old.State, old.LastError = "stale", strings.Join(sourceErrors, "; ")
				if len(old.Entries) == 0 {
					old.State = "unavailable"
				}
				updated.Sources[cfg.name] = old
				continue
			}
			version = contentHashVersionPrefix + hashToken
		}
		old.Version, old.Entries, old.ModelCount, old.SkippedCount = version, entries, len(entries), skipped
		old.UpdatedAt, old.State, old.LastError = time.Now(), "current", strings.Join(sourceErrors, "; ")
		if len(sourceErrors) > 0 {
			// A usable document was loaded, but checksum metadata was degraded.
			// Keep the source current while exposing the warning to operators.
			old.State = "current"
		}
		updated.Sources[cfg.name] = old
		successes++
	}

	primary := updated.Sources["litellm"].Entries
	secondary := updated.Sources["models.dev"].Entries
	merged, supplements := autopricing.MergeEntries(primary, secondary)
	if len(merged) == 0 && len(previous.Entries) > 0 {
		merged, supplements = previous.Entries, previous.ModelsDevSupplements
	}
	if len(merged) == 0 {
		if len(errorsSeen) == 0 {
			errorsSeen = append(errorsSeen, "no usable pricing source")
		}
		updated.Entries, updated.Version, updated.ModelsDevSupplements, updated.State = nil, mergedSourceVersion(updated.Sources), 0, "unavailable"
		setLiveSnapshot(updated)
		if err := persistAutoPricingSnapshot(updated); err != nil {
			common.SysError("auto pricing failure snapshot write failed: " + err.Error())
		}
		errMessage := strings.Join(errorsSeen, "; ")
		recordAutoPricingSync(errMessage, "unavailable")
		return fmt.Errorf("automatic pricing sync failed: %s", errMessage)
	}
	allUnchanged := successes == len(sources)
	for _, cfg := range sources {
		if updated.Sources[cfg.name].State != "unchanged" {
			allUnchanged = false
			break
		}
	}
	version := mergedSourceVersion(updated.Sources)
	if !dual {
		version = updated.Sources["litellm"].Version
	}
	updated.Entries, updated.Version, updated.ModelsDevSupplements = merged, version, supplements
	// updated_at describes the catalog data, not this health check. Preserve the
	// previous timestamp when both sources are unchanged or unavailable.
	for _, source := range updated.Sources {
		if source.UpdatedAt.After(updated.UpdatedAt) {
			updated.UpdatedAt = source.UpdatedAt
		}
	}
	if updated.UpdatedAt.IsZero() {
		updated.UpdatedAt = time.Now()
	}
	catalog := autopricing.BuildCatalogFromEntries(merged, version, updated.Sources["litellm"].SkippedCount+updated.Sources["models.dev"].SkippedCount)
	if !autopricing.Loaded() || previous.Version != version || updated.UpdatedAt.After(previous.UpdatedAt) {
		publishAutoPricingCatalog(catalog)
	}
	catalogState := "current"
	if allUnchanged {
		catalogState = "unchanged"
	} else if len(errorsSeen) > 0 || successes == 0 {
		catalogState = "stale"
	}
	effectiveSource := "remote"
	if dual {
		effectiveSource = "merged"
	}
	if allUnchanged {
		effectiveSource = "unchanged"
	}
	updated.State = catalogState
	setLiveSnapshot(updated)
	if err := persistAutoPricingSnapshot(updated); err != nil {
		common.SysError("auto pricing cache write failed: " + err.Error())
	}
	recordAutoPricingSync(strings.Join(errorsSeen, "; "), effectiveSource)
	if successes == 0 {
		return fmt.Errorf("automatic pricing sync failed: %s", strings.Join(errorsSeen, "; "))
	}
	return nil
}

func normalizeSHA256Token(raw string) (string, bool) {
	fields := strings.Fields(raw)
	if len(fields) == 0 {
		return "", false
	}
	token := strings.TrimSpace(fields[0])
	token = strings.TrimPrefix(strings.ToLower(token), contentHashVersionPrefix)
	if len(token) != sha256HexLength {
		return "", false
	}
	for _, char := range token {
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f')) {
			return "", false
		}
	}
	return token, true
}

func cloneSourceSnapshots(input map[string]autoPricingSourceSnapshot) map[string]autoPricingSourceSnapshot {
	output := make(map[string]autoPricingSourceSnapshot, len(input))
	for key, value := range input {
		output[key] = value
	}
	return output
}
func mergedSourceVersion(sources map[string]autoPricingSourceSnapshot) string {
	keys := []string{"litellm", "models.dev"}
	var parts []string
	for _, key := range keys {
		if source, ok := sources[key]; ok && source.Version != "" {
			parts = append(parts, key+"="+source.Version)
		}
	}
	return strings.Join(parts, ";")
}
func liveSnapshot() *autoPricingSnapshot {
	autoPricingMu.Lock()
	defer autoPricingMu.Unlock()
	return cloneSnapshot(autoPricingSnapshotLive)
}
func setLiveSnapshot(snapshot *autoPricingSnapshot) {
	autoPricingMu.Lock()
	autoPricingSnapshotLive = cloneSnapshot(snapshot)
	autoPricingMu.Unlock()
}

func publishAutoPricingCatalog(catalog *autopricing.Catalog) {
	autopricing.SetCatalog(catalog)
	model.InvalidatePricingCache()
}

func cloneSnapshot(snapshot *autoPricingSnapshot) *autoPricingSnapshot {
	if snapshot == nil {
		return nil
	}
	copy := *snapshot
	copy.Sources = cloneSourceSnapshots(snapshot.Sources)
	return &copy
}

func GetAutoPricingStatus() AutoPricingStatus {
	setting := ratio_setting.GetAutoPricingSetting()
	status := AutoPricingStatus{Enabled: setting.Enabled, FuzzyMatchEnabled: setting.FuzzyMatchEnabled, RemoteURL: setting.AutoPricingRemoteURL(), HashURL: setting.EffectiveHashURL(), ModelsDevURL: setting.ModelsDevRemoteURL(), IntervalMinutes: setting.EffectiveCheckIntervalMinutes(), State: "unavailable"}
	snapshot := liveSnapshot()
	if snapshot != nil {
		status.Loaded, status.ModelCount, status.Version, status.UpdatedAt = len(snapshot.Entries) > 0, len(snapshot.Entries), snapshot.Version, snapshot.UpdatedAt
		for _, source := range snapshot.Sources {
			status.SkippedCount += source.SkippedCount
		}
		status.SecondarySupplementCount = snapshot.ModelsDevSupplements
		for _, name := range []string{"litellm", "models.dev"} {
			if source, ok := snapshot.Sources[name]; ok {
				status.Sources = append(status.Sources, AutoPricingSourceStatus{Name: source.Name, URL: source.URL, HashURL: source.HashURL, Version: source.Version, Loaded: len(source.Entries) > 0, ModelCount: source.ModelCount, SkippedCount: source.SkippedCount, State: source.State, UpdatedAt: source.UpdatedAt, LastSyncAt: source.LastSyncAt, LastError: source.LastError})
				if name == "litellm" {
					status.PrimaryModelCount = source.ModelCount
				}
				if name == "models.dev" {
					status.SecondaryModelCount = source.ModelCount
				}
			}
		}
		if snapshot.State != "" {
			status.State = snapshot.State
		} else {
			status.State = "current"
			for _, source := range status.Sources {
				if source.State == "stale" || source.State == "unavailable" {
					status.State = source.State
				}
			}
		}
	}
	// Keep the status contract useful before the first sync and when restoring a
	// snapshot written by an older single-source client: both configured sources
	// are always represented, even if neither has produced entries yet.
	knownSources := make(map[string]struct{}, len(status.Sources))
	for _, source := range status.Sources {
		knownSources[source.Name] = struct{}{}
	}
	configuredSources := []AutoPricingSourceStatus{{Name: "litellm", URL: status.RemoteURL, HashURL: status.HashURL, State: "unavailable"}}
	if _, dual := autoPricingClient.(autoPricingMultiSourceClient); dual {
		configuredSources = append(configuredSources, AutoPricingSourceStatus{Name: "models.dev", URL: status.ModelsDevURL, State: "unavailable"})
	}
	for _, source := range configuredSources {
		if _, exists := knownSources[source.Name]; exists {
			continue
		}
		status.Sources = append(status.Sources, source)
	}
	if snapshot != nil && status.State == "current" {
		for _, source := range status.Sources {
			if source.State == "unavailable" {
				status.State = "stale"
				break
			}
		}
	}
	autoPricingMu.Lock()
	status.LastSyncAt, status.LastError, status.Source = autoPricingLastSyncAt, autoPricingLastError, autoPricingSource
	autoPricingMu.Unlock()
	return status
}

func recordAutoPricingSync(errMessage, source string) {
	autoPricingMu.Lock()
	defer autoPricingMu.Unlock()
	autoPricingLastSyncAt, autoPricingLastError = time.Now(), errMessage
	if source != "" {
		autoPricingSource = source
	}
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
		time.Sleep(time.Duration(ratio_setting.GetAutoPricingSetting().EffectiveCheckIntervalMinutes()) * time.Minute)
	}
}

func autoPricingCachePath() string { return filepath.Join(".", autoPricingCacheFile) }

func persistAutoPricingSnapshot(snapshot *autoPricingSnapshot) error {
	data, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}
	return autoPricingWriteFileAtomic(autoPricingCachePath(), data)
}
func autoPricingWriteFileAtomic(path string, data []byte) error {
	temp := path + ".tmp"
	if err := os.WriteFile(temp, data, 0o600); err != nil {
		return err
	}
	if err := os.Rename(temp, path); err != nil {
		_ = os.Remove(temp)
		return err
	}
	return nil
}

func loadAutoPricingFromDisk() bool {
	data, err := os.ReadFile(autoPricingCachePath())
	if err != nil {
		return false
	}
	var snapshot autoPricingSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil || snapshot.SchemaVersion != 2 || len(snapshot.Entries) == 0 {
		return false
	}
	if snapshot.Sources == nil {
		snapshot.Sources = make(map[string]autoPricingSourceSnapshot)
	}
	publishAutoPricingCatalog(autopricing.BuildCatalogFromEntries(snapshot.Entries, snapshot.Version, 0))
	setLiveSnapshot(&snapshot)
	recordAutoPricingSync("", "cache")
	return true
}

func validateAutoPricingURL(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", fmt.Errorf("invalid pricing catalog url: %w", err)
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return "", fmt.Errorf("pricing catalog url must be http(s), got scheme %q", parsed.Scheme)
	}
	if parsed.Host == "" {
		return "", fmt.Errorf("pricing catalog url has no host")
	}
	return parsed.String(), nil
}

type httpAutoPricingClient struct{}

func (c *httpAutoPricingClient) FetchCatalog(ctx context.Context, target, knownVersion string) ([]byte, string, bool, error) {
	return c.fetchCatalog(ctx, target, knownVersion)
}
func (c *httpAutoPricingClient) FetchCatalogForSource(ctx context.Context, _, target, knownVersion string) ([]byte, string, bool, error) {
	return c.fetchCatalog(ctx, target, knownVersion)
}
func (c *httpAutoPricingClient) fetchCatalog(ctx context.Context, target, knownVersion string) ([]byte, string, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
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
	defer resp.Body.Close()
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
func (c *httpAutoPricingClient) FetchChangeToken(ctx context.Context, target string) (string, error) {
	return c.fetchChangeToken(ctx, target)
}
func (c *httpAutoPricingClient) FetchChangeTokenForSource(ctx context.Context, _, target string) (string, error) {
	return c.fetchChangeToken(ctx, target)
}
func (c *httpAutoPricingClient) fetchChangeToken(ctx context.Context, target string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return "", err
	}
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
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
