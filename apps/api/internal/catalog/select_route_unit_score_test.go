package channel

import (
	"math/rand/v2"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/internal/catalog/routestats"
	"github.com/QuantumNous/new-api/internal/common/dbx"
)

// withRouteStats installs a route stats config for one test and restores the
// previous one, so a window size or floor set here cannot leak into a sibling.
// Route state and share windows are cleared on both sides: EWMA samples are
// process-global, and a leftover sample would silently move another test's share.
func withRouteStats(t *testing.T, mutate func(cfg *routestats.RouteStatsSetting)) {
	t.Helper()
	previous := routestats.GetRouteStatsSetting()
	cfg := routestats.DefaultRouteStatsSetting()
	if mutate != nil {
		mutate(cfg)
	}
	routestats.Reset()
	routestats.ResetShares()
	routestats.SetRouteStatsSetting(cfg)
	t.Cleanup(func() {
		routestats.SetRouteStatsSetting(previous)
		routestats.Reset()
		routestats.ResetShares()
	})
}

// observeQuality drives a route handle to a known quality by feeding it explicit
// observations. It is the only honest way to test the wiring: reaching into the
// EWMA state would prove the test can write a float, not that selection reads it.
//
// successRate is applied as a first observation (the EWMA seeds to its first
// sample), and ttftMs/tps are applied the same way. Extra success samples top the
// count past MinSamples so ComputeQuality stops returning neutral 1.0.
func observeQuality(t *testing.T, key routestats.RouteKey, successRate, ttftMs, tps float64, samples int) {
	t.Helper()
	h := routestats.GetOrCreateHandle(key)
	require.NotNil(t, h)
	if ttftMs > 0 {
		h.ObserveTTFT(ttftMs)
	}
	if tps > 0 {
		h.ObserveTPS(tps)
	}
	for range samples {
		h.ObserveSuccess(successRate)
	}
}

func routeStatsKey(alias, upstream string, channelID int) routestats.RouteKey {
	return routestats.RouteKey{
		PublicModelAlias: alias,
		ChannelID:        channelID,
		KeyIndex:         0,
		UpstreamModel:    upstream,
	}
}

// drawShares runs the real selector n times against a deterministic source and
// returns the hit count per channel.
func drawShares(t *testing.T, group, alias string, n int, seed uint64) map[int]int {
	t.Helper()
	rnd := rand.New(rand.NewPCG(seed, 0x9E3779B9))
	counts := map[int]int{}
	for range n {
		selected, err := SelectRouteUnit(group, alias, "", 0, nil, rnd)
		require.NoError(t, err)
		require.NotNil(t, selected)
		counts[selected.ChannelId]++
	}
	return counts
}

// ---- W1: static weight baseline ----

// TestScoreW1StaticWeightBaseline is W1.1: with equal quality and health, traffic
// must land on the configured static-weight split and nothing else — the P2C
// duel has no quality signal (identical likelihoods), so the first-sampled-order
// tiebreak keeps the share exactly at the effective prior, which with equal
// ramps is the static-weight split.
func TestScoreW1StaticWeightBaseline(t *testing.T) {
	const group, alias = "w1-group", "w1-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chLight := testRouteChannel(7101, false, []string{"sk-l"}, nil)
	chHeavy := testRouteChannel(7102, false, []string{"sk-h"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chLight, chHeavy}, group, alias, []ChannelModelRoute{
		testRoute(1, 7101, 0, alias, "up-light", 20),
		testRoute(2, 7102, 0, alias, "up-heavy", 80),
	})
	defer cleanup()

	const draws = 10000
	counts := drawShares(t, group, alias, draws, 0x5EED)

	// P2C priors are the raw weights: 20:80 = 20:80 (the retired scorer's
	// routingBaseWeight +1 offset no longer applies to selection).
	assert.InDelta(t, 2000, counts[7101], 150,
		"weight 20 vs 80 must yield 20%% under P2C, got %.2f%%", 100*float64(counts[7101])/float64(draws))
	assert.InDelta(t, 8000, counts[7102], 150,
		"weight 20 vs 80 must yield 80%% under P2C, got %.2f%%", 100*float64(counts[7102])/float64(draws))
}

