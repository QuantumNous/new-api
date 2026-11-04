package channel

// P2C route-unit selection: a faithful port of mono's
// crates/gateway/dispatch/src/selector.rs. Replaces the retired
// EWMA×weight×share-deficit scorer: the selection path now runs a
// power-of-two-choices duel over the eligible pool.
//
// 1. 筛选 disabled、excluded 与冷却中的候选（调用方完成）;
// 2. 所有合格候选进入同一决斗池，期望份额用有效先验表达：
//    share_i = (w_i × f_i) / Σ(w_j × f_j)，其中 f 是慢启动 ramp 折减
//    （满血 = 1.0）;
// 3. 以先验加权、有放回地抽 choices 个下标;
// 4. 样本间比较似然（后验），取最高者;
// 5. 似然 = 时延、健康分、并发余量三路相对乘积，夹到下限
//    p2cLikelihoodFloor;
// 6. 触底 / 零先验候选由 explore rate 的均匀抽样保持观测流量。
//
// 慢启动 ramp 只进抽样层（先验），不进似然：权重决定长期分布，
// ramp 决定刚离开冷却的通道临时回收折扣 — RampPending 以地板
// 1/min_requests 起步、随成功计数线性回到 1.0（与 mono 共用健康表的
// 同一套算式，UnitHealthState.SlowStartFactor，不另抄一份）。恢复期
// 份额被折减但抽样概率始终为正：通道不必等 explore_rate 救援，
// 计数攒满即自愈回满份额。
//
// 全池不可选（典型：全体冷却中）时走 faintRecall 的紧急召回：
// 强制回收剩余冷却最短的单元（mono's recall_fainted）。
//
// Health kill switch (ChannelHealthEnabled=false): settledUnitState returns a
// neutral view, so no cooldown filters or slow-start derates a candidate; only
// the explicit hard-disable remains an exclusion (operator state, not health).

import (
	"math"
	"math/rand/v2"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
)

// p2cChoices is the number of duel draws. Hardcoded like mono's selector:
// not operator-tunable yet (a config knob can be added later without
// changing the duel shape).
const p2cChoices = 2

// p2cExploreRate is the per-duel probability that one floored / zero-prior
// candidate is picked uniformly instead of the duel winner (observation
// traffic that lets a degraded unit re-accumulate state). Hardcoded like
// mono; not operator-tunable yet.
const p2cExploreRate = 0.005

// p2cLikelihoodFloor clamps the posterior: a unit degraded to the floor only
// keeps slivers of traffic via p2cExploreRate, so a single bad episode cannot
// permanently starve it of state observations (self-heal path).
const p2cLikelihoodFloor = 0.05

// p2cLikelihoodTieEpsilon is the relative width under which two likelihoods
// are treated as a tie and fall through to the sampling-order tie-break.
// With a strict > comparison, a unit whose EWMA score is even 0.1% below a
// peer loses every duel; because its score only moves after MinRequests
// observations, it then receives zero traffic and can never recover. The
// epsilon makes near-equal health/latency indistinguishable, which is also
// the physically honest reading: the score is an estimate, not a ranking
// oracle.
const p2cLikelihoodTieEpsilon = 0.01

// p2cScored is one candidate's duel inputs.
type p2cScored struct {
	candidate  routeCandidate
	prior      float64 // effective prior (weight × ramp): feeds sampling ONLY
	likelihood float64 // posterior: feeds the duel ONLY
}

// p2cSource is the randomness one P2C duel consumes: uniform U(0,1) floats
// and a uniform int in [0, n). Production takes the math/rand/v2 global
// source (goroutine-safe, per-g pool); tests inject a deterministically
// seeded *rand.Rand, and unit tests of compareP2C can script the draws
// directly.
type p2cSource struct {
	uniform func() float64
	intN    func(n int) int
}

// p2cFromRand builds the source. rnd==nil → global v2 source.
func p2cFromRand(rnd *rand.Rand) p2cSource {
	if rnd != nil {
		return p2cSource{uniform: rnd.Float64, intN: rnd.IntN}
	}
	return p2cSource{uniform: rand.Float64, intN: rand.IntN}
}

