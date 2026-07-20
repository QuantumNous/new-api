package model

import (
	"math"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type ChannelHealthState string

const (
	ChannelHealthClosed   ChannelHealthState = "closed"
	ChannelHealthOpen     ChannelHealthState = "open"
	ChannelHealthHalfOpen ChannelHealthState = "half_open"

	channelHealthFailureThreshold = 3
	channelHealthFailureWindow    = time.Minute
	channelHealthOpenDuration     = 30 * time.Second
	channelHealthProbeLease       = 30 * time.Second
	channelHealthIdleTTL          = 15 * time.Minute
	channelHealthMaxEntries       = 10_000
	minimumChannelHealthScore     = 0.1

	// Rate-based tripping over a rolling window of recent attempts, independent
	// of wall-clock. A low-traffic channel whose failures never fall inside one
	// channelHealthFailureWindow still trips once channelHealthRecentFailTrip of
	// its last channelHealthRecentWindow attempts have failed. This catches a
	// volatile channel (intermittent timeouts spread over minutes) that the
	// time-window burst rule misses because 3 failures never coincide in 60s.
	channelHealthRecentWindow   = 5
	channelHealthRecentFailTrip = 3

	// Exponential backoff for a flapping channel: each successive open (without a
	// sustained-healthy reset) doubles the open interval up to a cap, so a
	// channel that keeps failing right after recovery is sidelined progressively
	// longer instead of being retried every channelHealthOpenDuration.
	channelHealthMaxBackoffShift    = 4 // 30s << 4 == 8m
	channelHealthMaxOpenDuration    = 8 * time.Minute
	channelHealthBackoffResetStreak = 3 // consecutive fast successes that clear the backoff

	// channelHealthSlowThreshold consecutive slow successes (a fast success
	// resets the count) trip the circuit, so a consistently-slow channel is
	// evicted and re-probed like a failing one, while an occasional spike on an
	// otherwise-fast channel does not trip it. The "slow" first-token latency
	// bound is configurable (CHANNEL_HEALTH_SLOW_LATENCY_SECONDS); see
	// channelHealthSlowLatency.
	channelHealthSlowThreshold             = 3
	defaultChannelHealthSlowLatencySeconds = 9

	// A channel needs two recent, attributable slow responses before it can
	// move down one configured priority tier. This is intentionally earlier and
	// softer than the three-sample slow circuit, so a channel can yield traffic
	// without being made unavailable. Two fast scored responses are required to
	// restore its original tier, which prevents priority flapping around the
	// latency threshold.
	channelHealthPriorityDemotionThreshold = 2
	channelHealthPriorityRecoveryThreshold = 2

	// affinityFastLatency is the first-token latency below which a channel counts
	// as "genuinely fast right now". Used only to bias channel *selection* toward
	// fast channels (see fastChannelSelectionBoost) — it no longer governs
	// migration off a sticky channel, because a session's warm prompt cache is
	// worth more than any latency difference: even a slow channel answers a cache
	// hit in ~1s, whereas leaving pays a 20-40s cold prefill.
	affinityFastLatency = 2 * time.Second

	// fastChannelSelectionBoost multiplies the selection weight of a channel
	// measured fast (EWMA < affinityFastLatency). It concentrates traffic on
	// genuinely fast channels so a session bounced off slow ones lands on a fast
	// one rather than being weighted-randomly dropped back onto another slow one.
	// 8 gives a single fast channel ~80% of the traffic against a handful of slow
	// peers while leaving them a probe share; the boost self-cancels once a
	// channel's EWMA rises past the threshold under load.
	fastChannelSelectionBoost = 8
)

// channelHealthSlowLatency is the first-token latency at or above which a
// successful response is treated as "slow". Default is well above the fast
// channels (~1-6s observed) but low enough to catch moderately-slow ones;
// tune via CHANNEL_HEALTH_SLOW_LATENCY_SECONDS without a code change.
func channelHealthSlowLatency() time.Duration {
	s := common.ChannelHealthSlowLatencySeconds
	if s <= 0 {
		s = defaultChannelHealthSlowLatencySeconds
	}
	return time.Duration(s) * time.Second
}

type ChannelHealthKey struct {
	ChannelID int
	Model     string
	Path      string
}

type ChannelOutcome struct {
	StatusCode    int
	Latency       time.Duration
	SemanticError bool
	LocalError    bool
	// ColdCacheStart marks an attempt whose latency is dominated by a prompt
	// prefill this channel had no cache for, because we just released the
	// request's affinity from a slower channel. Its Latency measures work we
	// imposed, not the channel's responsiveness, so it is excluded from the
	// latency EWMA and the slow-trip counter. Success/failure still counts.
	ColdCacheStart bool
}

type channelHealthEntry struct {
	state               ChannelHealthState
	failures            []time.Time
	slowSamples         []time.Time
	recentOutcomes      []bool // rolling window of recent attempts; true = failure, most recent last
	consecutiveOpens    int    // opens since the last sustained-healthy reset; drives the backoff interval
	healthyStreak       int    // consecutive fast closed-state successes; clears the backoff
	openUntil           time.Time
	probeLeaseUntil     time.Time
	latencyEWMA         float64
	priorityDemoted     bool
	priorityDemotedAt   time.Time
	priorityFastSamples int
	lastSeenAt          time.Time
	// openedBySlow records why the circuit last opened: true = sustained
	// slowness, false = failures. Read by affinity to decide whether a
	// cache-holding session should ride out the open state (slow) or leave it
	// (failure). See openWithBackoff.
	openedBySlow bool
}

func (e *channelHealthEntry) pushRecentOutcome(failure bool) {
	e.recentOutcomes = append(e.recentOutcomes, failure)
	if len(e.recentOutcomes) > channelHealthRecentWindow {
		e.recentOutcomes = e.recentOutcomes[len(e.recentOutcomes)-channelHealthRecentWindow:]
	}
}

func (e *channelHealthEntry) recentFailureCount() int {
	n := 0
	for _, failed := range e.recentOutcomes {
		if failed {
			n++
		}
	}
	return n
}

func (e *channelHealthEntry) resetPriorityFastSamples() {
	if !e.priorityDemoted {
		return
	}
	e.priorityFastSamples = 0
}

func (e *channelHealthEntry) restartPriorityRecoveryInterval(now time.Time) {
	e.resetPriorityFastSamples()
	if e.priorityDemoted {
		e.priorityDemotedAt = now
	}
}

// openWithBackoff opens the circuit for an interval that grows with the number
// of consecutive opens, so a persistently-flapping channel is sidelined longer
// each time instead of being retried every base interval. It clears the
// per-window failure/slow/outcome trackers, which are rebuilt from probe results
// after recovery.
// openWithBackoff trips the circuit. bySlow distinguishes the two reasons a
// channel opens — sustained slowness vs outright failures — because they must be
// treated differently for prompt-cache affinity: a session already holding a
// warm cache on this channel should ride out slowness (a cache hit makes even a
// slow channel answer in ~1s, far better than the 20-40s cold prefill a
// migration would cost), but must leave a channel that is actually erroring.
func (e *channelHealthEntry) openWithBackoff(now time.Time, bySlow bool) {
	shift := e.consecutiveOpens
	if shift > channelHealthMaxBackoffShift {
		shift = channelHealthMaxBackoffShift
	}
	dur := channelHealthOpenDuration << uint(shift)
	if dur > channelHealthMaxOpenDuration {
		dur = channelHealthMaxOpenDuration
	}
	e.state = ChannelHealthOpen
	e.openedBySlow = bySlow
	e.openUntil = now.Add(dur)
	e.probeLeaseUntil = time.Time{}
	e.failures = nil
	e.slowSamples = nil
	e.recentOutcomes = nil
	e.healthyStreak = 0
	// The circuit supplies the recovery probe, but a slow channel must retain
	// its soft demotion after that probe closes the circuit. Otherwise one fast
	// half-open response would immediately restore the original priority tier
	// even while the latency EWMA is still unhealthy.
	if bySlow {
		e.priorityDemoted = true
	}
	e.restartPriorityRecoveryInterval(now)
	if e.consecutiveOpens <= channelHealthMaxBackoffShift {
		e.consecutiveOpens++
	}
}

// registerHealthySuccess advances the healthy streak on a fast success and
// clears the flapping backoff once the channel has proven sustained health. A
// slow (but successful) response is up-but-not-fast, so callers do not invoke
// this for it — the slow circuit owns that axis.
func (e *channelHealthEntry) registerHealthySuccess() {
	e.healthyStreak++
	if e.healthyStreak >= channelHealthBackoffResetStreak {
		e.consecutiveOpens = 0
	}
}

type channelHealthRegistry struct {
	mu      sync.Mutex
	entries map[ChannelHealthKey]*channelHealthEntry
	now     func() time.Time
}

func newChannelHealthRegistry(now func() time.Time) *channelHealthRegistry {
	return &channelHealthRegistry{entries: make(map[ChannelHealthKey]*channelHealthEntry), now: now}
}

func pruneChannelHealthFailures(failures []time.Time, cutoff time.Time) []time.Time {
	first := 0
	for first < len(failures) && !failures[first].After(cutoff) {
		first++
	}
	return failures[first:]
}

func (r *channelHealthRegistry) pruneIdle(now time.Time) {
	cutoff := now.Add(-channelHealthIdleTTL)
	for key, entry := range r.entries {
		if entry.lastSeenAt.Before(cutoff) {
			delete(r.entries, key)
		}
	}
}

func (r *channelHealthRegistry) getOrCreate(key ChannelHealthKey, now time.Time) *channelHealthEntry {
	if entry := r.entries[key]; entry != nil {
		entry.lastSeenAt = now
		return entry
	}
	if len(r.entries) >= channelHealthMaxEntries {
		r.pruneIdle(now)
		if len(r.entries) >= channelHealthMaxEntries {
			return nil
		}
	}
	entry := &channelHealthEntry{state: ChannelHealthClosed, lastSeenAt: now}
	r.entries[key] = entry
	return entry
}

// isChannelOverloadStatus reports whether a 4xx status is actually a channel
// capacity signal (request timeout / too many requests) rather than a genuine
// client error. These indicate the channel cannot serve right now and should
// be deprioritized, so they count against health like a 5xx.
func isChannelOverloadStatus(statusCode int) bool {
	return statusCode == http.StatusRequestTimeout || statusCode == http.StatusTooManyRequests
}

func (r *channelHealthRegistry) Record(key ChannelHealthKey, outcome ChannelOutcome) {
	if !common.AdaptiveChannelHealthEnabled {
		return
	}
	// Ignore genuine client 4xx (bad request, auth, not found, unprocessable);
	// they are not the channel's availability problem. 408/429 are the
	// exception: they signal an overloaded channel and must count.
	ignoredOutcome := outcome.LocalError || outcome.SemanticError ||
		(outcome.StatusCode >= http.StatusBadRequest && outcome.StatusCode < http.StatusInternalServerError &&
			!isChannelOverloadStatus(outcome.StatusCode))
	if ignoredOutcome {
		// Ignored outcomes still break a consecutive fast-recovery streak. They
		// provide no evidence that the upstream channel is fast enough to regain
		// its configured priority, but they must not otherwise affect health.
		r.mu.Lock()
		if entry := r.entries[key]; entry != nil && entry.priorityDemoted {
			now := r.now()
			entry.lastSeenAt = now
			entry.resetPriorityFastSamples()
		}
		r.mu.Unlock()
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	now := r.now()
	entry := r.getOrCreate(key, now)
	if entry == nil {
		return
	}

	if outcome.StatusCode >= http.StatusInternalServerError || outcome.StatusCode <= 0 || isChannelOverloadStatus(outcome.StatusCode) {
		entry.healthyStreak = 0
		entry.restartPriorityRecoveryInterval(now)
		entry.pushRecentOutcome(true)
		if entry.state == ChannelHealthHalfOpen {
			entry.openWithBackoff(now, false)
			return
		}
		entry.failures = pruneChannelHealthFailures(entry.failures, now.Add(-channelHealthFailureWindow))
		entry.failures = append(entry.failures, now)
		// Trip on either a burst inside the time window OR a high failure rate
		// over the recent-attempt window. The rate window is traffic-independent,
		// so a volatile channel whose failures never coincide in one 60s window
		// still trips once enough of its recent attempts have failed.
		if len(entry.failures) >= channelHealthFailureThreshold ||
			entry.recentFailureCount() >= channelHealthRecentFailTrip {
			entry.openWithBackoff(now, false)
		}
		return
	}

	// A cold-cache attempt is timed but not scored: we released this request's
	// affinity ourselves, so its first token pays a full prefill (23s+ observed
	// on a 240k-token prompt). Folding that into the EWMA would make the channel
	// we just migrated to look slow to *every* affinity key on it — one
	// migration would stampede the rest away, each paying its own cold prefill.
	if outcome.Latency > 0 && !outcome.ColdCacheStart {
		latency := float64(outcome.Latency)
		if entry.latencyEWMA == 0 {
			entry.latencyEWMA = latency
		} else {
			entry.latencyEWMA = entry.latencyEWMA*0.8 + latency*0.2
		}
	}

	// A successful-but-slow response is a soft failure: repeated slowness first
	// lowers the effective priority, then evicts and re-probes the channel like a
	// failing one if it persists to the circuit threshold.
	slow := outcome.Latency >= channelHealthSlowLatency() && !outcome.ColdCacheStart

	if entry.state == ChannelHealthHalfOpen {
		if slow {
			entry.openWithBackoff(now, true)
			return
		}
		entry.state = ChannelHealthClosed
		entry.failures = nil
		entry.slowSamples = nil
		entry.recentOutcomes = nil
		entry.openUntil = time.Time{}
		entry.probeLeaseUntil = time.Time{}
	}

	entry.pushRecentOutcome(false)

	if slow {
		entry.slowSamples = pruneChannelHealthFailures(entry.slowSamples, now.Add(-channelHealthFailureWindow))
		entry.slowSamples = append(entry.slowSamples, now)
		entry.restartPriorityRecoveryInterval(now)
		if len(entry.slowSamples) >= channelHealthPriorityDemotionThreshold && entry.latencyEWMA >= float64(channelHealthSlowLatency()) {
			entry.priorityDemoted = true
			entry.priorityDemotedAt = now
		}
		if len(entry.slowSamples) >= channelHealthSlowThreshold {
			entry.openWithBackoff(now, true)
		}
		return
	}
	// A fast success signals recovery: clear accumulated slowness and advance the
	// healthy streak that eventually clears the flapping backoff. Priority
	// demotion has its own two-sample recovery hysteresis so a single upstream
	// blip does not bounce a channel between tiers.
	entry.slowSamples = nil
	if entry.priorityDemoted {
		if outcome.ColdCacheStart || outcome.Latency <= 0 {
			entry.resetPriorityFastSamples()
		} else {
			entry.priorityFastSamples++
			if entry.priorityFastSamples >= channelHealthPriorityRecoveryThreshold {
				if entry.latencyEWMA < float64(channelHealthSlowLatency()) {
					entry.priorityDemoted = false
					entry.priorityDemotedAt = time.Time{}
					entry.priorityFastSamples = 0
				} else {
					entry.restartPriorityRecoveryInterval(now)
				}
			}
		}
	}
	entry.registerHealthySuccess()
}

func (e *channelHealthEntry) acquire(now time.Time) bool {
	e.lastSeenAt = now
	if e.state == ChannelHealthClosed {
		return true
	}
	if e.state == ChannelHealthOpen {
		if now.Before(e.openUntil) {
			return false
		}
		e.state = ChannelHealthHalfOpen
		e.probeLeaseUntil = now.Add(channelHealthProbeLease)
		return true
	}
	if now.Before(e.probeLeaseUntil) {
		return false
	}
	e.probeLeaseUntil = now.Add(channelHealthProbeLease)
	return true
}

func (r *channelHealthRegistry) Acquire(key ChannelHealthKey) bool {
	if !common.AdaptiveChannelHealthEnabled {
		return true
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	now := r.now()
	entry := r.entries[key]
	if entry == nil {
		return true
	}
	return entry.acquire(now)
}

// acquireForAffinity is the affinity-path counterpart to Acquire. A session that
// already holds a prompt cache on this channel keeps using it through slowness:
// a cache hit answers in ~1s even on a slow channel, whereas changing channels
// throws the cache away and pays a full cold prefill (20-40s on a ~200k-token
// prompt, measured in prod). It yields only when the channel is failure-open,
// where staying would just error and the relay would retry anyway.
//
// Unlike Acquire it is not gated by the half-open probe lease: a cache-holding
// session is not a speculative probe, so it must never be turned away from its
// own warm channel except on failures. When a slow-open channel's backoff has
// elapsed it is promoted to half-open here so this session's outcome can recover
// it; while still backing off it is served anyway without disturbing the timer.
func (r *channelHealthRegistry) acquireForAffinity(key ChannelHealthKey) bool {
	if !common.AdaptiveChannelHealthEnabled {
		return true
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	now := r.now()
	entry := r.entries[key]
	if entry == nil || entry.state == ChannelHealthClosed {
		return true
	}
	entry.lastSeenAt = now
	if entry.state == ChannelHealthOpen {
		if !entry.openedBySlow {
			// Failing, not merely slow: leave for a healthy channel.
			return false
		}
		if !now.Before(entry.openUntil) {
			entry.state = ChannelHealthHalfOpen
			entry.probeLeaseUntil = now.Add(channelHealthProbeLease)
		}
		return true
	}
	// Half-open: serve and let the outcome drive recovery; not lease-gated.
	return true
}

func (r *channelHealthRegistry) Available(key ChannelHealthKey) bool {
	if !common.AdaptiveChannelHealthEnabled {
		return true
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	entry := r.entries[key]
	if entry == nil {
		return true
	}
	now := r.now()
	entry.lastSeenAt = now
	return entry.state == ChannelHealthClosed ||
		(entry.state == ChannelHealthOpen && !now.Before(entry.openUntil)) ||
		(entry.state == ChannelHealthHalfOpen && !now.Before(entry.probeLeaseUntil))
}

func (r *channelHealthRegistry) State(key ChannelHealthKey) ChannelHealthState {
	r.mu.Lock()
	defer r.mu.Unlock()
	if entry := r.entries[key]; entry != nil {
		return entry.state
	}
	return ChannelHealthClosed
}

func (r *channelHealthRegistry) Failures(key ChannelHealthKey) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry := r.entries[key]
	if entry == nil {
		return 0
	}
	entry.failures = pruneChannelHealthFailures(entry.failures, r.now().Add(-channelHealthFailureWindow))
	return len(entry.failures)
}

func (r *channelHealthRegistry) Score(key ChannelHealthKey) float64 {
	if !common.AdaptiveChannelHealthEnabled {
		return 1
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	entry := r.entries[key]
	if entry == nil || entry.latencyEWMA <= 0 {
		return 1
	}
	if entry.state != ChannelHealthClosed {
		return minimumChannelHealthScore
	}
	score := 1 / (1 + entry.latencyEWMA/float64(time.Second))
	return math.Max(minimumChannelHealthScore, math.Min(1, score))
}

// prioritySelectionState reports whether a closed channel is softly demoted
// and whether its one-minute recovery interval has elapsed. Merely inspecting
// candidates does not consume that opportunity; acquirePriorityProbe reserves
// it only after the selector actually chooses the channel.
func (r *channelHealthRegistry) prioritySelectionState(key ChannelHealthKey) (demoted bool, probeEligible bool) {
	if !common.AdaptiveChannelHealthEnabled {
		return false, false
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	entry := r.entries[key]
	if entry == nil || entry.state != ChannelHealthClosed || !entry.priorityDemoted {
		return false, false
	}
	now := r.now()
	entry.lastSeenAt = now
	return true, now.Sub(entry.priorityDemotedAt) > channelHealthFailureWindow
}

func (r *channelHealthRegistry) shouldDemotePriority(key ChannelHealthKey) bool {
	demoted, probeEligible := r.prioritySelectionState(key)
	return demoted && !probeEligible
}

// acquirePriorityProbe atomically reserves a stale soft-demotion recovery
// opportunity. Concurrent selectors may all observe the candidate as eligible,
// but only the first one that actually selects it can send a probe; the rest
// fall back to another candidate.
func (r *channelHealthRegistry) acquirePriorityProbe(key ChannelHealthKey) bool {
	if !common.AdaptiveChannelHealthEnabled {
		return true
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	now := r.now()
	entry := r.entries[key]
	if entry == nil {
		return true
	}
	if !entry.priorityDemoted {
		return entry.acquire(now)
	}
	entry.lastSeenAt = now
	if entry.state != ChannelHealthClosed || now.Sub(entry.priorityDemotedAt) <= channelHealthFailureWindow {
		return false
	}
	entry.priorityDemotedAt = now
	return true
}

// selectionFactors returns, in one lock, a channel's health score and whether
// it is *measured fast* — a closed circuit with a latency EWMA below
// affinityFastLatency. The two are needed together at channel selection.
//
// A cold/unknown channel (no EWMA yet) is deliberately reported as not-fast: it
// keeps its full base score so it can be probed, but does not receive the
// fast-channel selection boost, which is reserved for channels proven fast right
// now. This mirrors ChannelAffinityDecision, which also treats <affinityFastLatency
// as the bar for "genuinely fast".
func (r *channelHealthRegistry) selectionFactors(key ChannelHealthKey) (score float64, latencyFast bool) {
	if !common.AdaptiveChannelHealthEnabled {
		return 1, false
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	entry := r.entries[key]
	if entry == nil || entry.latencyEWMA <= 0 {
		return 1, false
	}
	if entry.state != ChannelHealthClosed {
		return minimumChannelHealthScore, false
	}
	score = math.Max(minimumChannelHealthScore, math.Min(1, 1/(1+entry.latencyEWMA/float64(time.Second))))
	return score, entry.latencyEWMA < float64(affinityFastLatency)
}

var adaptiveChannelHealth = newChannelHealthRegistry(time.Now)

// ChannelSelectionFactors reports a channel's health-weighted score and whether
// it is currently measured fast (see selectionFactors), for weighting channel
// selection toward channels that are actually fast now.
func ChannelSelectionFactors(key ChannelHealthKey) (score float64, latencyFast bool) {
	return adaptiveChannelHealth.selectionFactors(key)
}

// EffectiveSelectionWeight turns a base selection weight into a health-adjusted
// one: scaled by the channel's health score, then multiplied by
// fastChannelSelectionBoost when the channel is measured fast right now.
//
// The boost concentrates traffic on channels that are fast at this moment, so a
// session bounced off a slow channel lands on a fast one instead of being
// weighted-randomly dropped onto another slow one (observed in prod: a session
// churned #51->#41->#56, all 8-22s, while an idle #17 did 1.8s). The health
// score alone under-separates them — 12s vs 1.8s is only ~4.6x. It self-limits:
// the boost keys off the live EWMA, so a channel that slows under the added load
// past affinityFastLatency stops being fast and traffic redistributes; slow
// channels keep a small share, which probes them for recovery.
//
// Shared by the memory-cache and DB selection paths so both weight identically.
func EffectiveSelectionWeight(baseWeight int, key ChannelHealthKey) int {
	score, fast := ChannelSelectionFactors(key)
	w := max(1, int(math.Round(float64(baseWeight)*score)))
	if fast {
		w *= fastChannelSelectionBoost
	}
	return w
}

type channelPriorityCandidate struct {
	channelID int
	priority  int
}

// buildChannelPriorityRanks builds the configured priority tiers and the
// effective tier for each candidate. Reusing this for the memory-cache and DB
// selectors keeps their routing behavior identical. A repeatedly slow channel
// moves down by at most one configured tier; if it is already in the lowest
// tier, normal health weighting remains the only adjustment.
func buildChannelPriorityRanks(candidates []channelPriorityCandidate, model string, path string) ([]int, map[int]int, map[int]bool) {
	if len(candidates) == 0 {
		return nil, nil, nil
	}
	uniquePriorities := make(map[int]struct{}, len(candidates))
	for _, candidate := range candidates {
		uniquePriorities[candidate.priority] = struct{}{}
	}
	priorities := make([]int, 0, len(uniquePriorities))
	for priority := range uniquePriorities {
		priorities = append(priorities, priority)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(priorities)))

	configuredRanks := make(map[int]int, len(priorities))
	for rank, priority := range priorities {
		configuredRanks[priority] = rank
	}
	effectiveRanks := make(map[int]int, len(candidates))
	priorityProbeCandidates := make(map[int]bool)
	for _, candidate := range candidates {
		rank := configuredRanks[candidate.priority]
		key := ChannelHealthKey{ChannelID: candidate.channelID, Model: model, Path: path}
		if rank+1 < len(priorities) {
			demoted, probeEligible := adaptiveChannelHealth.prioritySelectionState(key)
			if demoted {
				if probeEligible {
					priorityProbeCandidates[candidate.channelID] = true
				} else {
					rank++
				}
			}
		}
		effectiveRanks[candidate.channelID] = rank
	}
	return priorities, effectiveRanks, priorityProbeCandidates
}

// ShouldDemoteChannelPriority reports the current soft-priority signal. A stale
// demotion reports false so a selector can offer a recovery probe; callers that
// act on that opportunity must reserve it with AcquireChannelPriorityProbe.
// Affinity routing intentionally does not use either signal.
func ShouldDemoteChannelPriority(key ChannelHealthKey) bool {
	return adaptiveChannelHealth.shouldDemotePriority(key)
}

// AcquireChannelPriorityProbe reserves a soft-demotion recovery opportunity
// only after weighted selection has chosen that channel.
func AcquireChannelPriorityProbe(key ChannelHealthKey) bool {
	return adaptiveChannelHealth.acquirePriorityProbe(key)
}

func RecordChannelOutcome(key ChannelHealthKey, outcome ChannelOutcome) {
	adaptiveChannelHealth.Record(key, outcome)
}

func AcquireChannelHealth(key ChannelHealthKey) bool {
	return adaptiveChannelHealth.Acquire(key)
}

// AcquireChannelHealthForAffinity acquires the sticky channel for a session that
// already holds a prompt cache on it: it rides out slowness (the cache keeps it
// fast) and yields only on failures. See acquireForAffinity.
func AcquireChannelHealthForAffinity(key ChannelHealthKey) bool {
	return adaptiveChannelHealth.acquireForAffinity(key)
}

func IsChannelHealthAvailable(key ChannelHealthKey) bool {
	return adaptiveChannelHealth.Available(key)
}

func GetChannelHealthScore(key ChannelHealthKey) float64 {
	return adaptiveChannelHealth.Score(key)
}

func clearChannelHealthForTest() {
	adaptiveChannelHealth = newChannelHealthRegistry(time.Now)
}