// TestScoreW1ZeroTotalWeight is W1.2: an all-zero-weight pool must stay usable.
// The P2C prior degrades to uniform (× ramp) over the eligible set when the
// total weight is zero, so the pool remains equiprobable instead of collapsing.
func TestScoreW1ZeroTotalWeight(t *testing.T) {
	const group, alias = "w1z-group", "w1z-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chA := testRouteChannel(7111, false, []string{"sk-a"}, nil)
	chB := testRouteChannel(7112, false, []string{"sk-b"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chA, chB}, group, alias, []ChannelModelRoute{
		testRoute(1, 7111, 0, alias, "up-a", 0),
		testRoute(2, 7112, 0, alias, "up-b", 0),
	})
	defer cleanup()

	counts := drawShares(t, group, alias, 2000, 0xC0FFEE)
	assert.InDelta(t, 1000, counts[7111], 120, "zero-weight routes must be equiprobable")
	assert.InDelta(t, 1000, counts[7112], 120, "zero-weight routes must be equiprobable")
}

// TestScoreW1SingleCandidateShortCircuit is W1.3: a lone candidate is returned
// regardless of its posterior. With nothing to compete against the duel is
// vacuous, so a degraded or brand-new sole provider must not be starved out.
func TestScoreW1SingleCandidateShortCircuit(t *testing.T) {
	const group, alias = "w1s-group", "w1s-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	ch := testRouteChannel(7121, false, []string{"sk-only"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{ch}, group, alias, []ChannelModelRoute{
		testRoute(1, 7121, 0, alias, "up-only", 100),
	})
	defer cleanup()

	counts := drawShares(t, group, alias, 50, 0xBEEF)
	assert.Equal(t, 50, counts[7121], "the only candidate must always be served")
}

// ---- P2C: duel semantics ----

// scriptedP2CSource feeds a precomputed draw sequence to a p2cSource so a duel
// can be asserted on its exact picks instead of on a distribution.
type scriptedP2CSource struct {
	uniforms []float64
	ints     []int
	ui       int
	ii       int
}

func (s *scriptedP2CSource) uniform() float64 {
	u := s.uniforms[s.ui]
	s.ui++
	return u
}

func (s *scriptedP2CSource) intN(n int) int {
	v := s.ints[s.ii]
	s.ii++
	return v % n
}

// TestP2CTieBreakByFirstSampledOrder pins the pick-index semantics of the duel
// with scripted draws: without a quality signal (identical likelihoods) the
// first-sampled candidate wins, duplicates are repaired by a backfilled
// opponent, and only the explore rate can reach a starving candidate.
func TestP2CTieBreakByFirstSampledOrder(t *testing.T) {
	// No quality signal: identical likelihoods, priors 10:30.
	scored := []p2cScored{
		{candidate: routeCandidate{channelId: 1}, prior: 0.25, likelihood: 1.0},
		{candidate: routeCandidate{channelId: 2}, prior: 0.75, likelihood: 1.0},
	}

	// Draws: 0.2 -> idx0; 0.2 -> idx0 (duplicate) -> backfill the un-sampled
	// positive-prior opponent (third draw). Tied likelihoods: idx0 was
	// first-sampled, so it wins.
	src := &scriptedP2CSource{uniforms: []float64{0.2, 0.2, 0.0}, ints: []int{0}}
	w := compareP2C(scored, p2cChoices, 0, p2cSource{uniform: src.uniform, intN: src.intN})
	assert.Equal(t, 1, w.candidate.channelId, "first-sampled candidate must win a tie")

	// Draws: 0.9 -> idx1; 0.2 -> idx0: mixed pair, idx1 sampled first -> idx1.
	src = &scriptedP2CSource{uniforms: []float64{0.9, 0.2}, ints: []int{0}}
	w = compareP2C(scored, p2cChoices, 0, p2cSource{uniform: src.uniform, intN: src.intN})
	assert.Equal(t, 2, w.candidate.channelId, "the earlier sample must win the tie")

	// Draws: 0.9 -> idx1; 0.9 -> idx1 (duplicate) -> backfill idx0. Tied again,
	// but idx1 was sampled first (the backfill carries no sampling position),
	// so idx1 wins.
	src = &scriptedP2CSource{uniforms: []float64{0.9, 0.9, 0.0}, ints: []int{0}}
	w = compareP2C(scored, p2cChoices, 0, p2cSource{uniform: src.uniform, intN: src.intN})
	assert.Equal(t, 2, w.candidate.channelId, "a backfilled opponent must lose the tie to the sampled one")

	// Explore: a zero-prior, non-floored candidate (idx2) can never win the
	// duel — only the explore draw reaches it.
	scored = append(scored, p2cScored{candidate: routeCandidate{channelId: 3}, prior: 0, likelihood: 1.0})
	// Draws: 0.2, 0.2 -> [idx0, idx0] -> backfill idx1 -> explore fires
	// (0.001 < 0.005) -> uniform over the starving set {idx2}.
	src = &scriptedP2CSource{uniforms: []float64{0.2, 0.2, 0.5, 0.001, 0.0}, ints: []int{0}}
	w = compareP2C(scored, p2cChoices, p2cExploreRate, p2cSource{uniform: src.uniform, intN: src.intN})
	assert.Equal(t, 3, w.candidate.channelId, "the explore rate must pick uniformly from the starving set")
}