// routeHealthKey is one candidate's health-table key under the requested
// alias. (The package's routeUnitKey type is the route-row diff key; this
// is the selector-side health identity.)
func routeHealthKey(c routeCandidate, alias string) RouteKey {
	return RouteKey{ChannelId: c.channelId, KeyIndex: c.keyIndex, Model: alias}
}

// selectP2C runs the full mono P2C pass over the pre-health-filter
// candidates (enabled channel/key, not excluded, path-checked) and returns
// the winner: a duel pick from the eligible set, or a faint-recall pick
// when the whole pool is down.
//
// now comes from the package clock var so tests can pin it; nil rnd takes
// the goroutine-safe global source.
func selectP2C(candidates []routeCandidate, alias string, now time.Time, rnd *rand.Rand) *routeCandidate {
	nowMs := now.UnixMilli()

	// One settled read per candidate drives eligibility, the ramp in the
	// prior, the health factor of the likelihood, and the latency factor —
	// mirroring mono's single HealthTable snapshot per unit.
	states := make([]UnitHealthState, len(candidates))
	eligible := make([]int, 0, len(candidates))
	for i, c := range candidates {
		st := settledUnitState(routeHealthKey(c, alias), nowMs)
		states[i] = st
		// IsUnitSelectable's formula over the same settled view.
		if !st.TerminalDisabled && !st.IsCooling(nowMs) {
			eligible = append(eligible, i)
		}
	}

	if len(eligible) == 0 {
		// Whole pool down: emergency recall of the shortest-remaining unit.
		// -1 when no unit is actually cooling (all hard-disabled, or an
		// empty pool): that is the caller's terminal no-candidate path.
		if i := faintRecall(candidates, states, alias, now); i >= 0 {
			return &candidates[i]
		}
		return nil
	}

	winner := compareP2C(scoreP2C(eligible, candidates, states, alias, nowMs), p2cChoices, p2cExploreRate, p2cFromRand(rnd))
	return &winner.candidate
}

// faintRecall is mono's recall_fainted: the whole pool is unselectable,
// so find the candidate with the shortest remaining cooldown and force-end
// that cooldown, returning the unit for the current request.
//
// Only live cooling windows qualify: a hard-disabled unit reports zero
// remaining, and recalling it would hand back a unit the operator (or a
// conclusive key probe) explicitly excluded (restoration is RecoverUnit, not
// the selector's job). Ties keep the first candidate in pool order — the pool
// order is stable, so the result is deterministic.
//
// The force recall is best-effort: it settles the unit without a strike
// (rescue, not forgiveness) and arms the slow-start ramp, so the recalled
// unit rejoins sampling at the floor share and climbs back. A CAS failure
// (concurrent writer) only loses the settle; the unit is still handed to
// the relay loop — the following ReportOutcome owns the state from there.
func faintRecall(candidates []routeCandidate, states []UnitHealthState, alias string, now time.Time) int {
	nowMs := now.UnixMilli()
	best := -1
	var bestRemaining int64
	for i, st := range states {
		if !st.IsCooling(nowMs) {
			continue
		}
		remaining := st.CooldownUntilMs - nowMs
		if remaining < 0 {
			remaining = 0
		}
		if best == -1 || remaining < bestRemaining {
			best = i
			bestRemaining = remaining
		}
	}
	if best == -1 {
		return -1
	}

	if err := ForceRecallUnit(routeHealthKey(candidates[best], alias), now); err != nil {
		common.SysError("unit force recall failed: " + err.Error())
	}
	return best
}

