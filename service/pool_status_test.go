package service

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// TestSanitizeFetchErrorStripsURL is the domain-protection guarantee: when the
// stdlib wraps the upstream host into a *url.Error, sanitizeFetchError must
// remove the URL entirely while keeping the underlying cause, so the upstream
// host can never leak into logs.
func TestSanitizeFetchErrorStripsURL(t *testing.T) {
	secret := "https://upstream.example.com/api/channel_pool_preview"
	urlErr := &url.Error{
		Op:  "Get",
		URL: secret,
		Err: errors.New("dial tcp: connection refused"),
	}
	got := sanitizeFetchError(urlErr)
	if strings.Contains(got, "upstream.example.com") || strings.Contains(got, secret) {
		t.Errorf("sanitizeFetchError leaked the URL: %q", got)
	}
	if !strings.Contains(got, "connection refused") {
		t.Errorf("sanitizeFetchError dropped the cause: %q", got)
	}
}

// TestSanitizeFetchErrorPlainError: a non-url.Error is passed through as-is
// (it carries no URL to leak).
func TestSanitizeFetchErrorPlainError(t *testing.T) {
	got := sanitizeFetchError(errors.New("context deadline exceeded"))
	if got != "context deadline exceeded" {
		t.Errorf("sanitizeFetchError(plain) = %q, want passthrough", got)
	}
}

// sampleUpstreamResponse is a representative upstream payload used to prove the
// parser drops the private reset_quota block and the affected_models list.
const sampleUpstreamResponse = `{
  "data": {
    "affected_models": ["gpt-5.5", "claude-opus-4-8", "gpt-5.4-mini"],
    "enabled": true,
    "health_percent": 98.86,
    "overview": {
      "total_selections": 11791956,
      "total_pools": 2055,
      "active_pools": 350,
      "idle_pools": 1705,
      "idle_threshold_s": 300
    },
    "pools": [
      {"type": "gemini", "count": 527, "health_percent": 97.15, "status": "healthy"},
      {"type": "anthropic", "count": 308, "health_percent": 98.7, "status": "healthy"},
      {"type": "codex", "count": 1264, "health_percent": 99.6, "status": "healthy"}
    ],
    "reset_quota": {
      "can_reset": true,
      "daily": {"limit": 3, "used": 1, "reset_in_sec": 0},
      "enabled": true,
      "hourly": {"limit": 1, "used": 1, "reset_in_sec": 31489}
    },
    "status": "healthy",
    "updated_at": 1780529390
  },
  "message": "",
  "success": true
}`

// TestParsePoolPreviewDesensitizes proves the whitelist struct keeps only the
// pool-health fields and that the private reset_quota / affected_models data
// never survives parsing — re-marshaling the parsed value must not contain them.
func TestParsePoolPreviewDesensitizes(t *testing.T) {
	pp, err := parsePoolPreview([]byte(sampleUpstreamResponse))
	if err != nil {
		t.Fatalf("parsePoolPreview returned error: %v", err)
	}
	if !pp.Enabled {
		t.Errorf("Enabled = false, want true")
	}
	if len(pp.Pools) != 3 {
		t.Fatalf("len(Pools) = %d, want 3", len(pp.Pools))
	}
	if pp.Pools[1].Type != "anthropic" || pp.Pools[1].HealthPercent != 98.7 {
		t.Errorf("Pools[1] = %+v, want anthropic/98.7", pp.Pools[1])
	}
	if pp.UpdatedAt != 1780529390 {
		t.Errorf("UpdatedAt = %d, want 1780529390", pp.UpdatedAt)
	}

	// The crux: re-serialize and assert no private/forbidden field leaked in.
	out, err := common.Marshal(pp)
	if err != nil {
		t.Fatalf("marshal parsed value: %v", err)
	}
	for _, forbidden := range []string{"reset_quota", "affected_models", "daily", "hourly", "total_selections", "gpt-5.4-mini"} {
		if strings.Contains(string(out), forbidden) {
			t.Errorf("re-marshaled payload leaked forbidden token %q: %s", forbidden, out)
		}
	}
}

// TestFetchPoolStatusOnceSuccess: a healthy upstream populates the cache with
// the desensitized snapshot.
func TestFetchPoolStatusOnceSuccess(t *testing.T) {
	resetPoolStatusCache(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleUpstreamResponse))
	}))
	t.Cleanup(srv.Close)

	if err := fetchPoolStatusOnce(srv.URL, "", ""); err != nil {
		t.Fatalf("fetchPoolStatusOnce returned error: %v", err)
	}
	pp, ok := loadPoolStatus()
	if !ok || len(pp.Pools) != 3 {
		t.Fatalf("cache not populated correctly: ok=%v pp=%+v", ok, pp)
	}
}

