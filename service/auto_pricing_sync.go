package service

import (
	"context"
	"encoding/hex"
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
	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const (
	// autoPricingDownloadTimeout bounds a single catalog fetch.
	autoPricingDownloadTimeout = 30 * time.Second
	// autoPricingHashTimeout bounds the small checksum fetch used for change
	// detection on mirrors without usable ETags.
	autoPricingHashTimeout = 10 * time.Second
	// autoPricingMaxBytes caps the response body. The upstream catalog is a few
	// megabytes; anything far beyond that is not the document we asked for.
	autoPricingMaxBytes = 32 << 20
	// autoPricingCacheFile lives in the working directory, which is the
	// persisted /data volume in the container image.
	autoPricingCacheFile   = "model_pricing_catalog.json"
	autoPricingVersionFile = "model_pricing_catalog.version"
	// contentHashVersionPrefix marks a change token we computed ourselves
	// because the server sent no ETag.
	contentHashVersionPrefix = "sha256:"
)

// autoPricingRemoteClient isolates the network so the sync logic can be tested
// without an upstream host.
type autoPricingRemoteClient interface {
	// FetchCatalog returns the document body and its change token. It returns
	// notModified when the server confirms knownVersion is still current, in
	// which case body is nil.
	FetchCatalog(ctx context.Context, url, knownVersion string) (body []byte, version string, notModified bool, err error)
	// FetchChangeToken returns the content of a checksum file.
	FetchChangeToken(ctx context.Context, url string) (string, error)
}

// AutoPricingStatus describes the loaded catalog for the admin API.
type AutoPricingStatus struct {
	Enabled           bool      `json:"enabled"`
	FuzzyMatchEnabled bool      `json:"fuzzy_match_enabled"`
	RemoteURL         string    `json:"remote_url"`
	HashURL           string    `json:"hash_url"`
	IntervalMinutes   int       `json:"check_interval_minutes"`
	Loaded            bool      `json:"loaded"`
	ModelCount        int       `json:"model_count"`
	SkippedCount      int       `json:"skipped_count"`
	Version           string    `json:"version"`
	UpdatedAt         time.Time `json:"updated_at,omitempty"`
	LastSyncAt        time.Time `json:"last_sync_at,omitempty"`
	LastError         string    `json:"last_error,omitempty"`
	Source            string    `json:"source,omitempty"`
}

var (
	autoPricingClient autoPricingRemoteClient = &httpAutoPricingClient{}

	// autoPricingSyncMu serializes whole sync runs. The background loop and the
	// admin force-sync endpoint can otherwise download concurrently and
	// interleave writes to the shared cache temp file.
	autoPricingSyncMu sync.Mutex

	autoPricingMu         sync.Mutex
	autoPricingLastSyncAt time.Time
	autoPricingLastError  string
	autoPricingSource     string
)

// InitAutoPricing loads the last downloaded catalog from disk so pricing is
// available before the first successful network fetch, then starts the
// background refresh loop.
func InitAutoPricing() {
	if loaded := loadAutoPricingFromDisk(); loaded {
		common.SysLog("auto pricing catalog restored from local cache")
	}
	go runAutoPricingRefreshLoop()
}

// SyncAutoPricingOnce downloads the catalog when it changed upstream. With
// force set, the cached change token is ignored and the document is downloaded
// and reparsed unconditionally.
//
// A failure leaves the currently loaded catalog in place: stale pricing is far
// better than losing the fallback while an upstream host is unreachable.
func SyncAutoPricingOnce(ctx context.Context, force bool) error {
	autoPricingSyncMu.Lock()
	defer autoPricingSyncMu.Unlock()

	setting := ratio_setting.GetAutoPricingSetting()
	catalogURL, err := validateAutoPricingURL(setting.AutoPricingRemoteURL())
	if err != nil {
		recordAutoPricingSync(err.Error(), "")
		return err
	}

	knownVersion := ""
	if !force {
		if catalog := autopricing.CurrentCatalog(); catalog != nil {
			knownVersion = catalog.Version
		}
	}

	// A checksum file is the change token for mirrors that do not serve
	// meaningful ETags. When it matches, the document is not downloaded at all.
	hashToken := ""
	if hashURL := strings.TrimSpace(setting.HashURL); hashURL != "" {
		if validatedHashURL, hashErr := validateAutoPricingURL(hashURL); hashErr != nil {
			common.SysError("auto pricing checksum url is invalid, skipping change detection: " + hashErr.Error())
		} else {
			hashCtx, cancel := context.WithTimeout(ctx, autoPricingHashTimeout)
			remoteToken, err := autoPricingClient.FetchChangeToken(hashCtx, validatedHashURL)
			cancel()
			if err != nil {
				common.SysError("auto pricing change token fetch failed: " + err.Error())
			} else {
				hashToken = remoteToken
				storedToken := strings.TrimPrefix(knownVersion, contentHashVersionPrefix)
				if remoteToken != "" && storedToken != "" && strings.EqualFold(remoteToken, storedToken) {
					recordAutoPricingSync("", "unchanged")
					return nil
				}
			}
		}
	}

	downloadCtx, cancel := context.WithTimeout(ctx, autoPricingDownloadTimeout)
	defer cancel()

	body, version, notModified, err := autoPricingClient.FetchCatalog(downloadCtx, catalogURL, knownVersion)
	if err != nil {
		wrapped := fmt.Errorf("download pricing catalog: %w", err)
		recordAutoPricingSync(wrapped.Error(), "")
		return wrapped
	}
	if notModified {
		recordAutoPricingSync("", "unchanged")
		return nil
	}
	// With a checksum file configured, the published hash is the token future
	// runs compare against, so it must be what gets stored.
	if hashToken != "" {
		version = contentHashVersionPrefix + hashToken
	}

	catalog, err := autopricing.BuildCatalog(body, version)
	if err != nil {
		wrapped := fmt.Errorf("parse pricing catalog: %w", err)
		recordAutoPricingSync(wrapped.Error(), "")
		return wrapped
	}

	autopricing.SetCatalog(catalog)
	recordAutoPricingSync("", "remote")
	persistAutoPricingCatalog(body, version)

	common.SysLog(fmt.Sprintf("auto pricing catalog updated: %d models priced, %d entries skipped",
		catalog.ModelCount, catalog.SkippedCount))
	return nil
}

// GetAutoPricingStatus reports the live catalog state for the admin API.
func GetAutoPricingStatus() AutoPricingStatus {
	setting := ratio_setting.GetAutoPricingSetting()
	status := AutoPricingStatus{
		Enabled:           setting.Enabled,
		FuzzyMatchEnabled: setting.FuzzyMatchEnabled,
		RemoteURL:         setting.AutoPricingRemoteURL(),
		HashURL:           setting.HashURL,
		IntervalMinutes:   setting.EffectiveCheckIntervalMinutes(),
	}

	if catalog := autopricing.CurrentCatalog(); catalog != nil {
		status.Loaded = catalog.ModelCount > 0
		status.ModelCount = catalog.ModelCount
		status.SkippedCount = catalog.SkippedCount
		status.Version = catalog.Version
		status.UpdatedAt = catalog.UpdatedAt
	}

	autoPricingMu.Lock()
	status.LastSyncAt = autoPricingLastSyncAt
	status.LastError = autoPricingLastError
	status.Source = autoPricingSource
	autoPricingMu.Unlock()

	return status
}

func recordAutoPricingSync(errMessage, source string) {
	autoPricingMu.Lock()
	defer autoPricingMu.Unlock()
	autoPricingLastSyncAt = time.Now()
	autoPricingLastError = errMessage
	if source != "" {
		autoPricingSource = source
	}
}

// runAutoPricingRefreshLoop checks for catalog changes on the configured
// interval. The setting is re-read every tick so toggling the feature or the
// interval takes effect without a restart.
func runAutoPricingRefreshLoop() {
	// Give startup work priority over a network fetch nobody is waiting for.
	time.Sleep(10 * time.Second)

	for {
		setting := ratio_setting.GetAutoPricingSetting()
		if setting.Enabled {
			if err := SyncAutoPricingOnce(context.Background(), false); err != nil {
				common.SysError("auto pricing sync failed: " + err.Error())
			}
		}

		if !ratio_setting.GetAutoPricingSetting().Enabled {
			// While disabled, only the flag needs watching. Waiting the full
			// interval here would delay enablement by up to a week on a large
			// interval; a short poll keeps the toggle responsive.
			time.Sleep(time.Minute)
			continue
		}
		// Re-read after the sync so an interval change shortens the next wait.
		interval := ratio_setting.GetAutoPricingSetting().EffectiveCheckIntervalMinutes()
		time.Sleep(time.Duration(interval) * time.Minute)
	}
}

// validateAutoPricingURL rejects URLs the catalog fetcher should never touch.
// Pricing data feeds billing, so a plaintext transport is loudly flagged even
// though it stays allowed for intranet mirrors, matching the manual upstream
// ratio sync which also accepts http hosts.
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

func autoPricingCachePath() string {
	return filepath.Join(".", autoPricingCacheFile)
}

func autoPricingVersionPath() string {
	return filepath.Join(".", autoPricingVersionFile)
}

// persistAutoPricingCatalog keeps the last good document on disk so a restart
// during an upstream outage still has pricing. Failures are logged and ignored:
// the in-memory catalog is already live.
func persistAutoPricingCatalog(body []byte, version string) {
	if err := autoPricingWriteFileAtomic(autoPricingCachePath(), body); err != nil {
		common.SysError("auto pricing cache write failed: " + err.Error())
		return
	}
	if err := autoPricingWriteFileAtomic(autoPricingVersionPath(), []byte(version)); err != nil {
		common.SysError("auto pricing version write failed: " + err.Error())
	}
}

// autoPricingWriteFileAtomic replaces a file through a temp file and rename so a reader,
// or a second instance sharing the data volume, never observes a half-written
// catalog.
func autoPricingWriteFileAtomic(path string, data []byte) error {
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
	body, err := os.ReadFile(autoPricingCachePath())
	if err != nil {
		if !os.IsNotExist(err) {
			common.SysError("auto pricing cache read failed: " + err.Error())
		}
		return false
	}

	version := ""
	if raw, err := os.ReadFile(autoPricingVersionPath()); err == nil {
		version = strings.TrimSpace(string(raw))
	}

	catalog, err := autopricing.BuildCatalog(body, version)
	if err != nil {
		common.SysError("auto pricing cache is unusable: " + err.Error())
		return false
	}

	autopricing.SetCatalog(catalog)
	recordAutoPricingSync("", "cache")
	return true
}

// httpAutoPricingClient fetches the catalog over plain HTTPS.
//
// The catalog URL is root-configured deployment configuration rather than
// user-supplied input, so it uses the shared outbound client like other
// operator-configured endpoints.
type httpAutoPricingClient struct{}

func (c *httpAutoPricingClient) FetchCatalog(ctx context.Context, url, knownVersion string) ([]byte, string, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", false, err
	}
	req.Header.Set("Accept", "application/json")
	// Conditional GET keeps a routine check to a single small response when the
	// document has not changed. Content-hash tokens are ours, not the server's,
	// so they must never be sent back as an entity tag.
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
		// Without an ETag the content hash becomes the change token, so the
		// next run can still tell an unchanged document from a new one.
		version = contentHashVersionPrefix + hex.EncodeToString(common.Sha256Raw(body))
	}
	return body, version, false, nil
}

func (c *httpAutoPricingClient) FetchChangeToken(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
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

	// Checksum files are published either bare or in "hash  filename" form.
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
