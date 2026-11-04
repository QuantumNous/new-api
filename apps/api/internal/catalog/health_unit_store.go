package channel

import (
	"errors"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

// ChannelModelHealth is one route unit's persisted health record. The new
// outcome-driven columns (EWMA score, latency EWMA, streaks, cooldown
// deadline, recovery-probe ledger, hard-disable flag) are the live state; the
// legacy columns (state, isolation_level, until, dormancy/failure counters)
// are retained read-only for this package and dropped by the later cleanup
// package. A one-time bootstrap seed maps the legacy isolation data onto
// cooldown_until_ms / hard_disabled (bootstrap_migrations.go); from here on
// the new columns are the single source of truth.
type ChannelModelHealth struct {
	ChannelId      int    `gorm:"primaryKey"`
	KeyIndex       int    `gorm:"primaryKey;not null;default:0"`
	Model          string `gorm:"primaryKey;size:255"`
	State          string `gorm:"size:16;not null;default:healthy"` // legacy: dormant/calms/…
	IsolationLevel int    `gorm:"not null;default:0"`               // legacy ladder rung

	Until *int64 `gorm:"bigint"` // legacy isolation deadline (unix s)

	Version              int    `gorm:"not null;default:1"`
	DormantDisableCount  int    `gorm:"not null;default:0"`
	LocalFailureCount    int    `gorm:"not null;default:0"`
	UpstreamFailureCount int    `gorm:"not null;default:0"`
	LastErrorCode        string `gorm:"size:64"`
	LastErrorAt          *int64 `gorm:"bigint"`
	LastSuccessAt        *int64 `gorm:"bigint"`

	// New outcome-driven unit health model (mono's HealthState):
	EwmaScore          float64 `gorm:"not null;default:1"`
	LatencyEwmaMs      float64 `gorm:"not null;default:0"`
	LatencyUpdatedAtMs int64   `gorm:"not null;default:0"`
	RequestCount       int     `gorm:"not null;default:0"`
	UnauthorizedRun    int     `gorm:"not null;default:0"`
	RampExited         bool    `gorm:"not null;default:false"`
	RampPending        bool    `gorm:"not null;default:false"`
	CooldownStreak     int     `gorm:"not null;default:0"`
	ThrottleStreak     int     `gorm:"not null;default:0"`
	CooldownUntilMs    int64   `gorm:"not null;default:0"`
	ScoreUpdatedAtMs   int64   `gorm:"not null;default:0"`
	AnnealSinceMs      int64   `gorm:"not null;default:0"`
	LastCoolingOutcome int     `gorm:"not null;default:-1"`
	// A cooldown ended and the next outcome is the recovery probe.
	ProbePending bool `gorm:"not null;default:false"`
	// Consecutive failed recovery probes; fires the key-probe hook at
	// UnitProbeFailCap. Never excludes the unit by itself.
	ProbeFailStreak int `gorm:"not null;default:0"`
	// Explicit hard-disable (operator action or conclusive key probe).
	// Health recovery never clears it.
	HardDisabled bool `gorm:"not null;default:false"`

	UpdatedAt int64 `gorm:"bigint"`
}

func (ChannelModelHealth) TableName() string { return "channel_model_health" }

// RouteKey is one schedulable route unit: the (channel, key, model) triple
// the selector and the health state machine both key on. It predates the
// rework (old store_model_health.go); it is defined here now that the store
// owning it is health_unit_store.go. routestats.RouteKey is a separate,
// wider identity (adds the public-model alias) and the two are bridged at
// the selector boundary.
type RouteKey struct {
	ChannelId int
	KeyIndex  int
	Model     string
}

// unitHealthLock guards the in-process mirror. The hot read path (selector)
// is lock-only: it never reaches the DB on a cache hit, and a miss falls
// back to one indexed read that inserts into the map.
var unitHealthIDM = map[RouteKey]*UnitHealthState{}
var unitHealthLock sync.RWMutex

// UnitProbeFailHook fires once when a unit's consecutive failed recovery
// probes reach UnitProbeFailCap (key-probe registration lives in
// store_key_probe.go). The hook does not itself exclude the unit; health
// exclusion is the live cooldown only.
var UnitProbeFailHook func(RouteKey)

// casMaxAttempts bounds the optimistic retry loop. A fixed small bound
// silently drops transitions once several requests race on the same unit:
// with N writers a loser can lose N-1 times in a row, so the ladder would
// under-count and the unit would stay selectable longer than configured.
const casMaxAttempts = 16

// casBackoff spreads retries so contending writers do not re-collide in
// lockstep.
func casBackoff(attempt int) {
	if attempt <= 0 {
		return
	}
	time.Sleep(time.Duration(attempt) * 200 * time.Microsecond)
}

func unitPrimaryKey(key RouteKey) string {
	return "channel_id = ? AND key_index = ? AND model = ?"
}

func unitPrimaryKeyArgs(key RouteKey) []any {
	return []any{key.ChannelId, key.KeyIndex, key.Model}
}

// defaultUnitRow is the never-observed record: full trust, no history,
// version 1 — mono's HealthState::new.
func defaultUnitRow(key RouteKey) ChannelModelHealth {
	return ChannelModelHealth{
		ChannelId:          key.ChannelId,
		KeyIndex:           key.KeyIndex,
		Model:              key.Model,
		State:              "healthy",
		Version:            1,
		EwmaScore:          DefaultUnitScore,
		LastCoolingOutcome: -1,
	}
}

// stateFromRow materializes the in-memory state from a persisted row. The
// legacy columns are ignored; TerminalDisabled mirrors the persisted
// HardDisabled flag.
func stateFromRow(row *ChannelModelHealth) *UnitHealthState {
	st := &UnitHealthState{
		EwmaScore:          row.EwmaScore,
		LatencyEwmaMs:      row.LatencyEwmaMs,
		LatencyUpdatedAtMs: row.LatencyUpdatedAtMs,
		RequestCount:       row.RequestCount,
		UnauthorizedRun:    row.UnauthorizedRun,
		RampExited:         row.RampExited,
		RampPending:        row.RampPending,
		CooldownStreak:     row.CooldownStreak,
		ThrottleStreak:     row.ThrottleStreak,
		CooldownUntilMs:    row.CooldownUntilMs,
		ScoreUpdatedAtMs:   row.ScoreUpdatedAtMs,
		AnnealSinceMs:      row.AnnealSinceMs,
		LastCoolingOutcome: row.LastCoolingOutcome,
		ProbePending:       row.ProbePending,
		ProbeFailStreak:    row.ProbeFailStreak,
		HardDisabled:       row.HardDisabled,
		Version:            row.Version,
	}
	if st.EwmaScore == 0 {
		// Rows seeded before the column existed default to 0 in the
		// database; a score of 0 is below the floor and would pin the
		// unit derated forever. Treat it as the never-observed default.
		st.EwmaScore = DefaultUnitScore
	}
	st.TerminalDisabled = st.HardDisabled
	return st
}

// applyStateToRow writes the absolute state back onto the row. Legacy
// columns are intentionally left untouched: they stop being written by this
// package the moment the outcome model takes over (one-time state loss is
// recorded in the bootstrap seed).
func applyStateToRow(row *ChannelModelHealth, st *UnitHealthState) {
	row.EwmaScore = st.EwmaScore
	row.LatencyEwmaMs = st.LatencyEwmaMs
	row.LatencyUpdatedAtMs = st.LatencyUpdatedAtMs
	row.RequestCount = st.RequestCount
	row.UnauthorizedRun = st.UnauthorizedRun
	row.RampExited = st.RampExited
	row.RampPending = st.RampPending
	row.CooldownStreak = st.CooldownStreak
	row.ThrottleStreak = st.ThrottleStreak
	row.CooldownUntilMs = st.CooldownUntilMs
	row.ScoreUpdatedAtMs = st.ScoreUpdatedAtMs
	row.AnnealSinceMs = st.AnnealSinceMs
	row.LastCoolingOutcome = st.LastCoolingOutcome
	row.ProbePending = st.ProbePending
	row.ProbeFailStreak = st.ProbeFailStreak
	row.HardDisabled = st.HardDisabled
	row.Version = st.Version
}

// unitStateUpdates is the absolute-value update set: a GORM map update, so
// zero-value fields (cooldown expired, streaks decayed, ramp cleared) are
// written rather than skipped the way struct updates would skip them.
func unitStateUpdates(row *ChannelModelHealth, now time.Time) map[string]any {
	return map[string]any{
		"ewma_score":            row.EwmaScore,
		"latency_ewma_ms":       row.LatencyEwmaMs,
		"latency_updated_at_ms": row.LatencyUpdatedAtMs,
		"request_count":         row.RequestCount,
		"unauthorized_run":      row.UnauthorizedRun,
		"ramp_exited":           row.RampExited,
		"ramp_pending":          row.RampPending,
		"cooldown_streak":       row.CooldownStreak,
		"throttle_streak":       row.ThrottleStreak,
		"cooldown_until_ms":     row.CooldownUntilMs,
		"score_updated_at_ms":   row.ScoreUpdatedAtMs,
		"anneal_since_ms":       row.AnnealSinceMs,
		"last_cooling_outcome":  row.LastCoolingOutcome,
		"probe_pending":         row.ProbePending,
		"probe_fail_streak":     row.ProbeFailStreak,
		"hard_disabled":         row.HardDisabled,
		"version":               row.Version,
		"updated_at":            now.Unix(),
	}
}

// isUnitUnhealthy is the pool-pressure view: a unit is unhealthy while it is
// cooling or terminal-disabled. A healthy unit that is mid-ramp still counts
// as healthy — slow start is a sampling decision, not an isolation one.
func isUnitUnhealthy(st *UnitHealthState, nowMs int64) bool {
	if st.TerminalDisabled {
		return true
	}
	return st.IsCooling(nowMs)
}

// cacheUnitHealth mirrors an accepted write into the in-process map and is
// the single funnel where the pool-pressure counter observes a transition.
// It runs after the state lock is released; the pressure hooks take their
// own locks and must never nest.
func cacheUnitHealth(row *ChannelModelHealth, now time.Time) {
	key := RouteKey{ChannelId: row.ChannelId, KeyIndex: row.KeyIndex, Model: row.Model}
	st := stateFromRow(row)
	nowMs := now.UnixMilli()
	previousUnhealthy := false
	unitHealthLock.Lock()
	if cached := unitHealthIDM[key]; cached != nil {
		previousUnhealthy = isUnitUnhealthy(cached, nowMs)
	}
	unitHealthIDM[key] = st
	unitHealthLock.Unlock()
	pressureOnUnitTransition(key, previousUnhealthy, isUnitUnhealthy(st, nowMs))
}

// ClearUnitHealthCache wipes the process mirror; the persisted rows are the
// source of truth and the next read re-hydrates lazily.
func ClearUnitHealthCache() {
	unitHealthLock.Lock()
	unitHealthIDM = map[RouteKey]*UnitHealthState{}
	unitHealthLock.Unlock()
}

// resetUnitHealthStateForKillSwitch discards every health-owned unit signal
// when ChannelHealthEnabled is turned off: persisted cooldowns, streaks, ramp
// flags, EWMA history and the recovery-probe ledger. Hard-disabled rows are
// explicit operator state, not health scoring, and survive. Re-enabling the
// switch therefore starts from a clean slate instead of resurrecting an
// isolation window armed before the toggle (mono keeps the default state
// while disabled).
func resetUnitHealthStateForKillSwitch() {
	ClearUnitHealthCache()
	if dbx.DB == nil || !dbx.DB.Migrator().HasTable(&ChannelModelHealth{}) {
		return
	}
	updates := map[string]any{
		"ewma_score":            DefaultUnitScore,
		"latency_ewma_ms":       0,
		"latency_updated_at_ms": 0,
		"request_count":         0,
		"unauthorized_run":      0,
		"ramp_exited":           false,
		"ramp_pending":          false,
		"cooldown_streak":       0,
		"throttle_streak":       0,
		"cooldown_until_ms":     0,
		"score_updated_at_ms":   0,
		"anneal_since_ms":       0,
		"last_cooling_outcome":  -1,
		"probe_pending":         false,
		"probe_fail_streak":     0,
		// Invalidate any in-flight CAS transition: a writer that passed the
		// enabled check before the toggle re-reads the cleared row instead of
		// overwriting it.
		"version":    gorm.Expr("version + 1"),
		"updated_at": time.Now().Unix(),
	}
	if err := dbx.DB.Model(&ChannelModelHealth{}).Updates(updates).Error; err != nil {
		common.SysError("failed to reset unit health state: " + err.Error())
		return
	}
	pressureRecomputeTotals(dbx.DB)
}

// InitUnitHealthCache loads every persisted row into the in-process mirror
// once at startup. A cache miss still falls back to a DB read on the read
// path, so the initializer is an optimization, not a correctness gate. The
// pressure denominator is rebuilt in the same pass.
func InitUnitHealthCache() {
	var rows []ChannelModelHealth
	if err := dbx.DB.Find(&rows).Error; err != nil {
		common.SysError("failed to load unit health cache: " + err.Error())
		return
	}
	cache := make(map[RouteKey]*UnitHealthState, len(rows))
	for i := range rows {
		row := &rows[i]
		if row.EwmaScore == 0 {
			row.EwmaScore = DefaultUnitScore
		}
		key := RouteKey{ChannelId: row.ChannelId, KeyIndex: row.KeyIndex, Model: row.Model}
		cache[key] = stateFromRow(row)
	}
	unitHealthLock.Lock()
	unitHealthIDM = cache
	unitHealthLock.Unlock()
	pressureRecomputeTotals(dbx.DB)
	// The lazy read path also needs a chance to observe a row's settled
	// state, so a mirror-only settlement is not forced here: the write path
	// settles before persisting, which is the multi-replica-safe order.
	common.SysLog("unit health cache loaded from database")
}

// loadUnitKey resolves one unit's state: the mirror first (hot path), the
// persisted row on a miss, and the never-observed default when there is no
// row at all. The returned state is a caller-owned copy only when it is the
// default; mirror/row states share the cached pointer so in-place read-path
// settlement is visible to the next read. The shared pointer MUST only be
// touched under unitHealthLock and must not escape into public readers:
// every public reader copies via settledUnitState or reads plain values
// under the lock (unitHealthView), so a concurrent writer can never be
// observed mid-mutation.
func loadUnitKey(key RouteKey) *UnitHealthState {
	unitHealthLock.RLock()
	if st := unitHealthIDM[key]; st != nil {
		unitHealthLock.RUnlock()
		return st
	}
	unitHealthLock.RUnlock()
	var row ChannelModelHealth
	err := dbx.DB.Where(unitPrimaryKey(key), unitPrimaryKeyArgs(key)...).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return NewUnitHealthState()
		}
		common.SysError("unit health read failed: " + err.Error())
		return NewUnitHealthState()
	}
	st := stateFromRow(&row)
	unitHealthLock.Lock()
	if cached := unitHealthIDM[key]; cached == nil {
		unitHealthIDM[key] = st
	} else {
		st = cached
	}
	unitHealthLock.Unlock()
	return st
}