// TestP2CNearEqualLikelihoodsTieAndHigherWinsBeyondEpsilon pins the relative
// tie epsilon: a difference within 1% falls through to sampling order, so a
// slightly degraded unit still wins some duels and can recover; a larger
// difference still favors the higher likelihood.
func TestP2CNearEqualLikelihoodsTieAndHigherWinsBeyondEpsilon(t *testing.T) {
	scored := []p2cScored{
		{candidate: routeCandidate{channelId: 1}, prior: 0.5, likelihood: 0.995},
		{candidate: routeCandidate{channelId: 2}, prior: 0.5, likelihood: 1.0},
	}

	// Draws: 0.2 -> idx0, 0.9 -> idx1. The 0.5% gap is within the epsilon, so
	// the first-sampled candidate wins the tie.
	src := &scriptedP2CSource{uniforms: []float64{0.2, 0.9}, ints: []int{0}}
	w := compareP2C(scored, p2cChoices, 0, p2cSource{uniform: src.uniform, intN: src.intN})
	assert.Equal(t, 1, w.candidate.channelId, "within-epsilon likelihoods must tie and go to sampling order")

	// Same draw order, but a 2% gap exceeds the epsilon: the higher
	// likelihood wins regardless of sampling order.
	scored[1].likelihood = 1.02
	src = &scriptedP2CSource{uniforms: []float64{0.2, 0.9}, ints: []int{0}}
	w = compareP2C(scored, p2cChoices, 0, p2cSource{uniform: src.uniform, intN: src.intN})
	assert.Equal(t, 2, w.candidate.channelId, "beyond the epsilon the higher likelihood must win")
}

// TestP2CPriorSharesFollowWeight pins 10:30: with no quality signal the
// first-sampled tiebreak keeps the share exactly at the prior — 25:75, so 100
// draws land inside a tight band around it.
func TestP2CPriorSharesFollowWeight(t *testing.T) {
	const group, alias = "p2cp-group", "p2cp-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chL := testRouteChannel(7451, false, []string{"sk-l"}, nil)
	chH := testRouteChannel(7452, false, []string{"sk-h"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chL, chH}, group, alias, []ChannelModelRoute{
		testRoute(1, 7451, 0, alias, "up-l", 10),
		testRoute(2, 7452, 0, alias, "up-h", 30),
	})
	defer cleanup()

	counts := drawShares(t, group, alias, 100, 0x0C0FFEE)
	assert.InDelta(t, 25, counts[7451], 15,
		"the 10-weight route keeps its prior share (25%%), got %d%%", counts[7451])
	assert.InDelta(t, 75, counts[7452], 15,
		"the 30-weight route keeps its prior share (75%%), got %d%%", counts[7452])
}