// scoreP2C assembles the effective priors and posterior likelihoods of the
// eligible set (mono's scoring loop).
func scoreP2C(eligible []int, candidates []routeCandidate, states []UnitHealthState, alias string, nowMs int64) []p2cScored {
	cfg := GetUnitHealthSetting()

	totalWeight := 0.0
	for _, i := range eligible {
		totalWeight += p2cWeight(candidates[i])
	}

	// Best latency over units that have latency data; mono's
	// latency_ewma_ms is > 0 on observed units, absent (0) otherwise.
	bestLatency := 0.0
	haveLatency := false
	for _, i := range eligible {
		if lat := states[i].LatencyEwmaMs; lat > 0 {
			if !haveLatency || lat < bestLatency {
				bestLatency = lat
				haveLatency = true
			}
		}
	}

	// Maximum registered concurrency cap over the pool; unregistered units
	// are ignored by the max-set and factor 1.0 (mono's Option semantics).
	maxPermits := 0
	havePermits := false
	for _, i := range eligible {
		if permits, ok := AvailableChannelPermits(ChannelKey{ChannelId: candidates[i].channelId, KeyIndex: candidates[i].keyIndex}); ok {
			if !havePermits || permits > maxPermits {
				maxPermits = permits
				havePermits = true
			}
		}
	}

	scored := make([]p2cScored, 0, len(eligible))
	for _, i := range eligible {
		c := candidates[i]
		st := states[i]

		// The ramp discount lives in the sampling layer ONLY, never in the
		// likelihood. All-zero weights: the prior degrades to uniform ×
		// ramp. Prior feeds sampling only, never the decision.
		var prior float64
		if totalWeight > 0 {
			prior = p2cWeight(c) / totalWeight * st.SlowStartFactor(cfg.MinRequests)
		} else {
			prior = 1.0 / float64(len(eligible)) * st.SlowStartFactor(cfg.MinRequests)
		}

		latencyFactor := 1.0
		if haveLatency && st.LatencyEwmaMs > 0 {
			latencyFactor = bestLatency / st.LatencyEwmaMs
		}
		concurrencyFactor := 1.0
		if permits, ok := AvailableChannelPermits(ChannelKey{ChannelId: c.channelId, KeyIndex: c.keyIndex}); ok && havePermits {
			concurrencyFactor = (float64(permits) + 1.0) / (float64(maxPermits) + 1.0)
		}
		likelihood := latencyFactor * st.EwmaScore * concurrencyFactor
		likelihood = math.Min(1.0, math.Max(likelihood, p2cLikelihoodFloor))

		scored = append(scored, p2cScored{candidate: c, prior: prior, likelihood: likelihood})
	}
	return scored
}

// p2cWeight is the non-negative static weight of a candidate: a misconfigured
// negative value degrades to a zero prior (explore-only traffic), never
// negative probability mass.
func p2cWeight(c routeCandidate) float64 {
	if w := float64(c.staticWeight); w > 0 {
		return w
	}
	return 0
}