// settledUnitState is the read-path view of mono's is_selectable / cooling
// helpers: an expired cooling window is settled in place (ramp + anneal; the
// settlement never adds a strike), and idle streaks are annealed. Settlement
// mutates the shared mirrored state under the WRITE lock, and the settled view
// is returned by value: public readers never touch a shared pointer after the
// lock is released, so no read races a concurrent ReportOutcome writer.
// Persistence happens on the next write.
//
// With the kill switch off the read returns the neutral default (full health,
// no cooldown/ramp) while preserving only the explicit HardDisabled flag, so
// stale isolation can neither filter nor derate a candidate.
func settledUnitState(key RouteKey, nowMs int64) UnitHealthState {
	st := loadUnitKey(key)
	if !UnitHealthEnabled() {
		unitHealthLock.RLock()
		defer unitHealthLock.RUnlock()
		neutral := *NewUnitHealthState()
		neutral.HardDisabled = st.HardDisabled
		neutral.TerminalDisabled = st.HardDisabled
		neutral.Version = st.Version
		return neutral
	}
	cfg := GetUnitHealthSetting()
	unitHealthLock.Lock()
	defer unitHealthLock.Unlock()
	if st.IsCooling(nowMs) {
		return *st
	}
	if st.CooldownUntilMs != 0 {
		finishUnitCooldown(st, nowMs)
	}
	annealUnitStreak(st, cfg, nowMs)
	return *st
}

