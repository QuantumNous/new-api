package channel

import (
	"context"
	"errors"
	"math"
	"net/http"
	"sync/atomic"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// Unit health model — the port of mono's crates/gateway/dispatch/src/health.rs
// outcome-driven state machine. One record per route unit (channel, key,
// model); every relay attempt is an outcome, and the state machine keeps:
//
//   - EWMA health score: `score = α×obs + (1-α)×score`, obs ∈ {1.0, 0.0,
//     0.7(429)}, frozen until MinRequests observations, floored at
//     MinScoreFloor. Not a weight multiplier — it feeds the P2C likelihood
//     (see selector_p2c.go);
//   - peak-latency EWMA: records upstream latency, spikes visible to the
//     sampler immediately, falls toward the newest sample with a 10s time
//     constant;
//   - immediate cooldown + power-law ladder: any Fatal arms a cooldown at
//     `base + (max-base)×(n/N)²` (n = cooldown_streak, p=2, N =
//     CooldownRampSteps), climbing toward CooldownMaxMs; 401/403 runs of
//     three go straight to the max rung;
//   - 429 independent ladder: Throttled walks a fully separate
//     throttle_streak over `ThrottleBaseMs → ThrottleMaxMs` (4 rungs),
//     overridable by the upstream Retry-After hint (clamped to
//     CooldownMaxMs, mono's start_cooldown semantics);
//   - EWMA time decay: before every score update the prior ages toward the
//     default score with the ScoreDecayTauMs time constant, so idle units'
//     stale punishment lapses;
//   - slow-start ramp: a cooling window ends into RampPending, whose first
//     picks start from the floor 1/MinRequests; a real failure exits the
//     ramp immediately.
//
// Config is hot-swappable (the settings options below): a value change
// replaces the parameters only, never the cooldown/streak/EWMA state, so a
// running deployment keeps its isolation records.
//
// newapi extension on top of mono: DisableStreak — three naturally expired
// Fatal cooling cycles trip a unit into terminal-disabled (the flag is
// derived from DisableStreak, no separate column), which fires the
// key-probe cascade hook so a dead key can take its sibling units down
// with it. Throttle (429) cycles are a busy upstream, not a dead model,
// and never add a disable strike.

// UnitOutcome is the five-class attempt result the state machine consumes.
// The transport layer produces it from the upstream status via
// ClassifyUnitOutcome; classification of 401/403 into the escalation run
// happens inside the machine, off the shared UnauthorizedRun counter.
type UnitOutcome int

const (
	// UnitSuccess: 2xx — full trust, EWMA obs = 1.0.
	UnitSuccess UnitOutcome = iota
	// UnitFatal: 5xx, transport retryable, bad body — obs = 0.0, arms the
	// fatal cooldown ladder.
	UnitFatal
	// UnitThrottled: 429 — the channel is healthy but rate-limited; obs =
	// 0.7, arms the independent throttle ladder.
	UnitThrottled
	// UnitNeutral: other 4xx (400/404/422, client-side faults) — the
	// channel is not at fault; no score change, no count, no cooldown.
	UnitNeutral
	// UnitUnauthorized: 401/403 — counted into UnauthorizedRun; a run of
	// three escalates to UnitFatal at the max rung, an isolated 401/403
	// settles as UnitNeutral.
	UnitUnauthorized
)

// ThrottledObservation and UnauthorizedEscalationThreshold are shared with the
// channel-level EWMA (bridge_channel_health.go); they keep their package-wide
// definitions there, and this file reuses them.

// DefaultUnitScore is the health score of a unit with no history.
const DefaultUnitScore = 1.0

// UnitDisableStreakCap completed Fatal cooling cycles trip a unit into
// terminal-disabled, which fires the key-probe cascade. Hardcoded, like
// mono's cooldown_disable_streak default: the threshold itself is not a
// config knob.
const UnitDisableStreakCap = 3

// LatencyEwmaDecayMs is the 10s time constant of the peak-latency EWMA
// (mono's DECAY_TIME_CONSTANT_MS, hardcoded like its shape exponent).
const LatencyEwmaDecayMs = 10_000.0

// ThrottleRampSteps fixes the 429 ladder's view: four rungs up to
// ThrottleMaxMs. 429 is transient throttling, so the ladder is deliberately
// short and steep (mono's THROTTLE_RAMP_STEPS, no config knob).
const ThrottleRampSteps = 4

// UnitHealthSetting is the option-backed half of the machine. It retains
// the EmergencyThreshold/WarningThreshold pair from the retired ladder
// settings: pool pressure still rides the same hot-path counter, it now
// only governs the two adjudicated pressure mechanisms in
// store_model_pressure.go.
type UnitHealthSetting struct {
	// Cooldown ladder: base of the ramp (any single failure arms a
	// cooldown, so sub-second), ceiling of the curve, and the view N in
	// which the curve reaches the ceiling.
	CooldownBaseMs    int64
	CooldownMaxMs     int64
	CooldownRampSteps int
	// Independent 429 ladder. Kept separate from the fatal base
	// deliberately: newapi's 429 rungs start at ThrottleBaseMs (mono
	// shares the fatal base there; the params doc adds a knob).
	ThrottleBaseMs int64
	ThrottleMaxMs  int64
	// EWMA time-decay constant τ (ms): the score ages toward the default
	// with half-life τ·ln2. 0 disables aging (score frozen).
	ScoreDecayTauMs int64
	// EWMA smoothing factor, pre-trust sample gate and score floor.
	Alpha         float64
	MinRequests   int
	MinScoreFloor float64
	// Pool pressure thresholds (percent of healthy units): below
	// WarningThreshold new escalations are suppressed, below
	// EmergencyThreshold the batch recovery revives the least-isolated
	// rows.
	WarningThreshold   int
	EmergencyThreshold int
	// Request-level failover time budget of the relay retry loop (mono's
	// gateway.retry.total_budget_ms): failed-attempt latency plus cooldown
	// waits accumulate against it, success never does. 0 disables the time
	// budget (attempt cap only).
	RetryTotalBudgetMs int64
}

// DefaultUnitHealthSetting mirrors mono's defaults with the newapi
// overrides from the port params: the ceiling is 10s (not mono's 8s) and
// the 429 ladder starts at 200ms (its own knob, not the fatal base).
func DefaultUnitHealthSetting() *UnitHealthSetting {
	return &UnitHealthSetting{
		CooldownBaseMs:     300,
		CooldownMaxMs:      10_000,
		CooldownRampSteps:  12,
		ThrottleBaseMs:     200,
		ThrottleMaxMs:      1_000,
		ScoreDecayTauMs:    900_000,
		Alpha:              0.3,
		MinRequests:        5,
		MinScoreFloor:      0.05,
		WarningThreshold:   50,
		EmergencyThreshold: 20,
		// Port-params override of mono's 45s default: 30s.
		RetryTotalBudgetMs: 30_000,
	}
}

var unitHealthSetting atomic.Pointer[UnitHealthSetting]

func init() {
	unitHealthSetting.Store(DefaultUnitHealthSetting())
}

// GetUnitHealthSetting reads the live atomic config; the hot path clones
// the value and holds no lock.
func GetUnitHealthSetting() *UnitHealthSetting {
	if s := unitHealthSetting.Load(); s != nil {
		return s
	}
	// Package init ordering: a sibling init() may read before the store
	// above ran.
	return DefaultUnitHealthSetting()
}

// RestoreUnitHealthSetting swaps the live config for tests.
func RestoreUnitHealthSetting(s *UnitHealthSetting) {
	unitHealthSetting.Store(s)
}

// UnitHealthState is one route unit's health record: mono's 13 HealthState
// fields plus newapi's DisableStreak (the terminal-disabled counter;
// TerminalDisabled is the derived flag), and Version for the CAS-on-version
// persistence.
type UnitHealthState struct {
	// EWMA health score, [MinScoreFloor, 1.0]; no history = 1.0.
	EwmaScore float64
	// Peak-sensitive upstream latency EWMA (ms); 0 = no observation.
	LatencyEwmaMs float64
	// Last latency observation (unix ms); the decay anchor.
	LatencyUpdatedAtMs int64
	// Observed request count; EWMA stays frozen until MinRequests.
	RequestCount int
	// Consecutive 401/403; at UnauthorizedEscalationThreshold → Fatal.
	UnauthorizedRun int
	// A real failure exited the slow-start ramp (no more gradual).
	RampExited bool
	// A cooldown just ended; the next pick starts from the ramp floor.
	RampPending bool
	// Consecutive cooldown activations; selects the fatal ladder rung.
	CooldownStreak int
	// Consecutive 429 activations — fully separate ledger from
	// CooldownStreak (429s never write it, fatals never touch it).
	ThrottleStreak int
	// Cooldown deadline (unix ms); 0 = not cooling.
	CooldownUntilMs int64
	// Last EWMA score update (unix ms); the aging baseline. 0 = no baseline.
	ScoreUpdatedAtMs int64
	// Annealing anchor (unix ms): the last cooling settlement; idle
	// streaks decay from here in CooldownBaseMs windows.
	AnnealSinceMs int64
	// Outcome that armed the most recent cooldown (UnitOutcome value);
	// -1 = never cooled. Drives the differentiated cooldown and the
	// disable strike on natural expiry.
	LastCoolingOutcome int
	// newapi extension: completed Fatal cooling cycles. At
	// UnitDisableStreakCap the unit is terminal-disabled and the key-probe
	// cascade fires.
	DisableStreak int
	// Derived from DisableStreak (no column of its own): true while
	// DisableStreak >= UnitDisableStreakCap.
	TerminalDisabled bool
	// CAS version of the persisted row; 0 = never persisted.
	Version int
}

// NewUnitHealthState is the mono Default: full trust, no history.
func NewUnitHealthState() *UnitHealthState {
	return &UnitHealthState{
		EwmaScore:          DefaultUnitScore,
		LastCoolingOutcome: -1,
	}
}

// IsCooling reports whether the cooldown window is live at nowMs (a
// deadline exactly now is already elapsed, mirroring mono's strict >).
func (s *UnitHealthState) IsCooling(nowMs int64) bool {
	return s.CooldownUntilMs > nowMs
}

// SlowStartFactor is the sampling multiplier the selector rides (mono's
// slow_start_factor): a real failure exits the ramp, a cooling settlement
// starts from the floor, and an untrusted count ramps linearly.
func (s *UnitHealthState) SlowStartFactor(minRequests int) float64 {
	if minRequests <= 0 || s.RampExited {
		return 1.0
	}
	if s.RampPending {
		return 1.0 / float64(minRequests)
	}
	if s.RequestCount == 0 || s.RequestCount >= minRequests {
		return 1.0
	}
	return float64(s.RequestCount) / float64(minRequests)
}

// updateUnitLatencyEwma applies the peak-sensitive latency EWMA (mono's
// p2cPeakEwma semantics): an upward spike takes effect immediately, an
// upward-to-downward move decays toward the newest sample with the 10s
// time constant, and the first sample sets the baseline.
func updateUnitLatencyEwma(st *UnitHealthState, latencyMs int64, nowMs int64) {
	sample := float64(latencyMs)
	if st.LatencyUpdatedAtMs == 0 || st.LatencyEwmaMs == 0 || sample >= st.LatencyEwmaMs {
		st.LatencyEwmaMs = sample
	} else {
		elapsed := nowMs - st.LatencyUpdatedAtMs
		if elapsed < 0 {
			elapsed = 0
		}
		decay := math.Exp(-float64(elapsed) / LatencyEwmaDecayMs)
		st.LatencyEwmaMs = sample + (st.LatencyEwmaMs-sample)*decay
	}
	st.LatencyUpdatedAtMs = nowMs
}

// ageUnitEwmaScore ages the stored score toward the default with the
// ScoreDecayTauMs time constant (mono's age_ewma_score):
// prior' = 1 - (1-prior)×exp(-Δt/τ). No baseline or a disabled τ leaves
// the score untouched.
func ageUnitEwmaScore(st *UnitHealthState, cfg *UnitHealthSetting, nowMs int64) float64 {
	if cfg.ScoreDecayTauMs == 0 || st.ScoreUpdatedAtMs == 0 {
		return st.EwmaScore
	}
	dt := nowMs - st.ScoreUpdatedAtMs
	if dt < 0 {
		dt = 0
	}
	decay := math.Exp(-float64(dt) / float64(cfg.ScoreDecayTauMs))
	return DefaultUnitScore - (DefaultUnitScore-st.EwmaScore)*decay
}

// finishUnitCooldown settles a cooling window (mono's finish_cooldown):
// clears the deadline, zeroes the request count, arms the slow-start ramp
// and re-anchors the idle decay at nowMs. The settleStrike argument is
// newapi's disable-strike hook: a naturally expired window that was armed
// by a Fatal outcome adds a strike (429 windows never do — a busy
// upstream is not a dead model), and reaching the cap flips
// TerminalDisabled. A forced recall settles without a strike: recall is a
// rescue, not forgiveness.
func finishUnitCooldown(st *UnitHealthState, nowMs int64, settleStrike bool) {
	st.CooldownUntilMs = 0
	st.RequestCount = 0
	st.RampExited = false
	st.RampPending = true
	st.AnnealSinceMs = nowMs
	if settleStrike && st.LastCoolingOutcome == int(UnitFatal) {
		st.DisableStreak++
	}
	st.TerminalDisabled = st.DisableStreak >= UnitDisableStreakCap
}

// annealUnitStreak decays the idle streak ledgers (mono's anneal_streak):
// with no active cooldown, no anchor, or nothing left to decay it is a
// no-op; otherwise each full CooldownBaseMs window elapsing since the
// anchor pays both ledgers down by one, with the remainder carried into
// the next settlement. An all-zero result clears the anchor. Returns
// whether the state moved.
func annealUnitStreak(st *UnitHealthState, cfg *UnitHealthSetting, nowMs int64) bool {
	if st.CooldownUntilMs != 0 || st.AnnealSinceMs == 0 ||
		(st.CooldownStreak == 0 && st.ThrottleStreak == 0) || cfg.CooldownBaseMs == 0 {
		return false
	}
	steps := (nowMs - st.AnnealSinceMs) / cfg.CooldownBaseMs
	if steps <= 0 {
		return false
	}
	st.CooldownStreak -= int(steps)
	if st.CooldownStreak < 0 {
		st.CooldownStreak = 0
	}
	st.ThrottleStreak -= int(steps)
	if st.ThrottleStreak < 0 {
		st.ThrottleStreak = 0
	}
	st.AnnealSinceMs += steps * cfg.CooldownBaseMs
	if st.CooldownStreak == 0 && st.ThrottleStreak == 0 {
		st.AnnealSinceMs = 0
	}
	return true
}

// unitCooldownDurationMs is the fatal ladder rung for streak n
// (mono's cooldown_duration_ms):
// min(max, base + (max-base)×(n/N)²), N = CooldownRampSteps. The first
// failure sits at rung 0 = base; n ≥ N clamps to the ceiling. A
// degenerate base/max pair collapses to base.
func unitCooldownDurationMs(cfg *UnitHealthSetting, streak int) int64 {
	base, max := cfg.CooldownBaseMs, cfg.CooldownMaxMs
	if base == 0 || max == 0 || max <= base {
		return base
	}
	steps := float64(cfg.CooldownRampSteps)
	if steps < 1 {
		steps = 1
	}
	n := math.Min(float64(streak), steps)
	if n < 0 {
		n = 0
	}
	ramp := (n / steps) * (n / steps)
	return int64(clampCoolingDuration(float64(base)+float64(max-base)*ramp, base, max))
}

// unitThrottleCooldownDurationMs is the 429 ladder rung: same power-law
// shape over ThrottleBaseMs → ThrottleMaxMs with the fixed four-rung view
// (mono's throttle_cooldown_duration_ms).
func unitThrottleCooldownDurationMs(cfg *UnitHealthSetting, streak int) int64 {
	base, max := cfg.ThrottleBaseMs, cfg.ThrottleMaxMs
	if base == 0 || max == 0 || max <= base {
		return base
	}
	steps := float64(ThrottleRampSteps)
	n := math.Min(float64(streak), steps)
	if n < 0 {
		n = 0
	}
	ramp := (n / steps) * (n / steps)
	return int64(clampCoolingDuration(float64(base)+float64(max-base)*ramp, base, max))
}

// clampCoolingDuration clamps a ladder value into [base, max], exactly
// like mono's `x.min(max).max(base)` (callers already excluded the
// degenerate max ≤ base pair).
func clampCoolingDuration(v float64, base, max int64) float64 {
	if v > float64(max) {
		v = float64(max)
	}
	if v < float64(base) {
		v = float64(base)
	}
	return v
}

// startUnitCooldown arms a cooldown for a Fatal/Throttled outcome
// (mono's start_cooldown). A 401/403 escalation goes straight to the max
// rung; a plain fatal takes its rung from the current streak before
// climbing it; a 429 walks its own ladder and the Retry-After hint
// (retryAfterMs >= 0, in ms) overrides the rung, clamped to
// CooldownMaxMs — the cap mono's hint path uses, which is deliberately
// wider than the throttle ladder's own ceiling. A zero duration arms
// nothing.
func startUnitCooldown(st *UnitHealthState, cfg *UnitHealthSetting, nowMs int64, outcome UnitOutcome, retryAfterMs int64) {
	maxMs := cfg.CooldownMaxMs
	var requested int64
	switch {
	case outcome == UnitFatal && st.UnauthorizedRun >= UnauthorizedEscalationThreshold:
		st.CooldownStreak++
		requested = maxMs
	case outcome == UnitThrottled:
		st.ThrottleStreak++
		requested = unitThrottleCooldownDurationMs(cfg, st.ThrottleStreak)
		if retryAfterMs >= 0 {
			if hint := retryAfterMs; hint < maxMs {
				requested = hint
			} else {
				requested = maxMs
			}
		}
	default:
		// Take the rung from the current streak before climbing it:
		// the first failure lands on rung 0 = base.
		requested = unitCooldownDurationMs(cfg, st.CooldownStreak)
		st.CooldownStreak++
	}
	if requested > maxMs {
		requested = maxMs
	}
	if requested == 0 {
		return
	}
	st.LastCoolingOutcome = int(outcome)
	st.RequestCount = 0
	st.RampExited = false
	st.CooldownUntilMs = nowMs + requested
}

// applyUnitOutcome runs one recorded attempt through the machine, exactly
// as mono's apply_outcome (plus the latency EWMA pre-step mono's record
// does). latencyMs <= 0 carries no latency observation (failures pass
// none; only success timing feeds the peak EWMA). retryAfterMs < 0 means
// "no hint". escalate=false (pool under pressure) suppresses arming a NEW
// cooldown — the failure's EWMA/streak evidence still lands, but nothing
// newly egresses the pool while the pool is already short.
func applyUnitOutcome(st *UnitHealthState, outcome UnitOutcome, nowMs int64, latencyMs int64, retryAfterMs int64, escalate bool, cfg *UnitHealthSetting) {
	if latencyMs > 0 {
		updateUnitLatencyEwma(st, latencyMs, nowMs)
	}

	// Settle an expired cooldown first: post-expiry outcomes re-enter the
	// slow-start ramp cleanly.
	if st.CooldownUntilMs != 0 && !st.IsCooling(nowMs) {
		finishUnitCooldown(st, nowMs, true)
	}

	// 401/403: count the run; at the threshold the outcome escalates to
	// Fatal and every other branch resets the run.
	if outcome == UnitUnauthorized {
		if st.UnauthorizedRun < UnauthorizedEscalationThreshold {
			st.UnauthorizedRun++
		}
		if st.UnauthorizedRun < UnauthorizedEscalationThreshold {
			return // isolated credential error: channel is not at fault
		}
		outcome = UnitFatal
	} else {
		st.UnauthorizedRun = 0
	}

	switch outcome {
	case UnitNeutral:
		// Plain 4xx (400/404/...): the channel is not at fault — no score
		// change, no request count, no cooldown entry; early return as-is
		// (mono's ChannelOutcome::Neutral arm).
		return
	case UnitSuccess:
		// An active event re-anchors the decay: the idle window restarts.
		st.AnnealSinceMs = 0
		// A clean success after an expired cooldown pays the ledger
		// down one rung (both ledgers — 429 relief and fatal relief).
		if st.CooldownStreak > 0 && st.CooldownUntilMs == 0 {
			st.CooldownStreak--
		}
		if st.ThrottleStreak > 0 && st.CooldownUntilMs == 0 {
			st.ThrottleStreak--
		}
	}
	// Neutral returns above; Fatal/Throttled carry no counters — the
	// cooldown ladder below is the whole penalty.

	observation := DefaultUnitScore
	switch outcome {
	case UnitFatal:
		observation = 0.0
	case UnitThrottled:
		observation = ThrottledObservation
	}

	st.RequestCount++
	st.RampPending = false
	// A real failure exits the slow-start ramp immediately.
	if outcome == UnitFatal {
		st.RampExited = true
	}

	// Pre-trust gate (strict >, mono's): the first MinRequests
	// observations establish trust and do not move the score.
	if st.RequestCount > cfg.MinRequests {
		prior := ageUnitEwmaScore(st, cfg, nowMs)
		st.EwmaScore = cfg.Alpha*observation + (1.0-cfg.Alpha)*prior
		if st.EwmaScore < cfg.MinScoreFloor {
			st.EwmaScore = cfg.MinScoreFloor
		}
		st.ScoreUpdatedAtMs = nowMs
	}

	// Any single fatal/throttled arms a cooldown immediately — there is
	// no "N consecutive" threshold; the ladder carries the punishment.
	if (outcome == UnitFatal || outcome == UnitThrottled) && escalate {
		startUnitCooldown(st, cfg, nowMs, outcome, retryAfterMs)
	}
}

// ClassifyUnitOutcome classifies one relay attempt for the unit machine
// (mono's record Ok/Err split, on newapi's error type). Channel-internal
// failures and 5xx are Fatal — the channel cannot serve right now; 429 is
// Throttled; 401/403 is Unauthorized, where the machine owns the
// escalation run; anything else is the caller's problem and stays
// Neutral. The channel-level outcome ledger (ClassifyChannelOutcome)
// keeps its own independent classification for the fallback family.
func ClassifyUnitOutcome(err *types.NewAPIError, channelID int) UnitOutcome {
	if err == nil {
		return UnitSuccess
	}
	// A client-canceled attempt says nothing about the channel: the transport
	// failure merely rides a 500 wrapper, so it must not arm a fatal cooldown.
	// Mirrors the failover loop's cancellation rule (classifyAttempt).
	if errors.Is(err, context.Canceled) {
		return UnitNeutral
	}
	switch {
	case types.IsChannelError(err) || err.GetErrorCode() == types.ErrorCodeBadResponseBody:
		return UnitFatal
	case err.StatusCode == http.StatusTooManyRequests:
		return UnitThrottled
	case err.StatusCode == http.StatusUnauthorized || err.StatusCode == http.StatusForbidden:
		return UnitUnauthorized
	case err.StatusCode >= http.StatusInternalServerError:
		return UnitFatal
	default:
		return UnitNeutral
	}
}