// TestFetchPoolStatusOnceSendsAuthHeader: a configured "Header: value" auth
// credential is split and sent on the upstream request.
func TestFetchPoolStatusOnceSendsAuthHeader(t *testing.T) {
	resetPoolStatusCache(t)
	gotCookie := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotCookie = r.Header.Get("Cookie")
		_, _ = w.Write([]byte(sampleUpstreamResponse))
	}))
	t.Cleanup(srv.Close)

	if err := fetchPoolStatusOnce(srv.URL, "Cookie: session=abc123", ""); err != nil {
		t.Fatalf("fetchPoolStatusOnce returned error: %v", err)
	}
	if gotCookie != "session=abc123" {
		t.Errorf("upstream received Cookie = %q, want session=abc123", gotCookie)
	}
}

// TestFetchPoolStatusOnceSendsUserIDHeader: when a numeric user id is
// configured, it is sent as the New-Api-User header alongside the auth header.
// Upstream new-api instances reject session/access-token auth without it.
func TestFetchPoolStatusOnceSendsUserIDHeader(t *testing.T) {
	resetPoolStatusCache(t)
	gotUser := ""
	gotCookie := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUser = r.Header.Get("New-Api-User")
		gotCookie = r.Header.Get("Cookie")
		_, _ = w.Write([]byte(sampleUpstreamResponse))
	}))
	t.Cleanup(srv.Close)

	if err := fetchPoolStatusOnce(srv.URL, "Cookie: session=abc123", "42"); err != nil {
		t.Fatalf("fetchPoolStatusOnce returned error: %v", err)
	}
	if gotUser != "42" {
		t.Errorf("upstream received New-Api-User = %q, want 42", gotUser)
	}
	if gotCookie != "session=abc123" {
		t.Errorf("upstream received Cookie = %q, want session=abc123", gotCookie)
	}
}

// TestFetchPoolStatusOnceNoUserIDOmitsHeader: an empty user id must not send a
// New-Api-User header at all (backward compatible with non-new-api upstreams).
func TestFetchPoolStatusOnceNoUserIDOmitsHeader(t *testing.T) {
	resetPoolStatusCache(t)
	_, hadUserHeader := "", false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hadUserHeader = r.Header["New-Api-User"]
		_, _ = w.Write([]byte(sampleUpstreamResponse))
	}))
	t.Cleanup(srv.Close)

	if err := fetchPoolStatusOnce(srv.URL, "", ""); err != nil {
		t.Fatalf("fetchPoolStatusOnce returned error: %v", err)
	}
	if hadUserHeader {
		t.Error("New-Api-User header was sent with empty user id, want omitted")
	}
}

// TestFetchPoolStatusOnceBadResponseKeepsCache: a non-200 round must return an
// error AND leave the previously-cached good value intact.
func TestFetchPoolStatusOnceBadResponseKeepsCache(t *testing.T) {
	resetPoolStatusCache(t)
	good, _ := parsePoolPreview([]byte(sampleUpstreamResponse))
	storePoolStatus(good)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	if err := fetchPoolStatusOnce(srv.URL, "", ""); err == nil {
		t.Error("fetchPoolStatusOnce returned nil error on 500, want error")
	}
	pp, ok := loadPoolStatus()
	if !ok || pp.UpdatedAt != 1780529390 {
		t.Errorf("bad fetch clobbered the cache: ok=%v pp=%+v", ok, pp)
	}
}

// withPoolStatusConfig sets the global enable flag + category name for a test
// and restores them afterward.
func withPoolStatusConfig(t *testing.T, enabled bool, category string) {
	t.Helper()
	prevEnabled := common.PoolStatusEnabled.Load()
	prevCategory := common.PoolStatusCategoryName
	common.PoolStatusEnabled.Store(enabled)
	common.PoolStatusCategoryName = category
	t.Cleanup(func() {
		common.PoolStatusEnabled.Store(prevEnabled)
		common.PoolStatusCategoryName = prevCategory
	})
}

// TestGetPoolStatusGroupDisabled: when the feature is off, nothing is injected
// regardless of cache contents.
func TestGetPoolStatusGroupDisabled(t *testing.T) {
	resetPoolStatusCache(t)
	withPoolStatusConfig(t, false, "号池状态")
	pp, _ := parsePoolPreview([]byte(sampleUpstreamResponse))
	storePoolStatus(pp)

	if _, _, ok := GetPoolStatusGroup(); ok {
		t.Error("GetPoolStatusGroup ok=true while disabled, want false")
	}
}

// TestGetPoolStatusGroupEnabledNoData: enabled but nothing cached yet -> no
// injection (suppress, don't show an empty group).
func TestGetPoolStatusGroupEnabledNoData(t *testing.T) {
	resetPoolStatusCache(t)
	withPoolStatusConfig(t, true, "号池状态")

	if _, _, ok := GetPoolStatusGroup(); ok {
		t.Error("GetPoolStatusGroup ok=true with empty cache, want false")
	}
}