// IsUnitSelectable is the selector's filter (mono's is_selectable): false
// while the unit is cooling or hard-disabled. The health score and slow-start
// ramp shape the pick's likelihood, never its eligibility. With the health
// kill switch off only the explicit hard-disable remains.
func IsUnitSelectable(key RouteKey, now time.Time) bool {
	st := settledUnitState(key, now.UnixMilli())
	if st.TerminalDisabled {
		return false
	}
	return !st.IsCooling(now.UnixMilli())
}

// UnitState returns the live (settled) state snapshot for admin views and
// the audit list.
func UnitState(key RouteKey) *UnitHealthState {
	snap := settledUnitState(key, ChannelHealthNow().UnixMilli())
	return &snap
}

// CoolingRemainingMs is how long the unit stays excluded; 0 when not cooling
// (a hard-disabled unit reports 0 — it is excluded until an admin recovers it,
// not until a deadline). With the health kill switch off no cooldown is in
// force, so no caller may wait one out.
func CoolingRemainingMs(key RouteKey, now time.Time) int64 {
	st := settledUnitState(key, now.UnixMilli())
	remaining := st.CooldownUntilMs - now.UnixMilli()
	if remaining < 0 {
		remaining = 0
	}
	return remaining
}

// ForceRecallUnit is mono's force_recall: settle a live cooling window
// immediately and let the unit re-enter at the slow-start floor. A recall
// is a rescue, not a completed cycle: it preserves the cooldown/throttle
// streaks, so the next failure climbs from the original rung.
func ForceRecallUnit(key RouteKey, now time.Time) error {
	return casApplyUnit(key, now, func(row *ChannelModelHealth) (bool, error) {
		st := stateFromRow(row)
		nowMs := now.UnixMilli()
		if st.IsCooling(nowMs) {
			finishUnitCooldown(st, nowMs)
		} else {
			if st.CooldownUntilMs != 0 {
				finishUnitCooldown(st, nowMs)
			}
			if !annealUnitStreak(st, GetUnitHealthSetting(), nowMs) {
				return false, nil
			}
		}
		applyStateToRow(row, st)
		return true, nil
	})
}