// TestP2CSlowerUnitLosesDespiteHigherWeight pins the posterior: a 4x slower
// unit (latency EWMA) loses the duel even though its static weight is 3x
// higher. Its likelihood (best/400 = 0.25) is not floored, so the explore
// rate does not rescue it either — it gets no regular traffic.
func TestP2CSlowerUnitLosesDespiteHigherWeight(t *testing.T) {
	const group, alias = "p2cs-group", "p2cs-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chFast := testRouteChannel(7461, false, []string{"sk-f"}, nil)
	chSlow := testRouteChannel(7462, false, []string{"sk-s"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chFast, chSlow}, group, alias, []ChannelModelRoute{
		testRoute(1, 7461, 0, alias, "up-f", 30),
		testRoute(2, 7462, 0, alias, "up-s", 10),
	})
	defer cleanup()

	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: 7461, KeyIndex: 0, Model: alias,
		State: "healthy", Version: 1,
		EwmaScore: 1.0, LatencyEwmaMs: 100, RequestCount: 5, RampExited: true,
	})
	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: 7462, KeyIndex: 0, Model: alias,
		State: "healthy", Version: 1,
		EwmaScore: 1.0, LatencyEwmaMs: 400, RequestCount: 5, RampExited: true,
	})

	counts := drawShares(t, group, alias, 2000, 0x510A)
	assert.Zero(t, counts[7462], "the slower unit must not win a duel its posterior loses")
	assert.Equal(t, 2000, counts[7461], "the faster unit must take every regular draw")
}

// TestP2CFlooredUnitGetsExploreTraffic pins the observation contract: a unit
// whose posterior sits at the floor (EWMA at MinScoreFloor) is in the
// starving set, so the explore rate hands it ~0.5% of draws — enough to keep
// its latency/health data flowing so it can self-heal.
func TestP2CFlooredUnitGetsExploreTraffic(t *testing.T) {
	const group, alias = "p2cf-group", "p2cf-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	withUnitHealthSetting(t, DefaultUnitHealthSetting())
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chGood := testRouteChannel(7471, false, []string{"sk-g"}, nil)
	chBad := testRouteChannel(7472, false, []string{"sk-b"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chGood, chBad}, group, alias, []ChannelModelRoute{
		testRoute(1, 7471, 0, alias, "up-g", 100),
		testRoute(2, 7472, 0, alias, "up-b", 100),
	})
	defer cleanup()

	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: 7471, KeyIndex: 0, Model: alias,
		State: "healthy", Version: 1,
		EwmaScore: 1.0, RequestCount: 5, RampExited: true,
	})
	// Seed the bad unit's score exactly at the P2C sampling floor; the fixed
	// default setting above keeps MinScoreFloor (0.05) equal to it.
	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: 7472, KeyIndex: 0, Model: alias,
		State: "healthy", Version: 1,
		EwmaScore: p2cLikelihoodFloor, RequestCount: 5, RampExited: true,
	})

	const draws = 2000
	counts := drawShares(t, group, alias, draws, 0x10E2)
	assert.InDelta(t, draws*p2cExploreRate, counts[7472], 8,
		"the floored unit keeps the explore-rate share, got %d", counts[7472])
}

// TestP2CZeroPriorUnitIsExploreOnly pins the deviation from the retired
// scorer's +1 offset: a weight-0 route has exactly zero prior, so it is
// excluded from regular duels (the backfill pool and the sampling weights
// both ignore it) — and, like a floored unit, it sits in the starving set,
// so the explore rate hands it its only traffic: an observation slice that
// keeps its health data flowing.
func TestP2CZeroPriorUnitIsExploreOnly(t *testing.T) {
	const group, alias = "p2cz-group", "p2cz-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chA := testRouteChannel(7561, false, []string{"sk-a"}, nil)
	chB := testRouteChannel(7562, false, []string{"sk-b"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chA, chB}, group, alias, []ChannelModelRoute{
		testRoute(1, 7561, 0, alias, "up-a", 100),
		testRoute(2, 7562, 0, alias, "up-b", 0),
	})
	defer cleanup()

	const draws = 2000
	counts := drawShares(t, group, alias, draws, 0x10A5)
	assert.InDelta(t, draws*p2cExploreRate, counts[7562], 8,
		"a zero-prior unit gets exactly the explore-rate share, got %d", counts[7562])
	assert.InDelta(t, draws-draws*p2cExploreRate, counts[7561], 8,
		"the positive-prior unit keeps every regular draw, got %d", counts[7561])
}

