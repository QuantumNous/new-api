package model

import (
	"math"
	"net/http"
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

	// channelHealthSlowThreshold consecutive slow successes (a fast success
	// resets the count) trip the circuit, so a consistently-slow channel is
	// evicted and re-probed like a failing one, while an occasional spike on an
	// otherwise-fast channel does not trip it. The "slow" first-token latency
	// bound is configurable (CHANNEL_HEALTH_SLOW_LATENCY_SECONDS); see
	// channelHealthSlowLatency.
	channelHealthSlowThreshold             = 3
	defaultChannelHealthSlowLatencySeconds = 9
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
}

type channelHealthEntry struct {
	state           ChannelHealthState
	failures        []time.Time
	slowSamples     []time.Time
	openUntil       time.Time
	probeLeaseUntil time.Time
	latencyEWMA     float64
	lastSeenAt      time.Time
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
	if !common.AdaptiveChannelHealthEnabled || outcome.LocalError || outcome.SemanticError {
		return
	}
	// Ignore genuine client 4xx (bad request, auth, not found, unprocessable);
	// they are not the channel's availability problem. 408/429 are the
	// exception: they signal an overloaded channel and must count.
	if outcome.StatusCode >= http.StatusBadRequest && outcome.StatusCode < http.StatusInternalServerError &&
		!isChannelOverloadStatus(outcome.StatusCode) {
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
		if entry.state == ChannelHealthHalfOpen {
			entry.state = ChannelHealthOpen
			entry.openUntil = now.Add(channelHealthOpenDuration)
			entry.probeLeaseUntil = time.Time{}
			return
		}
		entry.failures = pruneChannelHealthFailures(entry.failures, now.Add(-channelHealthFailureWindow))
		entry.failures = append(entry.failures, now)
		if len(entry.failures) >= channelHealthFailureThreshold {
			entry.state = ChannelHealthOpen
			entry.openUntil = now.Add(channelHealthOpenDuration)
			entry.probeLeaseUntil = time.Time{}
		}
		return
	}

	if outcome.Latency > 0 {
		latency := float64(outcome.Latency)
		if entry.latencyEWMA == 0 {
			entry.latencyEWMA = latency
		} else {
			entry.latencyEWMA = entry.latencyEWMA*0.8 + latency*0.2
		}
	}

	// A successful-but-slow response is a soft failure: a channel that keeps
	// taking too long to first token is evicted and re-probed like a failing
	// one, so latency weighting (which only reorders within a priority tier) is
	// not the only defense against consistently-slow channels.
	slow := outcome.Latency >= channelHealthSlowLatency()

	if entry.state == ChannelHealthHalfOpen {
		if slow {
			entry.state = ChannelHealthOpen
			entry.openUntil = now.Add(channelHealthOpenDuration)
			entry.probeLeaseUntil = time.Time{}
			return
		}
		entry.state = ChannelHealthClosed
		entry.failures = nil
		entry.slowSamples = nil
		entry.openUntil = time.Time{}
		entry.probeLeaseUntil = time.Time{}
		return
	}

	if slow {
		entry.slowSamples = pruneChannelHealthFailures(entry.slowSamples, now.Add(-channelHealthFailureWindow))
		entry.slowSamples = append(entry.slowSamples, now)
		if len(entry.slowSamples) >= channelHealthSlowThreshold {
			entry.state = ChannelHealthOpen
			entry.openUntil = now.Add(channelHealthOpenDuration)
			entry.slowSamples = nil
			entry.probeLeaseUntil = time.Time{}
		}
		return
	}
	// A fast success signals recovery: clear accumulated slowness so only
	// sustained (un-interrupted) slowness trips the circuit.
	entry.slowSamples = nil
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
	entry.lastSeenAt = now
	if entry.state == ChannelHealthClosed {
		return true
	}
	if entry.state == ChannelHealthOpen {
		if now.Before(entry.openUntil) {
			return false
		}
		entry.state = ChannelHealthHalfOpen
		entry.probeLeaseUntil = now.Add(channelHealthProbeLease)
		return true
	}
	if now.Before(entry.probeLeaseUntil) {
		return false
	}
	entry.probeLeaseUntil = now.Add(channelHealthProbeLease)
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

var adaptiveChannelHealth = newChannelHealthRegistry(time.Now)

func RecordChannelOutcome(key ChannelHealthKey, outcome ChannelOutcome) {
	adaptiveChannelHealth.Record(key, outcome)
}

func AcquireChannelHealth(key ChannelHealthKey) bool {
	return adaptiveChannelHealth.Acquire(key)
}

func IsChannelHealthAvailable(key ChannelHealthKey) bool {
	return adaptiveChannelHealth.Available(key)
}

func GetChannelHealthScore(key ChannelHealthKey) float64 {
	return adaptiveChannelHealth.Score(key)
}

// IsChannelFastEnoughForAffinity reports whether a prompt-cache-sticky channel
// is healthy enough to keep routing to. It returns false once the channel is
// sustained-slow (health score pinned to the floor, i.e. first-token latency
// past the slow threshold) or its circuit is open, so a cache-locked user is
// released to normal health-weighted selection and moves to a faster available
// channel. A cold/unknown or fast channel keeps its affinity. No-op (always
// true) when adaptive health is disabled.
func IsChannelFastEnoughForAffinity(key ChannelHealthKey) bool {
	if !common.AdaptiveChannelHealthEnabled {
		return true
	}
	return GetChannelHealthScore(key) > minimumChannelHealthScore
}

func clearChannelHealthForTest() {
	adaptiveChannelHealth = newChannelHealthRegistry(time.Now)
}