// UnitHealthScore is the score view of one unit for admin/route listings:
// 0 while the unit is cooling or hard-disabled, otherwise the EWMA score
// times the slow-start factor. With the health kill switch off the neutral
// default scores 1.0 (0 only for a hard-disabled unit). The P2C selector does
// NOT consume it — selector_p2c.go scores from one settled state per
// candidate directly.
func UnitHealthScore(key RouteKey, now time.Time) float64 {
	st := settledUnitState(key, now.UnixMilli())
	if st.TerminalDisabled || st.IsCooling(now.UnixMilli()) {
		return 0
	}
	cfg := GetUnitHealthSetting()
	return st.EwmaScore * st.SlowStartFactor(cfg.MinRequests)
}

// ReportOutcome records one relay attempt (mono's record) and persists the
// resulting transition with optimistic CAS on version. The pool-pressure
// check suppresses NEW escalation while the pool is already short: at
// Warning or Emergency a failure still updates the EWMA/streak evidence but
// arms no new cooldown — the two adjudicated pressure mechanisms.
//
// With the health kill switch off no outcome is recorded (Ferrite's
// cfg.enabled gate); the inner re-check covers a toggle that lands while a
// writer waits for the CAS row.
func ReportOutcome(key RouteKey, outcome UnitOutcome, latencyMs int64, retryAfterMs int64, now time.Time) error {
	if !UnitHealthEnabled() {
		return nil
	}
	cfg := GetUnitHealthSetting()
	nowMs := now.UnixMilli()
	escalate := modelPressureLevel(key.Model) == PressureNormal

	// Pre/post views come from the mirror under the read lock; a missing
	// row is the default state. No shared pointer escapes this function:
	// both the mirror entry and the CAS rows are read-only to us here.
	prevUnhealthy, prevProbe := unitHealthView(key, nowMs)

	err := casApplyUnit(key, now, func(row *ChannelModelHealth) (bool, error) {
		if !UnitHealthEnabled() {
			return false, nil
		}
		st := stateFromRow(row)
		applyUnitOutcome(st, outcome, nowMs, latencyMs, retryAfterMs, escalate, cfg)
		annealUnitStreak(st, cfg, nowMs)
		applyStateToRow(row, st)
		return true, nil
	})
	if err != nil {
		return err
	}

	nextUnhealthy, nextProbe := unitHealthView(key, nowMs)

	// Healthy→unhealthy crossing: the emergency batch recovery revives the
	// least-isolated rows of the pool.
	if !prevUnhealthy && nextUnhealthy {
		maybeEmergencyRecover(key.Model, now)
	}
	// Probe-cap crossing: fire the key-probe hook exactly once, when the
	// consecutive-failure ledger reaches the cap. The hook is diagnostic:
	// the machine itself never turns the counter into an exclusion.
	if UnitProbeFailHook != nil && prevProbe < UnitProbeFailCap && nextProbe >= UnitProbeFailCap {
		hook := UnitProbeFailHook
		gopool.Go(func() {
			hook(key)
		})
	}
	return nil
}

