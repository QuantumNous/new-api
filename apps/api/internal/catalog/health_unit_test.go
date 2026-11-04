package channel

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// freshUnitConfig returns a copy of the newapi default setting, so tests can
// mutate a single knob without disturbing the package default.
func freshUnitConfig() *UnitHealthSetting {
	return DefaultUnitHealthSetting()
}

// applyOutcome drives one attempt through the pure state machine with the
// given config, at an explicit nowMs. retryAfterMs < 0 means "no hint".
func applyOutcome(t *testing.T, st *UnitHealthState, outcome UnitOutcome, nowMs int64, retryAfterMs int64, cfg *UnitHealthSetting) {
	t.Helper()
	applyUnitOutcome(st, outcome, nowMs, 0, retryAfterMs, true, cfg)
}

// TestUnitCooldownDurationMs_FatalLadder pins the fatal rung table for the
// default ladder (base 300ms, ceiling 10000ms, N=12). Each value is the
// exact int64 truncation of base + (max-base)*(n/N)^2, cross-checked against
// the formula; n>=N clamps to the ceiling.
func TestUnitCooldownDurationMs_FatalLadder(t *testing.T) {
	cfg := freshUnitConfig()
	base, max, N := cfg.CooldownBaseMs, cfg.CooldownMaxMs, cfg.CooldownRampSteps
	require.Equal(t, int64(300), base)
	require.Equal(t, int64(10000), max)
	require.Equal(t, 12, N)

	// Reference table, computed from base+(max-base)*(n/N)^2 (truncated).
	// n=0..4 match the port spec exactly (300/367/569/906/1377).
	expect := map[int]int64{
		0:  300,
		1:  367,
		2:  569,
		3:  906,
		4:  1377,
		5:  1984,
		6:  2725,
		7:  3600,
		8:  4611,
		9:  5756,
		10: 7036,
		11: 8450,
		12: 10000,
	}
	for n := 0; n <= 13; n++ {
		want := expect[n]
		if n > 12 {
			want = max // clamp: the curve reaches its ceiling at N and stays there
		}
		got := unitCooldownDurationMs(cfg, n)
		assert.Equal(t, want, got, "fatal rung n=%d", n)

		// Cross-check against the closed form so the table can't drift from
		// the implementation it pins.
		fst := float64(n)
		if fst > float64(N) {
			fst = float64(N)
		}
		ramp := (fst / float64(N)) * (fst / float64(N))
		formula := float64(base) + float64(max-base)*ramp
		if formula > float64(max) {
			formula = float64(max)
		}
		if formula < float64(base) {
			formula = float64(base)
		}
		assert.Equal(t, int64(formula), got, "formula cross-check n=%d", n)
	}
}

// TestUnitCooldownDurationMs_DegenerateLadder pins the collapsed-base edge:
// when max <= base the ladder is flat at base, not a curve.
func TestUnitCooldownDurationMs_DegenerateLadder(t *testing.T) {
	cfg := freshUnitConfig()
	cfg.CooldownBaseMs = 500
	cfg.CooldownMaxMs = 300 // max < base → degenerate
	for n := 0; n < 5; n++ {
		assert.Equal(t, int64(500), unitCooldownDurationMs(cfg, n), "flat at base for n=%d", n)
	}
}

// TestUnitThrottleCooldownDurationMs_Ladder pins the independent 429 ladder
// (base 200ms, ceiling 1000ms, 4 rungs): 200/250/400/650/1000.
func TestUnitThrottleCooldownDurationMs_Ladder(t *testing.T) {
	cfg := freshUnitConfig()
	expect := map[int]int64{0: 200, 1: 250, 2: 400, 3: 650, 4: 1000}
	for n := 0; n <= 5; n++ {
		want := expect[n]
		if n > 4 {
			want = cfg.ThrottleMaxMs
		}
		assert.Equal(t, want, unitThrottleCooldownDurationMs(cfg, n), "throttle rung n=%d", n)
	}
}

