package service

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
)

// minPoolStatusInterval floors the refresh cadence so a misconfigured tiny
// value cannot hammer the upstream.
const minPoolStatusInterval = 15 * time.Second

// StartPoolStatusTask launches the background loop that periodically refreshes
// the cached channel-pool snapshot. It always runs; each tick is a no-op while
// the feature is disabled, so toggling PoolStatusEnabled at runtime takes
// effect without a restart. Panic recovery is scoped to one tick.
func StartPoolStatusTask() {
	// Intentionally does not log the upstream URL — the host stays out of logs.
	common.SysLog(fmt.Sprintf(
		"channel pool status task started: enabled=%t interval=%ds configured=%t",
		common.PoolStatusEnabled.Load(), common.PoolStatusIntervalSeconds, common.PoolStatusUpstreamURL != "",
	))
	gopool.Go(func() {
		for {
			runPoolStatusTick()
			time.Sleep(poolStatusInterval())
		}
	})
}

// poolStatusInterval resolves the configured refresh cadence, floored to
// minPoolStatusInterval.
func poolStatusInterval() time.Duration {
	d := time.Duration(common.PoolStatusIntervalSeconds) * time.Second
	if d < minPoolStatusInterval {
		return minPoolStatusInterval
	}
	return d
}

// runPoolStatusTick performs a single refresh round. A disabled feature or a
// failed fetch is a no-op for the cache (the last good value is retained).
func runPoolStatusTick() {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("channel pool status tick panic recovered: %v", r))
		}
	}()
	if !common.PoolStatusEnabled.Load() {
		return
	}
	if err := RefreshPoolStatusOnce(); err != nil {
		common.SysError(fmt.Sprintf("channel pool status fetch failed (serving last good value): %v", err))
	}
}

// RefreshPoolStatusOnce performs a single synchronous fetch+cache of the
// upstream pool snapshot using the currently-configured URL and credential. On
// success it replaces the cache; on failure it returns the (URL-sanitized)
// error and leaves the cache untouched. Safe to call independently of the
// background loop (e.g. an admin "refresh now" action or tests).
func RefreshPoolStatusOnce() error {
	return fetchPoolStatusOnce(common.PoolStatusUpstreamURL, common.PoolStatusAuthHeader, common.PoolStatusUserID)
}

// poolFetchTimeout bounds a single upstream pool-preview fetch.
const poolFetchTimeout = 10 * time.Second

// poolFetchMaxBytes caps how much of the upstream response we read, guarding
// against a hostile/oversized body.
const poolFetchMaxBytes = 1 << 20 // 1 MiB

// fetchPoolStatusOnce GETs the upstream pool-preview endpoint, parses it into
// the whitelisted struct, and on success replaces the cached snapshot. On any
// failure it returns an error WITHOUT touching the cache, so the last good
// value keeps being served. authHeader, when non-empty, is a single
// "Header: value" pair (e.g. "Cookie: session=abc") sent on the request.
// userID, when non-empty, is sent as the "New-Api-User" header — upstream
// new-api instances require it alongside session/access-token auth.
func fetchPoolStatusOnce(url, authHeader, userID string) error {
	if strings.TrimSpace(url) == "" {
		return errors.New("pool status upstream URL not configured")
	}
	client := &http.Client{Timeout: poolFetchTimeout}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return errors.New("build pool status request failed")
	}
	if name, value, ok := splitAuthHeader(authHeader); ok {
		req.Header.Set(name, value)
	}
	if uid := strings.TrimSpace(userID); uid != "" {
		req.Header.Set("New-Api-User", uid)
	}

	resp, err := client.Do(req)
	if err != nil {
		// Strip the URL the stdlib embeds in *url.Error so the upstream host
		// never leaks into logs; keep only the underlying cause.
		return fmt.Errorf("fetch pool status failed: %s", sanitizeFetchError(err))
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("pool status upstream returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, poolFetchMaxBytes))
	if err != nil {
		return fmt.Errorf("read pool status body: %w", err)
	}

	pp, err := parsePoolPreview(body)
	if err != nil {
		return fmt.Errorf("parse pool status body: %w", err)
	}

	storePoolStatus(pp)
	return nil
}

// sanitizeFetchError removes the upstream URL the stdlib embeds in a
// *url.Error, returning only the underlying cause. Any other error is returned
// verbatim. This keeps the protected upstream host out of server logs.
func sanitizeFetchError(err error) string {
	var urlErr *url.Error
	if errors.As(err, &urlErr) && urlErr.Err != nil {
		return urlErr.Err.Error()
	}
	return err.Error()
}

// splitAuthHeader splits a "Header: value" credential into its parts. Returns
// ok=false when the input is empty or malformed (no colon).
func splitAuthHeader(raw string) (name, value string, ok bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", "", false
	}
	idx := strings.Index(raw, ":")
	if idx <= 0 {
		return "", "", false
	}
	name = strings.TrimSpace(raw[:idx])
	value = strings.TrimSpace(raw[idx+1:])
	if name == "" {
		return "", "", false
	}
	return name, value, true
}