// unitHealthView reports one unit's pressure/hook view (unhealthy flag and
// consecutive failed recovery probes) read under the mirror's read lock. It
// touches the shared pointer ONLY while the lock is held and returns plain
// values, so callers can use them across calls without ever holding the
// pointer. A cache miss resolves to the default state (healthy, zero probes).
func unitHealthView(key RouteKey, nowMs int64) (unhealthy bool, probeFailStreak int) {
	unitHealthLock.RLock()
	defer unitHealthLock.RUnlock()
	st := unitHealthIDM[key]
	if st == nil {
		return false, 0
	}
	return isUnitUnhealthy(st, nowMs), st.ProbeFailStreak
}

// DisableUnit is the admin hard-disable: the persisted flag survives every
// automatic health recovery path (cooldown settlement, annealing, emergency
// recovery, success); only RecoverUnit clears it. Any live cooldown is
// settled and the slow-start ramp is armed, so a recover re-enters at the
// floor.
func DisableUnit(key RouteKey, now time.Time) error {
	return casApplyUnit(key, now, func(row *ChannelModelHealth) (bool, error) {
		st := stateFromRow(row)
		st.HardDisabled = true
		st.TerminalDisabled = true
		finishUnitCooldown(st, now.UnixMilli())
		st.ProbePending = false
		st.ProbeFailStreak = 0
		st.ThrottleStreak = 0
		st.CooldownStreak = 0
		applyStateToRow(row, st)
		return true, nil
	})
}