// TestThrottleOutcome_WalksOwnLadderAndPreservesFatalStreak verifies that a 429
// walks the throttle ledger without touching the fatal cooldown streak, and
// arms a cooldown on the throttle rung.
func TestThrottleOutcome_WalksOwnLadderAndPreservesFatalStreak(t *testing.T) {
	cfg := freshUnitConfig()
	st := NewUnitHealthState()
	st.CooldownStreak = 2 // an in-progress fatal streak must not move

	nowMs := int64(1_000_000)
	applyOutcome(t, st, UnitThrottled, nowMs, -1, cfg)

	assert.Equal(t, 2, st.CooldownStreak, "fatal streak untouched by a 429")
	assert.Equal(t, 1, st.ThrottleStreak, "first 429 climbs the throttle rung")
	assert.Equal(t, nowMs+250, st.CooldownUntilMs, "cooldown armed on throttle rung 1")
	assert.Equal(t, int(UnitThrottled), st.LastCoolingOutcome)

	// A second 429 climbs the next throttle rung.
	applyOutcome(t, st, UnitThrottled, nowMs+1000, -1, cfg)
	assert.Equal(t, 2, st.ThrottleStreak)
}

// TestThrottleOutcome_RetryAfterHintOverridesRung pins the Retry-After
// override: a hint in ms replaces the ladder rung, clamped to CooldownMaxMs
// (mono's start_cooldown uses the wider fatal ceiling, not the throttle max).
func TestThrottleOutcome_RetryAfterHintOverridesRung(t *testing.T) {
	cfg := freshUnitConfig()
	nowMs := int64(1_000_000)

	// Hint below the ceiling: the hint itself is the cooldown.
	st1 := NewUnitHealthState()
	applyOutcome(t, st1, UnitThrottled, nowMs, 500, cfg)
	assert.Equal(t, nowMs+500, st1.CooldownUntilMs, "500ms hint used verbatim")

	// Hint above the ceiling: clamped to CooldownMaxMs (10000ms).
	st2 := NewUnitHealthState()
	applyOutcome(t, st2, UnitThrottled, nowMs, 15000, cfg)
	assert.Equal(t, nowMs+10000, st2.CooldownUntilMs, "15000ms hint clamps to the fatal ceiling")
}

// TestUnauthorizedRun_EscalatesAtThree pins the 401/403 escalation: two
// isolated 401s are Neutral (no cooldown, no score move); the third escalates
// to Fatal at the max rung; a subsequent non-401 resets the run.
func TestUnauthorizedRun_EscalatesAtThree(t *testing.T) {
	cfg := freshUnitConfig()
	st := NewUnitHealthState()
	nowMs := int64(2_000_000)

	// 1st 401: counted, settled as Neutral — no cooldown, no request count.
	applyOutcome(t, st, UnitUnauthorized, nowMs, -1, cfg)
	assert.Equal(t, 1, st.UnauthorizedRun)
	assert.Equal(t, int64(0), st.CooldownUntilMs, "isolated 401 arms no cooldown")
	assert.Equal(t, 0, st.RequestCount, "isolated 401 counts no request")

	// 2nd 401: still under the threshold.
	applyOutcome(t, st, UnitUnauthorized, nowMs, -1, cfg)
	assert.Equal(t, 2, st.UnauthorizedRun)
	assert.Equal(t, int64(0), st.CooldownUntilMs)

	// 3rd 401: escalates to Fatal at the max rung.
	applyOutcome(t, st, UnitUnauthorized, nowMs, -1, cfg)
	assert.Equal(t, cfg.CooldownMaxMs, st.CooldownUntilMs-nowMs, "third 401 lands on the max rung")
	assert.Equal(t, 1, st.CooldownStreak, "escalation climbs the fatal streak")

	// A non-401 resets the run.
	applyOutcome(t, st, UnitSuccess, nowMs, -1, cfg)
	assert.Equal(t, 0, st.UnauthorizedRun, "a non-401 resets the credential run")
}