// poolStatusCache holds the last successfully-fetched, whitelisted snapshot.
// A failed fetch round simply never calls storePoolStatus, so the last good
// value keeps being served — the dashboard degrades gracefully instead of
// flashing an error panel.
var poolStatusCache atomic.Value // stores *poolPreview

// storePoolStatus caches a freshly-parsed snapshot. Called only on a
// successful fetch+parse.
func storePoolStatus(pp *poolPreview) {
	poolStatusCache.Store(pp)
}

// loadPoolStatus returns the cached snapshot, or ok=false if nothing has been
// cached yet (so callers can suppress the panel entirely).
func loadPoolStatus() (*poolPreview, bool) {
	v := poolStatusCache.Load()
	if v == nil {
		return nil, false
	}
	pp, ok := v.(*poolPreview)
	if !ok || pp == nil {
		return nil, false
	}
	return pp, true
}

// PoolMonitor is a whitelisted, dashboard-shaped view of one upstream pool. It
// mirrors the fields the Uptime Kuma panel renders (name + uptime + status),
// so a pool can be injected as a monitor without any frontend change.
type PoolMonitor struct {
	Name   string  `json:"name"`
	Uptime float64 `json:"uptime"`
	Status int     `json:"status"`
}

// mapToMonitors converts each whitelisted pool into a dashboard monitor:
// the pool type is title-cased into Name, health_percent/100 becomes Uptime
// (Uptime Kuma uses a 0-1 ratio), and the health threshold sets Status.
func mapToMonitors(pp *poolPreview) []PoolMonitor {
	monitors := make([]PoolMonitor, 0, len(pp.Pools))
	for _, p := range pp.Pools {
		monitors = append(monitors, PoolMonitor{
			Name:   titleCasePoolType(p.Type),
			Uptime: p.HealthPercent / 100,
			Status: statusFromHealth(p.HealthPercent),
		})
	}
	return monitors
}

// titleCasePoolType upper-cases the first rune of a pool type ("gemini" ->
// "Gemini"), leaving the rest untouched.
func titleCasePoolType(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// poolPreviewPool is the whitelisted view of a single upstream pool. Only these
// fields are ever read from the upstream payload.
type poolPreviewPool struct {
	Type          string  `json:"type"`
	Count         int     `json:"count"`
	HealthPercent float64 `json:"health_percent"`
	Status        string  `json:"status"`
}

// poolPreview is the whitelisted view of the upstream pool-status payload.
// Deliberately omits the upstream's private reset_quota block, the
// affected_models list, and the overview aggregates — fields absent here are
// dropped by Unmarshal, so desensitization is enforced at the type level.
type poolPreview struct {
	Enabled   bool              `json:"enabled"`
	Pools     []poolPreviewPool `json:"pools"`
	UpdatedAt int64             `json:"updated_at"`
}

// poolPreviewEnvelope mirrors the upstream new-api response envelope
// ({data, message, success}).
type poolPreviewEnvelope struct {
	Data    poolPreview `json:"data"`
	Success bool        `json:"success"`
}

// parsePoolPreview decodes the upstream payload into the whitelisted struct,
// silently discarding every field not declared above.
func parsePoolPreview(data []byte) (*poolPreview, error) {
	var env poolPreviewEnvelope
	if err := common.Unmarshal(data, &env); err != nil {
		return nil, err
	}
	if !env.Success {
		return nil, errors.New("upstream pool preview returned success=false")
	}
	return &env.Data, nil
}

// GetPoolStatusGroup returns the channel-pool snapshot shaped for injection as
// an Uptime Kuma category: the configured category name plus one monitor per
// pool. ok is false when the feature is disabled or no snapshot has been
// cached yet, so the caller injects nothing and the panel stays unchanged.
func GetPoolStatusGroup() (category string, monitors []PoolMonitor, ok bool) {
	if !common.PoolStatusEnabled.Load() {
		return "", nil, false
	}
	pp, found := loadPoolStatus()
	if !found || len(pp.Pools) == 0 {
		return "", nil, false
	}
	return common.PoolStatusCategoryName, mapToMonitors(pp), true
}

// poolHealthGreenThreshold and poolHealthYellowThreshold are the health-percent
// cutoffs for mapping a pool's health onto an Uptime Kuma status code.
const (
	poolHealthGreenThreshold  = 95.0
	poolHealthYellowThreshold = 80.0
)

// statusFromHealth maps an upstream health percentage (0-100) onto an Uptime Kuma
// status code consumed by the dashboard: 1=up(green), 2=degraded(yellow),
// 0=down(red).
func statusFromHealth(health float64) int {
	switch {
	case health >= poolHealthGreenThreshold:
		return 1
	case health >= poolHealthYellowThreshold:
		return 2
	default:
		return 0
	}
}