// RecoverUnit is the admin revive: re-enable a channel/key that the health
// key-probe cascade auto-disabled, restore this model's ability row, and
// only then clear the health hard-disable and re-arm the slow-start ramp.
// The EWMA and latency history is preserved — the unit re-enters at the
// floor and climbs back on evidence.
//
// The ordering is a deliberate scope split rather than one transaction:
// routing state is restored first and the health flip is last, so a restore
// failure leaves the health row hard-disabled (excluded) instead of
// "healthy but unroutable". The operator can retry the recover.
func RecoverUnit(key RouteKey, now time.Time) error {
	if err := restoreAutoDisabledChannelKey(key.ChannelId, key.KeyIndex); err != nil {
		return err
	}
	if err := RestoreChannelModel(key.ChannelId, key.Model); err != nil {
		return err
	}
	// A channel/key the operator disabled manually is not health's to
	// override: leave the health row hard-disabled rather than claim the unit
	// healthy while the scheduler cannot route it. The operator enables the
	// channel first, then retries the recover.
	enabled, err := unitRouteEnabled(key.ChannelId, key.KeyIndex)
	if err != nil {
		return err
	}
	if !enabled {
		return errors.New("cannot recover route unit: channel or key is disabled")
	}
	return casApplyUnit(key, now, func(row *ChannelModelHealth) (bool, error) {
		st := stateFromRow(row)
		st.HardDisabled = false
		st.TerminalDisabled = false
		st.CooldownUntilMs = 0
		st.RampPending = true
		st.RampExited = false
		st.RequestCount = 0
		st.CooldownStreak = 0
		st.ThrottleStreak = 0
		st.ProbeFailStreak = 0
		st.ProbePending = false
		st.AnnealSinceMs = now.UnixMilli()
		applyStateToRow(row, st)
		return true, nil
	})
}

// restoreAutoDisabledChannelKey re-enables the channel (single-key) or the
// key entry (multi-key) that the health key-probe cascade put into
// ChannelStatusAutoDisabled. A manually disabled channel is never touched:
// that is an operator decision the unit recovery does not own.
func restoreAutoDisabledChannelKey(channelID, keyIndex int) error {
	channel, err := GetChannelById(channelID, true)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	targetKey := ""
	if channel.ChannelInfo.IsMultiKey {
		keys := channel.GetKeys()
		if keyIndex < 0 || keyIndex >= len(keys) {
			return nil
		}
		status, tracked := channel.ChannelInfo.MultiKeyStatusList[keyIndex]
		if !tracked || status != common.ChannelStatusAutoDisabled {
			return nil
		}
		targetKey = keys[keyIndex]
	} else if channel.Status != common.ChannelStatusAutoDisabled {
		return nil
	}
	if UpdateChannelStatus(channelID, targetKey, common.ChannelStatusEnabled, "route unit recovered") {
		return nil
	}
	// false means "no-op" or a write failure; re-read to distinguish.
	refreshed, err := GetChannelById(channelID, true)
	if err != nil {
		return err
	}
	enabled := refreshed.Status == common.ChannelStatusEnabled
	if refreshed.ChannelInfo.IsMultiKey {
		status, tracked := refreshed.ChannelInfo.MultiKeyStatusList[keyIndex]
		enabled = !tracked || status == common.ChannelStatusEnabled
	}
	if !enabled {
		return errors.New("failed to re-enable the health-disabled channel")
	}
	return nil
}