// TestP2CAllCoolingRecallsShortestRemaining pins the faint-recall fallback:
// with the whole eligible pool in a live cooldown window, selection force-
// recalls the unit with the shortest remaining cooldown instead of failing
// the request.
func TestP2CAllCoolingRecallsShortestRemaining(t *testing.T) {
	const group, alias = "p2cr-group", "p2cr-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	base := time.Unix(0, 0)
	prevNow := ChannelHealthNow
	ChannelHealthNow = func() time.Time { return base }
	t.Cleanup(func() { ChannelHealthNow = prevNow })

	chA := testRouteChannel(7551, false, []string{"sk-a"}, nil)
	chB := testRouteChannel(7552, false, []string{"sk-b"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chA, chB}, group, alias, []ChannelModelRoute{
		testRoute(1, 7551, 0, alias, "up-a", 100),
		testRoute(2, 7552, 0, alias, "up-b", 100),
	})
	defer cleanup()

	// Both units cooling with different remaining budgets: A has 5s left, B 2s.
	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: 7551, KeyIndex: 0, Model: alias,
		State: "healthy", Version: 1, EwmaScore: 1.0,
		CooldownUntilMs: 5000, LastCoolingOutcome: -1,
	})
	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: 7552, KeyIndex: 0, Model: alias,
		State: "healthy", Version: 1, EwmaScore: 1.0,
		CooldownUntilMs: 2000, LastCoolingOutcome: -1,
	})

	selected, err := SelectRouteUnit(group, alias, "", 0, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, selected, "an all-cooling pool must take the faint-recall path")
	assert.Equal(t, 7552, selected.ChannelId, "the shortest-remaining unit is recalled")

	// The recall is observable through the state API: B's window is closed and
	// slow start is pending; A's window is untouched.
	nowMs := base.UnixMilli()
	require.False(t, UnitState(RouteKey{ChannelId: 7552, KeyIndex: 0, Model: alias}).IsCooling(nowMs),
		"the recalled unit must have its cooldown window force-closed")
	require.True(t, UnitState(RouteKey{ChannelId: 7552, KeyIndex: 0, Model: alias}).RampPending,
		"a forced recall must re-enter through slow start")
	require.True(t, UnitState(RouteKey{ChannelId: 7551, KeyIndex: 0, Model: alias}).IsCooling(nowMs),
		"the longer-remaining unit must keep cooling")
}

// TestP2CUnobservedUnitIsNeutral replaces the W4.1 cold-start contract in P2C
// terms: a brand-new unit with no health history has the neutral posterior
// (EWMA default 1.0, no latency observation, no concurrency cap), so it
// competes at its prior alongside a fully healthy observed unit.
func TestP2CUnobservedUnitIsNeutral(t *testing.T) {
	const group, alias = "p2cu-group", "p2cu-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chOld := testRouteChannel(7571, false, []string{"sk-o"}, nil)
	chNew := testRouteChannel(7572, false, []string{"sk-n"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chOld, chNew}, group, alias, []ChannelModelRoute{
		testRoute(1, 7571, 0, alias, "up-o", 100),
		testRoute(2, 7572, 0, alias, "up-n", 100),
	})
	defer cleanup()

	// The established route carries a fully healthy observed state; the new
	// route has no row at all.
	seedUnitHealthRow(t, &ChannelModelHealth{
		ChannelId: 7571, KeyIndex: 0, Model: alias,
		State: "healthy", Version: 1,
		EwmaScore: 1.0, RequestCount: 5, RampExited: true,
	})

	const draws = 1000
	counts := drawShares(t, group, alias, draws, 0x0E21)
	assert.InDelta(t, draws/2, counts[7572], 40,
		"an unobserved unit competes at a neutral posterior, got %d", counts[7572])
}

// ---- W3: health multiplier and correction ----

// TestScoreW3DisabledRouteScoresZero is W3.3: terminal-disabled is the one
// state that removes a route from the pool. P2C drops it from the eligible
// set, and the faint-recall path refuses to resurrect it: a terminal-disabled
// unit reports no live cooldown window to force-close.
func TestScoreW3DisabledRouteScoresZero(t *testing.T) {
	const group, alias = "w3d-group", "w3d-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chA := testRouteChannel(7301, false, []string{"sk-a"}, nil)
	chB := testRouteChannel(7302, false, []string{"sk-b"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chA, chB}, group, alias, []ChannelModelRoute{
		testRoute(1, 7301, 0, alias, "up-a", 100),
		testRoute(2, 7302, 0, alias, "up-b", 100),
	})
	defer cleanup()

	require.NoError(t, DisableUnit(RouteKey{ChannelId: 7302, KeyIndex: 0, Model: alias}, time.Now()))

	counts := drawShares(t, group, alias, 300, 0xDEAD)
	assert.Zero(t, counts[7302], "a disabled route must never be selected")
	assert.Equal(t, 300, counts[7301])
}