// TestGetPoolStatusGroupEnabledWithData: the happy path — enabled + cached
// data yields the configured category name and three monitors.
func TestGetPoolStatusGroupEnabledWithData(t *testing.T) {
	resetPoolStatusCache(t)
	withPoolStatusConfig(t, true, "号池状态")
	pp, _ := parsePoolPreview([]byte(sampleUpstreamResponse))
	storePoolStatus(pp)

	category, monitors, ok := GetPoolStatusGroup()
	if !ok {
		t.Fatal("GetPoolStatusGroup ok=false on happy path, want true")
	}
	if category != "号池状态" {
		t.Errorf("category = %q, want 号池状态", category)
	}
	if len(monitors) != 3 || monitors[0].Name != "Gemini" {
		t.Errorf("monitors = %+v, want 3 starting with Gemini", monitors)
	}
}

// resetPoolStatusCache clears the package-level cache so each cache test starts
// from a clean slate (the cache is process-global atomic state).
func resetPoolStatusCache(t *testing.T) {
	t.Helper()
	poolStatusCache.Store((*poolPreview)(nil))
}

// TestPoolStatusCacheStoreAndLoad verifies a stored snapshot is retrievable.
func TestPoolStatusCacheStoreAndLoad(t *testing.T) {
	resetPoolStatusCache(t)
	pp, _ := parsePoolPreview([]byte(sampleUpstreamResponse))

	storePoolStatus(pp)

	got, ok := loadPoolStatus()
	if !ok {
		t.Fatal("loadPoolStatus returned ok=false after store")
	}
	if len(got.Pools) != 3 || got.Pools[0].Type != "gemini" {
		t.Errorf("loaded snapshot mismatch: %+v", got)
	}
}

// TestPoolStatusCacheEmptyWhenUnset verifies an unset cache reports no data,
// so callers can suppress the panel rather than render an empty/error state.
func TestPoolStatusCacheEmptyWhenUnset(t *testing.T) {
	resetPoolStatusCache(t)
	if _, ok := loadPoolStatus(); ok {
		t.Error("loadPoolStatus returned ok=true on a fresh cache, want false")
	}
}

// TestPoolStatusCacheKeepsLastGoodValue is the degrade-gracefully guarantee:
// once a good snapshot is cached, a later failed fetch must NOT wipe it — the
// last good value is still served (so users never see a red error panel).
func TestPoolStatusCacheKeepsLastGoodValue(t *testing.T) {
	resetPoolStatusCache(t)
	pp, _ := parsePoolPreview([]byte(sampleUpstreamResponse))
	storePoolStatus(pp)

	// Simulate a failed fetch round: the parser errors, so the task must not
	// overwrite the cache. We model this by NOT calling storePoolStatus.
	got, ok := loadPoolStatus()
	if !ok {
		t.Fatal("last good value lost after a failed fetch round")
	}
	if got.UpdatedAt != 1780529390 {
		t.Errorf("served snapshot UpdatedAt = %d, want last-good 1780529390", got.UpdatedAt)
	}
}

// TestMapToMonitors verifies each upstream pool becomes a dashboard monitor:
// type title-cased into Name, health_percent/100 into Uptime, and the health
// threshold into Status.
func TestMapToMonitors(t *testing.T) {
	pp, err := parsePoolPreview([]byte(sampleUpstreamResponse))
	if err != nil {
		t.Fatalf("parsePoolPreview returned error: %v", err)
	}
	monitors := mapToMonitors(pp)
	if len(monitors) != 3 {
		t.Fatalf("len(monitors) = %d, want 3", len(monitors))
	}

	want := []PoolMonitor{
		{Name: "Gemini", Uptime: 0.9715, Status: 1},
		{Name: "Anthropic", Uptime: 0.987, Status: 1},
		{Name: "Codex", Uptime: 0.996, Status: 1},
	}
	for i, w := range want {
		if monitors[i].Name != w.Name {
			t.Errorf("monitors[%d].Name = %q, want %q", i, monitors[i].Name, w.Name)
		}
		if monitors[i].Status != w.Status {
			t.Errorf("monitors[%d].Status = %d, want %d", i, monitors[i].Status, w.Status)
		}
		// Float compare with tolerance.
		if diff := monitors[i].Uptime - w.Uptime; diff > 1e-9 || diff < -1e-9 {
			t.Errorf("monitors[%d].Uptime = %v, want %v", i, monitors[i].Uptime, w.Uptime)
		}
	}
}

// TestStatusFromHealth maps an upstream health percentage (0-100) onto an Uptime
// Kuma status code: 1=up(green), 2=degraded(yellow), 0=down(red).
func TestStatusFromHealth(t *testing.T) {
	cases := []struct {
		name   string
		health float64
		want   int
	}{
		{"green at exactly 95", 95, 1},
		{"green at 98.7", 98.7, 1},
		{"green at 100", 100, 1},
		{"yellow at exactly 80", 80, 2},
		{"yellow at 94.9", 94.9, 2},
		{"red just below 80", 79.9, 0},
		{"red at 0", 0, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusFromHealth(tc.health); got != tc.want {
				t.Errorf("statusFromHealth(%v) = %d, want %d", tc.health, got, tc.want)
			}
		})
	}
}