// UnitHealthView is the admin listing shape (mono's gateway_health.rs): a
// state label plus the human-useful details.
type UnitHealthView struct {
	ChannelId           int     `json:"channel_id"`
	KeyIndex            int     `json:"key_index"`
	Model               string  `json:"model"`
	State               string  `json:"state"` // terminal | cooling | slow_start | ok
	RemainingCooldownMs int64   `json:"remaining_cooldown_ms"`
	LastCoolingOutcome  string  `json:"last_cooling_outcome"` // fatal | throttled | ""
	SlowStartFactor     float64 `json:"slow_start_factor"`
	EwmaScore           float64 `json:"ewma_score"`
	UpdatedAt           int64   `json:"updated_at"`
}

// ListUnitHealth returns the persisted unit states for one channel (or, with
// channelID == 0, every unit) as the admin view shape. Rows that never ran
// (all defaults, no cooldown, no strikes) are omitted: a unit with no
// history has nothing to audit.
func ListUnitHealth(channelID int) ([]UnitHealthView, error) {
	var rows []ChannelModelHealth
	query := dbx.DB.Order("channel_id, key_index, model")
	if channelID > 0 {
		query = query.Where("channel_id = ?", channelID)
	}
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	cfg := GetUnitHealthSetting()
	nowMs := ChannelHealthNow().UnixMilli()
	views := make([]UnitHealthView, 0, len(rows))
	for i := range rows {
		row := &rows[i]
		st := stateFromRow(row)
		// A fully fresh row has nothing to show.
		if st.EwmaScore == DefaultUnitScore && st.RequestCount == 0 &&
			st.CooldownStreak == 0 && st.ThrottleStreak == 0 &&
			!st.HardDisabled && st.CooldownUntilMs == 0 &&
			st.UnauthorizedRun == 0 && st.ProbeFailStreak == 0 &&
			st.LastCoolingOutcome == -1 {
			continue
		}
		remaining := st.CooldownUntilMs - nowMs
		if remaining < 0 {
			remaining = 0
		}
		state := "ok"
		switch {
		case st.TerminalDisabled:
			state = "terminal"
		case st.IsCooling(nowMs):
			state = "cooling"
		case st.RampPending:
			state = "slow_start"
		}
		last := ""
		switch UnitOutcome(st.LastCoolingOutcome) {
		case UnitFatal:
			last = "fatal"
		case UnitThrottled:
			last = "throttled"
		}
		views = append(views, UnitHealthView{
			ChannelId:           row.ChannelId,
			KeyIndex:            row.KeyIndex,
			Model:               row.Model,
			State:               state,
			RemainingCooldownMs: remaining,
			LastCoolingOutcome:  last,
			SlowStartFactor:     st.SlowStartFactor(cfg.MinRequests),
			EwmaScore:           st.EwmaScore,
			UpdatedAt:           row.UpdatedAt,
		})
	}
	return views, nil
}

// casApplyUnit runs transition against a fresh read of the row under
// optimistic CAS on version: read (or create the default row), apply,
// update `version = old+1`, re-read on a lost race. A CAS write of a
// transition that changed nothing skips the update entirely.
func casApplyUnit(key RouteKey, now time.Time, transition func(row *ChannelModelHealth) (changed bool, err error)) error {
	for attempt := 0; attempt < casMaxAttempts; attempt++ {
		casBackoff(attempt)
		var row ChannelModelHealth
		if err := dbx.DB.Where(unitPrimaryKey(key), unitPrimaryKeyArgs(key)...).First(&row).Error; err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			row = defaultUnitRow(key)
			if err := dbx.DB.Create(&row).Error; err != nil {
				continue
			}
		}
		oldVersion := row.Version
		changed, err := transition(&row)
		if err != nil {
			return err
		}
		if !changed {
			// The transition is a no-op for this row; the mirror already
			// reflects the state (loadUnitKey cached it on the pre-read).
			return nil
		}
		row.Version = oldVersion + 1
		row.UpdatedAt = now.Unix()
		q := dbx.DB.Model(&ChannelModelHealth{}).
			Where(unitPrimaryKey(key)+" AND version = ?", append(unitPrimaryKeyArgs(key), oldVersion)...).
			Updates(unitStateUpdates(&row, now))
		if q.Error != nil {
			return q.Error
		}
		if q.RowsAffected == 0 {
			continue // lost the race: re-read and re-apply
		}
		cacheUnitHealth(&row, now)
		return nil
	}
	return errors.New("unit health state changed concurrently")
}