// TestScoreW3CooledRouteRecoversAfterWindow pins the recovery path: a unit that
// trips a failure cooldown is excluded while the window is open, and re-enters
// the pool once the window closes. The clock is injected so the test is
// deterministic without a real-time sleep.
func TestScoreW3CooledRouteRecoversAfterWindow(t *testing.T) {
	const group, alias = "w3c-group", "w3c-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chA := testRouteChannel(7311, false, []string{"sk-a"}, nil)
	chB := testRouteChannel(7312, false, []string{"sk-b"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chA, chB}, group, alias, []ChannelModelRoute{
		testRoute(1, 7311, 0, alias, "up-a", 100),
		testRoute(2, 7312, 0, alias, "up-b", 100),
	})
	defer cleanup()

	cfg := DefaultUnitHealthSetting()
	cfg.CooldownBaseMs = 100
	withUnitHealthSetting(t, cfg)

	// Injected clock: the selector and every reader pull now from here.
	base := time.Unix(0, 0)
	advanceMs := 0.0
	prevNow := ChannelHealthNow
	ChannelHealthNow = func() time.Time {
		return base.Add(time.Duration(advanceMs * float64(time.Millisecond)))
	}
	t.Cleanup(func() { ChannelHealthNow = prevNow })

	key := RouteKey{ChannelId: 7312, KeyIndex: 0, Model: alias}
	// t=0: trip the failure cooldown (bottom rung = 100ms).
	require.NoError(t, ReportOutcome(key, UnitFatal, 0, 0, base))

	// While the window is open the unit is excluded: the healthy peer takes
	// every draw.
	counts := drawShares(t, group, alias, 400, 0xFEED)
	assert.Zero(t, counts[7312], "a cooling unit is excluded until its window closes")
	assert.Equal(t, 400, counts[7311])

	// After the 100ms window the unit re-enters the pool (at its slow-start
	// ramp prior) and both serve again.
	advanceMs = 1000
	counts = map[int]int{}
	rnd := rand.New(rand.NewPCG(0xFEED, 0x9E3779B9))
	for range 400 {
		selected, err := SelectRouteUnit(group, alias, "", 0, nil, rnd)
		require.NoError(t, err)
		require.NotNil(t, selected)
		counts[selected.ChannelId]++
	}
	assert.Positive(t, counts[7312], "a recovered unit must be selectable again")
	assert.Positive(t, counts[7311], "the healthy peer keeps serving")
}

// TestScoreW3SignalsDoNotDoublePenalise is W3.2: one failure must move the two
// signals independently, and neither may reach into the other's range. The
// routestats quality is bounded below by its floor and cannot eject; the unit
// health score can reach zero and is the only thing that may exclude a unit
// from the P2C eligible set.
func TestScoreW3SignalsDoNotDoublePenalise(t *testing.T) {
	const group, alias = "w3s-group", "w3s-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	ch := testRouteChannel(7321, false, []string{"sk-a"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{ch}, group, alias, []ChannelModelRoute{
		testRoute(1, 7321, 0, alias, "up-a", 100),
	})
	defer cleanup()

	key := RouteKey{ChannelId: 7321, KeyIndex: 0, Model: alias}
	statsKey := routeStatsKey(alias, "up-a", 7321)

	// Soft signal only: 30 failed observations.
	observeQuality(t, statsKey, 0.0, 120000, 0, 30)
	assert.InDelta(t, 0.5, routestats.GetOrCreateHandle(statsKey).Quality().Quality, 1e-9,
		"quality bottoms out at its floor no matter how many failures arrive")
	assert.Equal(t, 1.0, UnitHealthScore(key, time.Now()),
		"routestats observations must not move the unit state machine")

	// Hard signal only: one outcome trip.
	require.NoError(t, ReportOutcome(key, UnitFatal, 0, 0, time.Now()))
	assert.Less(t, UnitHealthScore(key, time.Now()), 1.0,
		"the unit state machine cools independently of the quality signal")
	assert.InDelta(t, 0.5, routestats.GetOrCreateHandle(statsKey).Quality().Quality, 1e-9,
		"a state transition must not additionally move quality")
}