// TestEwmaScore_AgesTowardDefaultBeforeBlend pins the aging formula
// prior' = 1 - (1-prior)*exp(-dt/tau) plus the disabled / no-baseline cases.
func TestEwmaScore_AgesTowardDefaultBeforeBlend(t *testing.T) {
	cfg := freshUnitConfig()
	require.Equal(t, int64(900000), cfg.ScoreDecayTauMs)

	const nowMs = int64(1_000_000)
	st := NewUnitHealthState()

	// No baseline: the score is returned untouched.
	st.EwmaScore = 0.5
	st.ScoreUpdatedAtMs = 0
	assert.Equal(t, 0.5, ageUnitEwmaScore(st, cfg, nowMs), "no baseline → no aging")

	// Disabled tau: the score is frozen.
	cfgFrozen := freshUnitConfig()
	cfgFrozen.ScoreDecayTauMs = 0
	st.ScoreUpdatedAtMs = 500000
	assert.Equal(t, 0.5, ageUnitEwmaScore(st, cfgFrozen, nowMs), "disabled tau → no aging")

	// One full tau: prior' = 1 - 0.5*exp(-1) = 0.8160602794...
	st.ScoreUpdatedAtMs = nowMs - 900000
	aged := ageUnitEwmaScore(st, cfg, nowMs)
	assert.InDelta(t, 0.8160602794, aged, 1e-6, "half-life aging after one tau")
}

// TestEwmaScore_PreTrustGateFreezesScore pins the strict request_count >
// min_requests gate: the first MinRequests observations do not move the score;
// the (MinRequests+1)th does.
func TestEwmaScore_PreTrustGateFreezesScore(t *testing.T) {
	cfg := freshUnitConfig()
	cfg.ScoreDecayTauMs = 0 // disable aging so the blend math is exact
	require.Equal(t, 5, cfg.MinRequests)

	const nowMs = int64(3_000_000)
	st := NewUnitHealthState()

	// Five successes establish trust but keep the score at its default.
	for i := 0; i < 5; i++ {
		applyOutcome(t, st, UnitSuccess, nowMs, -1, cfg)
	}
	assert.Equal(t, 5, st.RequestCount)
	assert.Equal(t, 1.0, st.EwmaScore, "score frozen until the trust gate opens")

	// The sixth observation (a fatal) is the first that moves the score:
	// score = alpha*0 + (1-alpha)*1.0 = 0.7. The arming cooldown then
	// zeros the count (mono's start_cooldown re-arms slow start).
	applyOutcome(t, st, UnitFatal, nowMs, -1, cfg)
	assert.Equal(t, 0, st.RequestCount, "the fatal re-arm zeros the count")
	assert.InDelta(t, 0.7, st.EwmaScore, 1e-9, "sixth observation blends the first EWMA sample")
}

// TestEwmaScore_FlooredAtMinScoreFloor pins the lower bound: the score never
// dips below MinScoreFloor no matter how many fatals land.
func TestEwmaScore_FlooredAtMinScoreFloor(t *testing.T) {
	cfg := freshUnitConfig()
	cfg.ScoreDecayTauMs = 0
	cfg.Alpha = 0.9
	cfg.MinRequests = 1
	require.Equal(t, 0.05, cfg.MinScoreFloor)

	const t0 = int64(4_000_000)
	st := NewUnitHealthState()

	// 1st fatal: gate still closed (RequestCount=1, not > 1), and arming
	// the cooldown zeros the count again (mono's start_cooldown). Score stays 1.0.
	applyOutcome(t, st, UnitFatal, t0, -1, cfg)
	assert.Equal(t, 1.0, st.EwmaScore)

	// The window's expiry settles on the next outcome, zeroing the count
	// again: the gate needs two post-cooldown observations to reopen. The
	// success is the first, this fatal the second → 0.9*0 + 0.1*1.0 = 0.1.
	applyOutcome(t, st, UnitSuccess, t0+20_000, -1, cfg)
	applyOutcome(t, st, UnitFatal, t0+20_000, -1, cfg)
	assert.InDelta(t, 0.1, st.EwmaScore, 1e-9)

	// Same two-observation dance after the next window: 0.9*0 + 0.1*0.1
	// = 0.01 → floored at 0.05.
	applyOutcome(t, st, UnitSuccess, t0+40_000, -1, cfg)
	applyOutcome(t, st, UnitFatal, t0+40_000, -1, cfg)
	assert.InDelta(t, 0.05, st.EwmaScore, 1e-9, "score clamps at the floor")
}

