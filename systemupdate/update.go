package systemupdate

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// CurrentVersion is the running binary version.
// Prefer SetCurrentVersion for concurrent-safe updates after InitEnv.
var CurrentVersion = "v0.0.0"

// runningVer mirrors CurrentVersion for concurrent-safe reads/writes.
var runningVer atomic.Value // string

const (
	defaultUpdateGitHubRepo = "Calcium-Ion/new-api"
	maxUpdateDownloadSize   = 500 * 1024 * 1024
	maxRollbackVersions     = 3
	rollbackFetchPageSize   = 15
	updateCacheTTL          = 20 * time.Minute
	githubAPITimeout        = 30 * time.Second
	githubDownloadTimeout   = 10 * time.Minute
)

var (
	ErrNoUpdateAvailable         = errors.New("no update available; current version is latest")
	ErrRollbackVersionNotAllowed = errors.New("version is not in the allowed rollback list")
	ErrUpdateNotSupportedEnv     = errors.New("in-place binary update is not supported in this environment")
	ErrNoBackupFound             = errors.New("no backup found")
)

// UpdateInfo is returned by the check-update API.
type UpdateInfo struct {
	CurrentVersion string       `json:"current_version"`
	LatestVersion  string       `json:"latest_version"`
	HasUpdate      bool         `json:"has_update"`
	ReleaseInfo    *ReleaseInfo `json:"release_info,omitempty"`
	Cached         bool         `json:"cached"`
	Warning        string       `json:"warning,omitempty"`
	// DeployMode: "binary" | "docker" | "unknown"
	DeployMode string `json:"deploy_mode"`
	// CanApply indicates whether PerformUpdate can replace the local binary.
	CanApply bool `json:"can_apply"`
}

// ReleaseInfo holds GitHub release metadata for the UI.
type ReleaseInfo struct {
	Name        string         `json:"name"`
	Body        string         `json:"body"`
	PublishedAt string         `json:"published_at"`
	HTMLURL     string         `json:"html_url"`
	Assets      []ReleaseAsset `json:"assets,omitempty"`
}

// ReleaseAsset is a downloadable release file.
type ReleaseAsset struct {
	Name        string `json:"name"`
	DownloadURL string `json:"download_url"`
	Size        int64  `json:"size"`
}

// RollbackVersion describes an older release that can be re-installed.
type RollbackVersion struct {
	Version     string `json:"version"`
	PublishedAt string `json:"published_at"`
	HTMLURL     string `json:"html_url"`
}

type githubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
	HTMLURL     string `json:"html_url"`
	Draft       bool   `json:"draft"`
	Prerelease  bool   `json:"prerelease"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Size               int64  `json:"size"`
	} `json:"assets"`
}

type updateCacheEntry struct {
	info      *UpdateInfo
	expiresAt time.Time
}

// SystemUpdateService implements in-place binary updates similar to Sub2API.
type SystemUpdateService struct {
	repo       string
	token      string
	apiClient  *http.Client
	dlClient   *http.Client
	cacheMu    sync.Mutex
	cache      *updateCacheEntry
	// cacheGen increments whenever currentVer changes; CheckUpdate only caches if gen is stable.
	cacheGen   uint64
	currentVer string
	// opMu serializes apply/rollback so concurrent renames cannot corrupt the binary.
	opMu sync.Mutex
}

// defaultSystemUpdateService is published via atomic.Pointer so SetCurrentVersion
// and GetSystemUpdateService can observe initialization without data races.
var defaultSystemUpdateService atomic.Pointer[SystemUpdateService]
var systemUpdateOnce sync.Once

func init() {
	runningVer.Store(CurrentVersion)
}

// SetCurrentVersion updates the running version in a concurrency-safe way.
// Call after common.InitEnv() when VERSION is finalized.
func SetCurrentVersion(v string) {
	v = strings.TrimSpace(v)
	if v == "" {
		return
	}
	runningVer.Store(v)
	// Diagnostic mirror only; concurrent readers should use runningVer / the service.
	CurrentVersion = v

	// Load via atomic.Pointer so we never race with GetSystemUpdateService init.
	if s := defaultSystemUpdateService.Load(); s != nil {
		s.cacheMu.Lock()
		if s.currentVer != v {
			s.currentVer = v
			s.cache = nil
			s.cacheGen++
		}
		s.cacheMu.Unlock()
	}
}

// GetSystemUpdateService returns the process-wide update service.
// Set CurrentVersion (e.g. from common.Version after InitEnv) before calling handlers.
func GetSystemUpdateService() *SystemUpdateService {
	systemUpdateOnce.Do(func() {
		repo := strings.TrimSpace(os.Getenv("NEW_API_UPDATE_GITHUB_REPO"))
		if repo == "" {
			repo = defaultUpdateGitHubRepo
		}
		ver := CurrentVersion
		if stored, ok := runningVer.Load().(string); ok && strings.TrimSpace(stored) != "" {
			ver = stored
		}
		s := &SystemUpdateService{
			repo:  repo,
			token: strings.TrimSpace(os.Getenv("UPDATE_GITHUB_TOKEN")),
			apiClient: &http.Client{
				Timeout: githubAPITimeout,
			},
			dlClient: &http.Client{
				Timeout: githubDownloadTimeout,
			},
			currentVer: ver,
		}
		defaultSystemUpdateService.Store(s)
	})
	s := defaultSystemUpdateService.Load()
	// Refresh under cacheMu so concurrent checks cannot race with version/cache reads.
	// Invalidate cache when the version changes so HasUpdate is not stale.
	if v, ok := runningVer.Load().(string); ok {
		v = strings.TrimSpace(v)
		if v != "" {
			s.cacheMu.Lock()
			if s.currentVer != v {
				s.currentVer = v
				s.cache = nil
				s.cacheGen++
			}
			s.cacheMu.Unlock()
		}
	}
	return s
}

// currentVersion returns the service's running version under cacheMu.
func (s *SystemUpdateService) currentVersion() string {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	return s.currentVer
}

func (s *SystemUpdateService) cacheGeneration() uint64 {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	return s.cacheGen
}

// DetectDeployMode returns binary / docker / unknown.
func DetectDeployMode() string {
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return "docker"
	}
	// cgroup hint (linux containers without /.dockerenv)
	if data, err := os.ReadFile("/proc/1/cgroup"); err == nil {
		content := string(data)
		if strings.Contains(content, "docker") || strings.Contains(content, "kubepods") || strings.Contains(content, "containerd") {
			return "docker"
		}
	}
	exe, err := os.Executable()
	if err != nil {
		return "unknown"
	}
	// Running from go run / temp may not be a durable binary install.
	if strings.Contains(exe, os.TempDir()) {
		return "unknown"
	}
	return "binary"
}

// CheckUpdate fetches the latest GitHub release and compares with the running version.
func (s *SystemUpdateService) CheckUpdate(ctx context.Context, force bool) (*UpdateInfo, error) {
	if !force {
		if cached := s.getCache(); cached != nil {
			return cached, nil
		}
	}

	// Capture generation so an in-flight fetch cannot cache over a newer version.
	gen := s.cacheGeneration()
	info, err := s.fetchLatest(ctx)
	if err != nil {
		if cached := s.getCache(); cached != nil {
			cloned := *cached
			cloned.Warning = "Using cached data: " + err.Error()
			return &cloned, nil
		}
		mode := DetectDeployMode()
		cur := normalizeVersion(s.currentVersion())
		return &UpdateInfo{
			CurrentVersion: cur,
			LatestVersion:  cur,
			HasUpdate:      false,
			Warning:        err.Error(),
			DeployMode:     mode,
			CanApply:       mode == "binary",
		}, nil
	}
	// Refresh CurrentVersion fields against latest service state if gen advanced mid-fetch.
	if s.cacheGeneration() != gen {
		info.CurrentVersion = normalizeVersion(s.currentVersion())
		info.HasUpdate = compareVersions(info.CurrentVersion, info.LatestVersion) < 0
		// Do not cache: version changed while we were fetching.
		return info, nil
	}
	s.setCache(info)
	return info, nil
}

// PerformUpdate downloads and atomically replaces the running binary.
func (s *SystemUpdateService) PerformUpdate(ctx context.Context) error {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	if DetectDeployMode() != "binary" {
		return fmt.Errorf("%w: deploy_mode=%s (use docker compose pull/up for containers)", ErrUpdateNotSupportedEnv, DetectDeployMode())
	}
	info, err := s.CheckUpdate(ctx, true)
	if err != nil {
		return err
	}
	if !info.HasUpdate {
		return ErrNoUpdateAvailable
	}
	if info.ReleaseInfo == nil {
		return errors.New("release info missing")
	}
	return s.applyAssets(ctx, info.ReleaseInfo.Assets, info.LatestVersion)
}

// Rollback restores the local .backup binary left by the last successful update.
func (s *SystemUpdateService) Rollback() error {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	if DetectDeployMode() != "binary" {
		return fmt.Errorf("%w: deploy_mode=%s", ErrUpdateNotSupportedEnv, DetectDeployMode())
	}
	exePath, err := resolveExecutable()
	if err != nil {
		return err
	}
	backup := exePath + ".backup"
	if _, err := os.Stat(backup); os.IsNotExist(err) {
		return ErrNoBackupFound
	}
	// Swap: current -> .failed, backup -> current
	failed := exePath + ".failed"
	_ = os.Remove(failed)
	if err := os.Rename(exePath, failed); err != nil {
		return fmt.Errorf("backup current failed: %w", err)
	}
	if err := os.Rename(backup, exePath); err != nil {
		_ = os.Rename(failed, exePath)
		return fmt.Errorf("restore backup failed: %w", err)
	}
	_ = os.Remove(failed)
	return nil
}

// ListRollbackVersions returns up to maxRollbackVersions older releases.
func (s *SystemUpdateService) ListRollbackVersions(ctx context.Context) ([]RollbackVersion, error) {
	releases, err := s.fetchRecent(ctx, rollbackFetchPageSize)
	if err != nil {
		return nil, err
	}
	current := normalizeVersion(s.currentVersion())
	seen := map[string]bool{}
	out := make([]RollbackVersion, 0, maxRollbackVersions)
	for _, r := range releases {
		if r.Draft || r.Prerelease {
			continue
		}
		v := normalizeVersion(r.TagName)
		if v == "" || seen[v] || compareVersions(v, current) >= 0 {
			continue
		}
		seen[v] = true
		out = append(out, RollbackVersion{
			Version:     v,
			PublishedAt: r.PublishedAt,
			HTMLURL:     r.HTMLURL,
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		return compareVersions(out[i].Version, out[j].Version) > 0
	})
	if len(out) > maxRollbackVersions {
		out = out[:maxRollbackVersions]
	}
	return out, nil
}

// RollbackToVersion installs a specific older release binary.
func (s *SystemUpdateService) RollbackToVersion(ctx context.Context, version string) error {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	if DetectDeployMode() != "binary" {
		return fmt.Errorf("%w: deploy_mode=%s", ErrUpdateNotSupportedEnv, DetectDeployMode())
	}
	target := normalizeVersion(version)
	if target == "" {
		return ErrRollbackVersionNotAllowed
	}
	allowed, err := s.ListRollbackVersions(ctx)
	if err != nil {
		return err
	}
	ok := false
	for _, a := range allowed {
		if a.Version == target {
			ok = true
			break
		}
	}
	if !ok {
		return ErrRollbackVersionNotAllowed
	}
	// Fetch full release list to get assets for the target tag.
	releases, err := s.fetchRecent(ctx, rollbackFetchPageSize)
	if err != nil {
		return err
	}
	for _, r := range releases {
		if normalizeVersion(r.TagName) != target {
			continue
		}
		assets := make([]ReleaseAsset, 0, len(r.Assets))
		for _, a := range r.Assets {
			assets = append(assets, ReleaseAsset{
				Name:        a.Name,
				DownloadURL: a.BrowserDownloadURL,
				Size:        a.Size,
			})
		}
		return s.applyAssets(ctx, assets, target)
	}
	return ErrRollbackVersionNotAllowed
}

func (s *SystemUpdateService) fetchLatest(ctx context.Context) (*UpdateInfo, error) {
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", s.repo)
	var release githubRelease
	if err := s.getJSON(ctx, apiURL, &release); err != nil {
		return nil, err
	}
	return s.releaseToUpdateInfo(&release), nil
}

func (s *SystemUpdateService) fetchRecent(ctx context.Context, perPage int) ([]githubRelease, error) {
	if perPage <= 0 {
		perPage = 10
	}
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/releases?per_page=%d", s.repo, perPage)
	var releases []githubRelease
	if err := s.getJSON(ctx, apiURL, &releases); err != nil {
		return nil, err
	}
	return releases, nil
}

func (s *SystemUpdateService) releaseToUpdateInfo(release *githubRelease) *UpdateInfo {
	latest := normalizeVersion(release.TagName)
	current := normalizeVersion(s.currentVersion())
	assets := make([]ReleaseAsset, 0, len(release.Assets))
	for _, a := range release.Assets {
		assets = append(assets, ReleaseAsset{
			Name:        a.Name,
			DownloadURL: a.BrowserDownloadURL,
			Size:        a.Size,
		})
	}
	mode := DetectDeployMode()
	return &UpdateInfo{
		CurrentVersion: current,
		LatestVersion:  latest,
		HasUpdate:      compareVersions(current, latest) < 0,
		ReleaseInfo: &ReleaseInfo{
			Name:        release.Name,
			Body:        release.Body,
			PublishedAt: release.PublishedAt,
			HTMLURL:     release.HTMLURL,
			Assets:      assets,
		},
		Cached:     false,
		DeployMode: mode,
		CanApply:   mode == "binary",
	}
}

func (s *SystemUpdateService) applyAssets(ctx context.Context, assets []ReleaseAsset, version string) error {
	downloadURL, checksumURL, err := selectReleaseAsset(assets, version)
	if err != nil {
		return err
	}
	if err := validateGitHubDownloadURL(downloadURL); err != nil {
		return err
	}

	exePath, err := resolveExecutable()
	if err != nil {
		return err
	}
	exeDir := filepath.Dir(exePath)

	tempDir, err := os.MkdirTemp(exeDir, ".new-api-update-*")
	if err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer func() { _ = os.RemoveAll(tempDir) }()

	assetName := filepath.Base(downloadURL)
	// strip query from URL path base
	if u, err := url.Parse(downloadURL); err == nil {
		assetName = filepath.Base(u.Path)
	}
	downloadPath := filepath.Join(tempDir, assetName)
	if err := s.downloadFile(ctx, downloadURL, downloadPath); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	// Checksum is mandatory: never install an unverified binary.
	if checksumURL == "" {
		return errors.New("checksum file missing for this platform; refusing to install")
	}
	if err := validateGitHubDownloadURL(checksumURL); err != nil {
		return err
	}
	if err := s.verifyChecksum(ctx, downloadPath, checksumURL); err != nil {
		return fmt.Errorf("checksum verification failed: %w", err)
	}

	newBinary := filepath.Join(tempDir, "new-api-bin")
	if err := os.Rename(downloadPath, newBinary); err != nil {
		// cross-device unlikely in same dir; fall back to copy
		if copyErr := copyFile(downloadPath, newBinary); copyErr != nil {
			return fmt.Errorf("stage binary: %w", copyErr)
		}
	}
	if err := os.Chmod(newBinary, 0o755); err != nil {
		return fmt.Errorf("chmod failed: %w", err)
	}

	backupPath := exePath + ".backup"
	_ = os.Remove(backupPath)
	if err := os.Rename(exePath, backupPath); err != nil {
		return fmt.Errorf("backup failed: %w", err)
	}
	if err := os.Rename(newBinary, exePath); err != nil {
		if restoreErr := os.Rename(backupPath, exePath); restoreErr != nil {
			return fmt.Errorf("replace failed and restore failed: %w (restore: %v)", err, restoreErr)
		}
		return fmt.Errorf("replace failed (restored backup): %w", err)
	}
	return nil
}

func selectReleaseAsset(assets []ReleaseAsset, version string) (downloadURL, checksumURL string, err error) {
	version = normalizeVersion(version)
	// Prefer matching exact platform asset names from release.yml:
	//   linux amd64: new-api-vX.Y.Z
	//   linux arm64: new-api-arm64-vX.Y.Z
	//   darwin:      new-api-macos-vX.Y.Z
	//   windows:     new-api-vX.Y.Z.exe
	wantNames := candidateAssetNames(version)
	var checksumNames []string
	switch runtime.GOOS {
	case "linux":
		checksumNames = []string{"checksums-linux.txt"}
	case "darwin":
		checksumNames = []string{"checksums-macos.txt"}
	case "windows":
		checksumNames = []string{"checksums-windows.txt"}
	}

	byName := map[string]ReleaseAsset{}
	for _, a := range assets {
		byName[a.Name] = a
		if checksumURL == "" {
			for _, cn := range checksumNames {
				if a.Name == cn {
					checksumURL = a.DownloadURL
				}
			}
		}
	}
	for _, name := range wantNames {
		if a, ok := byName[name]; ok {
			return a.DownloadURL, checksumURL, nil
		}
	}
	// Restricted fuzzy fallback: must include the target version tag AND match platform.
	// Avoids picking an unrelated OS/arch asset when the exact filename differs slightly.
	tag := version
	if !strings.HasPrefix(tag, "v") {
		tag = "v" + tag
	}
	tagLower := strings.ToLower(tag)
	verLower := strings.ToLower(version)
	for _, a := range assets {
		n := strings.ToLower(a.Name)
		if strings.HasSuffix(n, ".txt") || strings.Contains(n, "checksum") {
			continue
		}
		if !strings.Contains(n, tagLower) && !strings.Contains(n, verLower) {
			continue
		}
		if assetMatchesPlatform(n) {
			return a.DownloadURL, checksumURL, nil
		}
	}
	return "", "", fmt.Errorf("no compatible release asset for %s/%s (looked for %v)", runtime.GOOS, runtime.GOARCH, wantNames)
}

func candidateAssetNames(version string) []string {
	// VERSION in release.yml is git describe tags, usually with leading v.
	tag := version
	if !strings.HasPrefix(tag, "v") {
		tag = "v" + tag
	}
	switch runtime.GOOS {
	case "linux":
		if runtime.GOARCH == "arm64" {
			return []string{"new-api-arm64-" + tag}
		}
		return []string{"new-api-" + tag}
	case "darwin":
		return []string{"new-api-macos-" + tag}
	case "windows":
		return []string{"new-api-" + tag + ".exe"}
	default:
		return []string{"new-api-" + tag}
	}
}

func assetMatchesPlatform(nameLower string) bool {
	switch runtime.GOOS {
	case "linux":
		if runtime.GOARCH == "arm64" {
			return strings.Contains(nameLower, "arm64") && !strings.HasSuffix(nameLower, ".exe")
		}
		return strings.HasPrefix(nameLower, "new-api-") &&
			!strings.Contains(nameLower, "arm64") &&
			!strings.Contains(nameLower, "macos") &&
			!strings.HasSuffix(nameLower, ".exe")
	case "darwin":
		return strings.Contains(nameLower, "macos")
	case "windows":
		return strings.HasSuffix(nameLower, ".exe")
	default:
		return false
	}
}

func (s *SystemUpdateService) getJSON(ctx context.Context, apiURL string, dest any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "new-api-updater")
	if s.token != "" {
		req.Header.Set("Authorization", "Bearer "+s.token)
	}
	resp, err := s.apiClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	// Intentionally use stdlib decoder: this package must stay free of the
	// heavy common dependency graph (gin/redis/etc.) so unit tests stay fast.
	// Behavior matches common.DecodeJson (thin wrap of encoding/json).
	return json.NewDecoder(resp.Body).Decode(dest)
}

func (s *SystemUpdateService) downloadFile(ctx context.Context, rawURL, dest string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "new-api-updater")
	// Do not attach Authorization for asset CDN URLs.
	resp, err := s.dlClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download status %d", resp.StatusCode)
	}
	if resp.ContentLength > maxUpdateDownloadSize {
		return fmt.Errorf("file too large: %d", resp.ContentLength)
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	written, err := io.Copy(out, io.LimitReader(resp.Body, maxUpdateDownloadSize+1))
	if err != nil {
		_ = out.Close()
		return err
	}
	if written > maxUpdateDownloadSize {
		_ = out.Close()
		return fmt.Errorf("file exceeds max size %d", maxUpdateDownloadSize)
	}
	if err := out.Sync(); err != nil {
		_ = out.Close()
		return fmt.Errorf("sync download: %w", err)
	}
	if err := out.Close(); err != nil {
		return fmt.Errorf("close download: %w", err)
	}
	return nil
}

func (s *SystemUpdateService) verifyChecksum(ctx context.Context, filePath, checksumURL string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, checksumURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "new-api-updater")
	resp, err := s.apiClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("checksum download status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}

	f, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	actual := hex.EncodeToString(h.Sum(nil))
	fileName := filepath.Base(filePath)

	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		if len(parts) >= 2 {
			// sha256sum format: "<hash>  <filename>" or "<hash> *<filename>"
			name := strings.TrimPrefix(parts[len(parts)-1], "*")
			name = filepath.Base(name)
			if name == fileName {
				if parts[0] == actual {
					return nil
				}
				return fmt.Errorf("checksum mismatch for %s", fileName)
			}
		}
	}
	// Checksum file present but entry missing: warn by soft-fail? Prefer hard fail for safety.
	return fmt.Errorf("checksum not found for %s", fileName)
}

func (s *SystemUpdateService) getCache() *UpdateInfo {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	if s.cache == nil || time.Now().After(s.cache.expiresAt) {
		return nil
	}
	cloned := *s.cache.info
	cloned.Cached = true
	return &cloned
}

func (s *SystemUpdateService) setCache(info *UpdateInfo) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	cp := *info
	s.cache = &updateCacheEntry{info: &cp, expiresAt: time.Now().Add(updateCacheTTL)}
}

func resolveExecutable() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("get executable: %w", err)
	}
	return filepath.EvalSymlinks(exePath)
}

func validateGitHubDownloadURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "https" {
		return errors.New("only HTTPS download URLs are allowed")
	}
	host := strings.ToLower(u.Host)
	allowed := []string{
		"github.com",
		"objects.githubusercontent.com",
		"release-assets.githubusercontent.com",
	}
	ok := false
	for _, a := range allowed {
		if host == a || strings.HasSuffix(host, "."+a) {
			ok = true
			break
		}
	}
	if !ok {
		return fmt.Errorf("download from untrusted host: %s", host)
	}
	return nil
}

func normalizeVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	return v
}

// compareVersions compares semver-ish versions (supports -rc.N suffix roughly).
// returns -1 if a<b, 0 if equal, 1 if a>b.
func compareVersions(a, b string) int {
	a = normalizeVersion(a)
	b = normalizeVersion(b)
	if a == b {
		return 0
	}
	aMain, aPre := splitPreRelease(a)
	bMain, bPre := splitPreRelease(b)
	aParts := parseVersionParts(aMain)
	bParts := parseVersionParts(bMain)
	for i := 0; i < 3; i++ {
		if aParts[i] < bParts[i] {
			return -1
		}
		if aParts[i] > bParts[i] {
			return 1
		}
	}
	// release without prerelease is greater than with prerelease
	if aPre == "" && bPre != "" {
		return 1
	}
	if aPre != "" && bPre == "" {
		return -1
	}
	return comparePreRelease(aPre, bPre)
}

// comparePreRelease implements SemVer 2.0.0 prerelease precedence:
// - identifiers separated by dots
// - numeric identifiers (all digits) compare numerically (no int conversion)
// - numeric identifiers have lower precedence than non-numeric
// - non-numeric compare lexically in ASCII order
// - when all shared identifiers are equal, the shorter set has lower precedence
func comparePreRelease(a, b string) int {
	if a == b {
		return 0
	}
	as := strings.Split(a, ".")
	bs := strings.Split(b, ".")
	n := len(as)
	if len(bs) < n {
		n = len(bs)
	}
	for i := 0; i < n; i++ {
		ap, bp := as[i], bs[i]
		aNum := isNumericIdent(ap)
		bNum := isNumericIdent(bp)
		switch {
		case aNum && bNum:
			if c := compareNumericIdent(ap, bp); c != 0 {
				return c
			}
		case aNum && !bNum:
			return -1
		case !aNum && bNum:
			return 1
		default:
			if ap < bp {
				return -1
			}
			if ap > bp {
				return 1
			}
		}
	}
	if len(as) < len(bs) {
		return -1
	}
	if len(as) > len(bs) {
		return 1
	}
	return 0
}

func isNumericIdent(s string) bool {
	if s == "" {
		return false
	}
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

// compareNumericIdent compares pure-digit identifiers without int conversion.
func compareNumericIdent(a, b string) int {
	a = strings.TrimLeft(a, "0")
	b = strings.TrimLeft(b, "0")
	if a == "" {
		a = "0"
	}
	if b == "" {
		b = "0"
	}
	if len(a) < len(b) {
		return -1
	}
	if len(a) > len(b) {
		return 1
	}
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

func splitPreRelease(v string) (main, pre string) {
	if i := strings.IndexByte(v, '-'); i >= 0 {
		return v[:i], v[i+1:]
	}
	return v, ""
}

func parseVersionParts(v string) [3]int {
	var out [3]int
	parts := strings.Split(v, ".")
	for i := 0; i < len(parts) && i < 3; i++ {
		n := 0
		for _, ch := range parts[i] {
			if ch < '0' || ch > '9' {
				break
			}
			n = n*10 + int(ch-'0')
		}
		out[i] = n
	}
	return out
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close()
		return err
	}
	if err := out.Sync(); err != nil {
		_ = out.Close()
		return fmt.Errorf("sync copy: %w", err)
	}
	if err := out.Close(); err != nil {
		return fmt.Errorf("close copy: %w", err)
	}
	return nil
}