// TestScoreW3AllZeroCandidatesYieldNoRoute pins the other degradation edge:
// when every candidate is terminal-disabled there is nothing to serve and no
// live cooldown window to recall — selection must say so rather than
// returning an arbitrary route.
func TestScoreW3AllZeroCandidatesYieldNoRoute(t *testing.T) {
	const group, alias = "w3z-group", "w3z-model"
	withRouteStats(t, nil)
	withUnitHealthDB(t)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	chA := testRouteChannel(7341, false, []string{"sk-a"}, nil)
	chB := testRouteChannel(7342, false, []string{"sk-b"}, nil)
	cleanup := withRouteUnitFixture(t, []*Channel{chA, chB}, group, alias, []ChannelModelRoute{
		testRoute(1, 7341, 0, alias, "up-a", 100),
		testRoute(2, 7342, 0, alias, "up-b", 100),
	})
	defer cleanup()

	now := time.Now()
	require.NoError(t, DisableUnit(RouteKey{ChannelId: 7341, KeyIndex: 0, Model: alias}, now))
	require.NoError(t, DisableUnit(RouteKey{ChannelId: 7342, KeyIndex: 0, Model: alias}, now))

	selected, err := SelectRouteUnit(group, alias, "", 0, nil, rand.New(rand.NewPCG(3, 4)))
	require.NoError(t, err)
	assert.Nil(t, selected, "a fully disabled pool must yield no route, not a fallback pick")
}

// ---- W5: correction observability through selection ----

// TestRouteUnitViewIsNotMultipliedByGroups pins the contract that replaced the
// old per-group scoping: a channel serving one alias across several groups has
// exactly ONE route unit, not one per group.
//
// The previous schema keyed route units by group, so this channel produced two
// identical-looking rows — same channel, same key index, same upstream model —
// each with its own weight to tune and its own EWMA stream to warm up. That is
// what made the admin list read as duplicated and let a tuning pass update five
// of six siblings. Group governs which aliases a user may reach, not how traffic
// is split inside an alias, so it must not appear in the route unit's identity.
func TestRouteUnitViewIsNotMultipliedByGroups(t *testing.T) {
	cleanupDB := withRouteDB(t)
	defer cleanupDB()
	withRouteStats(t, nil)
	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	const alias = "shared-model"
	ch := makeSingleKeyChannel(1, alias, "default,vip", nil)
	ch.Name = "dual-group"
	require.NoError(t, dbx.DB.Create(ch).Error)
	require.NoError(t, SeedChannelModelRoutes())

	views, err := GetRouteUnitViewsByAlias(alias)
	require.NoError(t, err)
	require.Len(t, views, 1,
		"a channel in two groups is still one scheduling unit; per-group rows are what made the list look duplicated")

	v := views[0]
	assert.InDelta(t, 1.0, v.ExpectedShare, 0.0001,
		"the sole route unit of the alias is entitled to all of it")

	// One unit means one EWMA stream: samples from either group land on it.
	observeQuality(t, routeStatsKey(alias, alias, 1), 1.0, 4000, 20, 8)
	pool := routestats.PoolKey{PublicModelAlias: alias}
	route := routestats.RouteID{ChannelID: 1, KeyIndex: 0, UpstreamModel: alias}
	cfg := routestats.GetRouteStatsSetting()
	for range 3 {
		routestats.RecordSelection(pool, route, map[routestats.RouteID]float64{route: 1.0}, cfg)
	}

	views, err = GetRouteUnitViewsByAlias(alias)
	require.NoError(t, err)
	require.Len(t, views, 1)
	v = views[0]

	assert.InDelta(t, 0.875, v.EwmaQuality, 0.01,
		"observations from any group accumulate on the single unit")
	assert.Equal(t, 3, v.ShareOpportunities,
		"the unit owns one window, so its history is not split per group")
	assert.Equal(t, 3, v.ShareSelections)
	assert.InDelta(t, v.BaseWeight*v.EwmaQuality*v.HealthMultiplier*v.ShareCorrection, v.FinalScore, 1e-9,
		"final score must be the product of the reported factors")
}