// TestLatencyEwma_PeakSensitive pins the peak-latency shape: the first sample
// sets the baseline, an upward spike takes effect immediately, and an
// upward-to-downward move decays toward the newest sample with the 10s
// constant.
func TestLatencyEwma_PeakSensitive(t *testing.T) {
	const t0 = int64(10_000_000)
	st := NewUnitHealthState()

	// First sample establishes the baseline.
	updateUnitLatencyEwma(st, 100, t0)
	assert.InDelta(t, 100.0, st.LatencyEwmaMs, 1e-9)
	assert.Equal(t, t0, st.LatencyUpdatedAtMs)

	// An upward spike takes effect immediately (peak sensitivity).
	updateUnitLatencyEwma(st, 500, t0+1000)
	assert.InDelta(t, 500.0, st.LatencyEwmaMs, 1e-9)

	// A downward move decays toward the newest sample over the 10s constant:
	// elapsed = 9000ms, decay = exp(-0.9), new = 200 + 300*exp(-0.9).
	updateUnitLatencyEwma(st, 200, t0+10000)
	want := 200.0 + 300.0*math.Exp(-9000.0/LatencyEwmaDecayMs)
	assert.InDelta(t, want, st.LatencyEwmaMs, 1e-3, "downward move decays toward the newest sample")
}

// TestSlowStartFactor_Sequence pins the sampling multiplier across a full
// post-cooldown ramp: the floor, the linear climb, and the RampExited
// stickiness.
func TestSlowStartFactor_Sequence(t *testing.T) {
	const minReq = 5
	st := NewUnitHealthState()

	// A never-observed unit is fully trusted.
	assert.Equal(t, 1.0, st.SlowStartFactor(minReq))

	// Just after a cooldown settlement: the ramp floor.
	st.RampPending = true
	assert.InDelta(t, 0.2, st.SlowStartFactor(minReq), 1e-9, "ramp floor = 1/MinRequests")

	// The ramp clears on the first observation and climbs linearly.
	st.RampPending = false
	for k := 1; k <= minReq; k++ {
		st.RequestCount = k
		want := float64(k) / float64(minReq)
		if k >= minReq {
			want = 1.0
		}
		assert.InDelta(t, want, st.SlowStartFactor(minReq), 1e-9, "k=%d", k)
	}

	// A real failure exits the ramp: the multiplier is stuck at 1.0 even with
	// a low count.
	st.RampExited = true
	st.RequestCount = 1
	assert.Equal(t, 1.0, st.SlowStartFactor(minReq), "RampExited sticks the multiplier at full")
}

// TestFinishCooldown_ArmsRampZeroesCountKeepsStreaks pins the settlement
// contract: the deadline clears, the request count zeros, the slow-start ramp
// arms, and the streak ledgers are preserved (only a strike, when enabled,
// moves the disable counter).
func TestFinishCooldown_ArmsRampZeroesCountKeepsStreaks(t *testing.T) {
	const nowMs = int64(5_000_000)

	st := NewUnitHealthState()
	st.CooldownUntilMs = nowMs
	st.LastCoolingOutcome = int(UnitFatal)
	st.RequestCount = 3
	st.CooldownStreak = 2
	st.ThrottleStreak = 1
	st.AnnealSinceMs = nowMs - 1000

	// A force-recall settlement: ramp armed, streaks preserved, and the
	// recovery-probe question opened — the recalled unit is on probation.
	finishUnitCooldown(st, nowMs)
	assert.Equal(t, int64(0), st.CooldownUntilMs, "deadline cleared")
	assert.Equal(t, 0, st.RequestCount, "request count zeroed")
	assert.True(t, st.RampPending, "slow-start ramp armed")
	assert.False(t, st.RampExited)
	assert.Equal(t, nowMs, st.AnnealSinceMs, "idle decay re-anchored")
	assert.Equal(t, 2, st.CooldownStreak, "fatal streak preserved")
	assert.Equal(t, 1, st.ThrottleStreak, "throttle streak preserved")
	assert.True(t, st.ProbePending, "a force recall puts the unit on probation")
}

// TestFinishCooldown_OpensRecoveryProbe pins the probe ledger: a naturally
// expired Fatal window arms the recovery-probe question (the next outcome is
// the probe); a 429 window never does.
func TestFinishCooldown_OpensRecoveryProbe(t *testing.T) {
	const nowMs = int64(6_000_000)

	fatal := NewUnitHealthState()
	fatal.CooldownUntilMs = nowMs
	fatal.LastCoolingOutcome = int(UnitFatal)
	finishUnitCooldown(fatal, nowMs)
	assert.True(t, fatal.ProbePending, "a fatal expiry opens the recovery probe")
	assert.False(t, fatal.TerminalDisabled, "health never terminal-disables")

	throttled := NewUnitHealthState()
	throttled.CooldownUntilMs = nowMs
	throttled.LastCoolingOutcome = int(UnitThrottled)
	finishUnitCooldown(throttled, nowMs)
	assert.True(t, throttled.ProbePending, "a 429 expiry also opens the probe question")
	assert.False(t, throttled.TerminalDisabled)
}