// deleteUnitHealthByChannelIDsWithTx drops every unit row owned by the given
// channels inside the caller's transaction, then evicts the mirrored cache.
// Ghost rows would let a reused channel id inherit isolation it never
// earned, so the cache is cleared even if the outer transaction rolls back
// (safe direction: a cache miss counts as healthy).
func deleteUnitHealthByChannelIDsWithTx(tx *gorm.DB, ids []int) error {
	if len(ids) == 0 {
		return nil
	}
	if tx.Migrator().HasTable(&ChannelModelHealth{}) {
		if err := tx.Where("channel_id IN ?", ids).Delete(&ChannelModelHealth{}).Error; err != nil {
			return err
		}
	}
	doomed := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		doomed[id] = struct{}{}
	}
	unitHealthLock.Lock()
	removed := make([]RouteKey, 0, len(unitHealthIDM))
	for key := range unitHealthIDM {
		if _, ok := doomed[key.ChannelId]; ok {
			removed = append(removed, key)
			delete(unitHealthIDM, key)
		}
	}
	unitHealthLock.Unlock()
	for _, key := range removed {
		pressureOnRemove(key)
	}
	return nil
}

// deleteUnitHealthNotInModelsWithTx drops the unit rows of models the
// channel no longer serves and keeps the state of the models it still does.
// An empty list is a full channel clear. The NOT IN filter is deliberate:
// editing a channel's model list must not reset isolation that is in
// effect for the models that survived the edit.
func deleteUnitHealthNotInModelsWithTx(tx *gorm.DB, channelID int, models []string) error {
	kept := make(map[string]struct{}, len(models))
	names := make([]string, 0, len(models))
	for _, name := range models {
		if name == "" {
			continue
		}
		if _, dup := kept[name]; dup {
			continue
		}
		kept[name] = struct{}{}
		names = append(names, name)
	}
	if len(names) == 0 {
		return deleteUnitHealthByChannelIDsWithTx(tx, []int{channelID})
	}
	if tx.Migrator().HasTable(&ChannelModelHealth{}) {
		if err := tx.Where("channel_id = ? AND model NOT IN ?", channelID, names).Delete(&ChannelModelHealth{}).Error; err != nil {
			return err
		}
	}
	unitHealthLock.Lock()
	removed := make([]RouteKey, 0, len(unitHealthIDM))
	for key := range unitHealthIDM {
		if key.ChannelId != channelID {
			continue
		}
		if _, ok := kept[key.Model]; !ok {
			removed = append(removed, key)
			delete(unitHealthIDM, key)
		}
	}
	unitHealthLock.Unlock()
	for _, key := range removed {
		pressureOnRemove(key)
	}
	return nil
}

// deleteUnitHealthOutsideKeyRangeWithTx removes unit rows for keys that no
// longer exist after a channel key-list update. A single-key channel keeps
// only index zero.
func deleteUnitHealthOutsideKeyRangeWithTx(tx *gorm.DB, channelID, multiKeySize int) error {
	limit := multiKeySize
	if limit <= 0 {
		limit = 1
	}
	if tx.Migrator().HasTable(&ChannelModelHealth{}) {
		if err := tx.Where("channel_id = ? AND key_index >= ?", channelID, limit).Delete(&ChannelModelHealth{}).Error; err != nil {
			return err
		}
	}
	unitHealthLock.Lock()
	removed := make([]RouteKey, 0, len(unitHealthIDM))
	for key := range unitHealthIDM {
		if key.ChannelId == channelID && key.KeyIndex >= limit {
			removed = append(removed, key)
			delete(unitHealthIDM, key)
		}
	}
	unitHealthLock.Unlock()
	for _, key := range removed {
		pressureOnRemove(key)
	}
	return nil
}

// RestoreChannelModel re-enables the ability row of the (channel, model)
// pair and re-derives the route rows in the same transaction, so a recovered
// model is routable again for every group that had the ability. It
// deliberately does NOT filter on group, mirroring DisableChannelModel.
func RestoreChannelModel(channelID int, modelName string) error {
	if modelName == "" {
		return errors.New("model name must not be empty")
	}
	_, err := MutateGatewayRouting(func(tx *gorm.DB) error {
		if err := updateAbilityStatusByModelWithTx(tx, channelID, modelName, true); err != nil {
			return err
		}
		return SyncChannelModelRoutesWithTx(tx, channelID)
	})
	return err
}