// compareP2C samples `choices` indices by the effective prior (weight ×
// slow-start ramp), then takes the sampled candidate with the highest
// likelihood.
//
// ## 职责分工 (mono 方案 C)
//
//	层 | 只看 | 表达什么
//	--- |--- |---
//	抽样 | 有效先验 = 权重 × slow_start_factor | 长期比例 × 临时回收折扣
//	决策 | 似然（时延 × 健康 × 并发） | 当下择优
//	平手 | 抽样顺序 | 无质量信号 → 首个被抽中者胜
//
// 权重只进抽样、不进决策分：先验已把单元的价格计过一次，若再乘进决策分
// 会把份额推成超线性。慢启动 ramp 同理只进抽样先验、不进似然。
//
// 平手判抽样顺序：pool 由哪些被抽中 + 补位对手在池内位置决定、与权重无
// 关；两单元池里每轮两个都在 pool，似然常打平（无质量信号）——按 pool 顺
// 序裁决等于让抽中顺序决定流量。把平手先验化会把权重塞回决策层。只有抽样
// 顺序闭合"权重只管抽样"的语义：无质量信号时首个被抽中者胜，流量恰好等于
// 先验。
//
// 有放回抽样有个必须修复的缺陷：抽到同一候选两次时没有发生决斗——它不战
// 而胜，慢但权重 3 倍的通道会持续拿走 ~55% 流量。修复：发现重复就从未抽
// 中、且先验为正的候选补一个对手（先验为零的候选不得经补位绕过 explore
// rate）。
//
// 触底 / 零先验候选获得探索：触底（似然落地板）与权重=0（先验=0）的单元
// 永远赢不了正常决斗，状态便永不更新——一次坏 episode 可永久掐死它，
// 哪怕已恢复。explore rate 下均匀（不按先验：零先验加权抽永远抽不到）
// 挑这样一个候选，保持观测流量让它重新积累时延与健康数据、自愈。
func compareP2C(scored []p2cScored, choices int, exploreRate float64, src p2cSource) p2cScored {
	if choices < 1 {
		choices = 1
	}
	weights := make([]float64, len(scored))
	for i, s := range scored {
		weights[i] = s.prior
	}
	sampled := make([]int, 0, choices)
	for range choices {
		sampled = append(sampled, pickWeightedIndex(weights, src))
	}

	// Pool = the sorted unique samples; a duplicate leaves the duplicated
	// candidate without an opponent until the backfill below.
	pool := make([]int, len(sampled))
	copy(pool, sampled)
	sort.Ints(pool)
	deduped := pool[:0]
	for _, v := range pool {
		if len(deduped) == 0 || v != deduped[len(deduped)-1] {
			deduped = append(deduped, v)
		}
	}
	pool = deduped

	if len(pool) < len(sampled) {
		// Backfill an opponent from the positive-prior candidates only.
		inPool := make([]bool, len(scored))
		for _, p := range pool {
			inPool[p] = true
		}
		rest := make([]int, 0, len(scored)-len(pool))
		restWeights := make([]float64, 0, cap(rest))
		for i, w := range weights {
			if w > 0 && !inPool[i] {
				rest = append(rest, i)
				restWeights = append(restWeights, w)
			}
		}
		if len(rest) > 0 {
			pool = append(pool, rest[pickWeightedIndex(restWeights, src)])
		}
	}

	// First-seen position in the sampling sequence; a backfilled opponent
	// was never sampled and sorts after every real sample on ties.
	firstSeen := make([]int, len(scored))
	for i := range firstSeen {
		firstSeen[i] = math.MaxInt
	}
	for pos, s := range sampled {
		if pos < firstSeen[s] {
			firstSeen[s] = pos
		}
	}

	// Starving set: candidates that cannot win reference traffic normally
	// — floored (likelihood at the floor, with float slack) or zero-prior.
	starving := make([]int, 0)
	for i, s := range scored {
		if s.likelihood <= p2cLikelihoodFloor*1.01 || s.prior <= 0 {
			starving = append(starving, i)
		}
	}
	if len(starving) > 0 && exploreRate > 0 && src.uniform() < exploreRate {
		return scored[starving[src.intN(len(starving))]]
	}

	// The duel: higher likelihood wins; near-equal likelihoods and exact
	// ties go to the earlier sample (sampling order). The epsilon matters:
	// with a strict > a unit 0.1% below a peer wins nothing, and because its
	// score only moves after MinRequests observations it can never recover.
	// Scanning pool order with that comparator yields the same winner as
	// mono's max_by, which is order-independent on a total order.
	best := pool[0]
	for _, idx := range pool[1:] {
		a, b := scored[idx].likelihood, scored[best].likelihood
		if likelihoodsTied(a, b) {
			if firstSeen[idx] < firstSeen[best] {
				best = idx
			}
			continue
		}
		if a > b {
			best = idx
		}
	}
	return scored[best]
}

// likelihoodsTied reports whether two likelihoods are within the relative
// tie epsilon. Both inputs are non-negative and at least p2cLikelihoodFloor.
func likelihoodsTied(a, b float64) bool {
	return math.Abs(a-b) <= math.Max(a, b)*p2cLikelihoodTieEpsilon
}

// pickWeightedIndex draws one index by cumulative weighted sampling over
// `weights` (with replacement). Callers pass non-negative weights with at
// least one positive entry: an all-zero group degrades to uniform weights
// in scoreP2C, so some prior is positive. The tail fallback mirrors mono's
// float-cumulative-error guard and keeps zero-prior candidates out of
// regular duels.
func pickWeightedIndex(weights []float64, src p2cSource) int {
	total := 0.0
	for _, w := range weights {
		total += w
	}
	target := src.uniform() * total
	for i, w := range weights {
		target -= w
		if target < 0 {
			return i
		}
	}
	for i := len(weights) - 1; i >= 0; i-- {
		if weights[i] > 0 {
			return i
		}
	}
	// Unreachable: callers guarantee a positive weight somewhere (an
	// all-zero pool degrades to uniform priors upstream).
	panic("weighted sampling requires a positive weight")
}