// TestAnnealStreak_IdleWindowsPaysDownTheLedgers pins the idle decay: each
// full CooldownBaseMs window since the anchor pays both ledgers down by one,
// the remainder carries, and an all-zero result clears the anchor.
func TestAnnealStreak_IdleWindowsPaysDownTheLedgers(t *testing.T) {
	cfg := freshUnitConfig()
	require.Equal(t, int64(300), cfg.CooldownBaseMs)

	// An active cooldown is never annealed.
	live := NewUnitHealthState()
	live.CooldownUntilMs = 1000
	live.AnnealSinceMs = 100
	live.CooldownStreak = 4
	assert.False(t, annealUnitStreak(live, cfg, 5000), "an active cooldown is a no-op")
	assert.Equal(t, 4, live.CooldownStreak)

	// No anchor → no-op.
	unanchored := NewUnitHealthState()
	unanchored.CooldownStreak = 4
	assert.False(t, annealUnitStreak(unanchored, cfg, 5000), "no anchor is a no-op")

	// Idle with an anchor: 300ms windows pay the ledgers down. The anchor
	// is nonzero because zero is the no-anchor sentinel.
	idle := NewUnitHealthState()
	const anchor = int64(1_000)
	idle.AnnealSinceMs = anchor
	idle.CooldownStreak = 4
	idle.ThrottleStreak = 2
	assert.True(t, annealUnitStreak(idle, cfg, anchor+900), "900ms pays three windows")
	assert.Equal(t, 1, idle.CooldownStreak, "4 - 3 windows")
	assert.Equal(t, 0, idle.ThrottleStreak, "2 - 3 windows floors at zero")
	assert.Equal(t, int64(1_900), idle.AnnealSinceMs, "consumed windows advance the anchor")

	// A further 300ms pays the last fatal window; both ledgers zero, clearing
	// the anchor.
	assert.True(t, annealUnitStreak(idle, cfg, anchor+1200))
	assert.Equal(t, 0, idle.CooldownStreak)
	assert.Equal(t, int64(0), idle.AnnealSinceMs, "all-zero clears the anchor")
}

// TestNeutralOutcome_CountsNothing pins the channel-not-at-fault contract: a
// plain 4xx changes no score, no counter, no cooldown (mono's Neutral early
// return).
func TestNeutralOutcome_CountsNothing(t *testing.T) {
	cfg := freshUnitConfig()
	st := NewUnitHealthState()
	before := *st
	applyOutcome(t, st, UnitNeutral, 7_000_000, -1, cfg)
	assert.Equal(t, before, *st, "a neutral outcome is a no-op")
}

// TestSuccessOutcome_ReleasesLedgersAndReAnchors pins the success relief: a
// clean success after an expired cooldown pays both ledgers down one rung and
// re-anchors the idle decay.
func TestSuccessOutcome_ReleasesLedgersAndReAnchors(t *testing.T) {
	cfg := freshUnitConfig()
	const nowMs = int64(8_000_000)

	st := NewUnitHealthState()
	st.CooldownStreak = 3
	st.ThrottleStreak = 2
	st.AnnealSinceMs = nowMs - 5000
	st.CooldownUntilMs = 0 // expired / not cooling

	applyOutcome(t, st, UnitSuccess, nowMs, -1, cfg)
	assert.Equal(t, 2, st.CooldownStreak, "a success pays the fatal ledger down one")
	assert.Equal(t, 1, st.ThrottleStreak, "a success pays the throttle ledger down one")
	assert.Equal(t, int64(0), st.AnnealSinceMs, "an active event re-anchors the decay")
}

// TestExpiredCooldown_SettlesBeforeTheNewOutcome pins the settle-first order:
// an outcome that arrives after a cooldown has elapsed settles it (into the
// slow-start ramp) before charging the new observation.
func TestExpiredCooldown_SettlesBeforeTheNewOutcome(t *testing.T) {
	cfg := freshUnitConfig()
	const t0 = int64(9_000_000)

	st := NewUnitHealthState()
	// Arm a 300ms fatal cooldown at t0 (first failure → rung 0 = base).
	applyOutcome(t, st, UnitFatal, t0, -1, cfg)
	require.Equal(t, t0+300, st.CooldownUntilMs)
	require.True(t, st.IsCooling(t0+100))

	// A success that arrives at t0+400 settles the expired window first: the
	// ramp arms, the request count resets, and the success is then charged —
	// charging consumes ramp_pending (mono), leaving the factor at 1/MinReq.
	applyOutcome(t, st, UnitSuccess, t0+400, -1, cfg)
	assert.False(t, st.RampPending, "the charging observation consumes the ramp flag")
	assert.InDelta(t, 0.2, st.SlowStartFactor(cfg.MinRequests), 1e-9, "the settled unit samples from the ramp floor")
	assert.False(t, st.IsCooling(t0+400))
	assert.Equal(t, 1, st.RequestCount, "the settling success is then counted")
}

// wrappedClientCancelError rebuilds the production shape of a client
// disconnect: doRequest wraps the transport error in a NewAPIError (keeping the
// sentinel), DoApiRequest wraps that again, and the relay handler re-wraps it as
// an OpenAI error carrying status 500.
func wrappedClientCancelError(t *testing.T) *types.NewAPIError {
	t.Helper()
	transportErr := types.NewError(context.Canceled, types.ErrorCodeDoRequestFailed,
		types.ErrOptionWithStatusCode(http.StatusInternalServerError))
	return types.NewOpenAIError(fmt.Errorf("do request failed: %w", transportErr),
		types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
}

// TestClassifyUnitOutcome_ClientCancelIsNeutral is the regression gate for
// client-cancel accounting: the cancel rides a 500 wrapper, so the status
// switch classified it as a channel failure and eventually terminal-disabled a
// healthy route unit.
func TestClassifyUnitOutcome_ClientCancelIsNeutral(t *testing.T) {
	canceled := wrappedClientCancelError(t)
	require.ErrorIs(t, canceled, context.Canceled)
	require.Equal(t, http.StatusInternalServerError, canceled.StatusCode,
		"sanity: the cancel carries the same 500 the upstream-failure branch matches")

	cases := []struct {
		name string
		err  *types.NewAPIError
		want UnitOutcome
	}{
		{"wrapped client cancel is neutral", canceled, UnitNeutral},
		{"real upstream 500 stays fatal",
			types.NewOpenAIError(errors.New("upstream exploded"), types.ErrorCodeBadResponseStatusCode,
				http.StatusInternalServerError),
			UnitFatal},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ClassifyUnitOutcome(tc.err, 7))
		})
	}
}

// TestClientCancel_NeverDisablesUnit drives repeated canceled classifications
// through the state machine: a canceled request must never arm a cooldown or
// advance the recovery-probe ledger.
func TestClientCancel_NeverDisablesUnit(t *testing.T) {
	cfg := freshUnitConfig()
	st := NewUnitHealthState()
	st.ProbePending = true
	st.ProbeFailStreak = 2
	canceled := wrappedClientCancelError(t)

	for i := range 10 {
		outcome := ClassifyUnitOutcome(canceled, 7)
		require.Equal(t, UnitNeutral, outcome, "cancel %d must classify as neutral", i)
		nowMs := int64(1_000 + i*1_000)
		applyOutcome(t, st, outcome, nowMs, -1, cfg)
		assert.False(t, st.IsCooling(nowMs), "cancel %d must not arm a cooldown", i)
	}

	assert.Equal(t, int64(0), st.CooldownUntilMs, "no cooldown window")
	assert.False(t, st.TerminalDisabled, "a healthy unit survives repeated client cancels")
	assert.Equal(t, 0, st.RequestCount, "neutral outcomes are a no-op")
	assert.Equal(t, DefaultUnitScore, st.EwmaScore, "the score is untouched")
	assert.True(t, st.ProbePending, "a neutral outcome leaves the probe question open")
	assert.Equal(t, 2, st.ProbeFailStreak, "a neutral outcome never advances the probe ledger")
}
