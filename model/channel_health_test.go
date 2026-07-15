package model

import (
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type fakeHealthClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *fakeHealthClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeHealthClock) Advance(d time.Duration) {
	c.mu.Lock()
	c.now = c.now.Add(d)
	c.mu.Unlock()
}

func newTestChannelHealth(t *testing.T) (*channelHealthRegistry, *fakeHealthClock) {
	t.Helper()
	oldEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	t.Cleanup(func() { common.AdaptiveChannelHealthEnabled = oldEnabled })
	clock := &fakeHealthClock{now: time.Unix(1_700_000_000, 0)}
	registry := newChannelHealthRegistry(clock.Now)
	return registry, clock
}

func TestChannelHealthOpensAtRollingFailureThreshold(t *testing.T) {
	health, _ := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}

	for i := 0; i < channelHealthFailureThreshold-1; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	if got := health.State(key); got != ChannelHealthClosed {
		t.Fatalf("state before threshold = %v, want %v", got, ChannelHealthClosed)
	}

	health.Record(key, ChannelOutcome{StatusCode: http.StatusBadGateway})
	if got := health.State(key); got != ChannelHealthOpen {
		t.Fatalf("state at threshold = %v, want %v", got, ChannelHealthOpen)
	}
	if health.Acquire(key) {
		t.Fatal("open channel allowed a request before recovery interval")
	}
}

func TestChannelHealthAllowsExactlyOneHalfOpenProbe(t *testing.T) {
	health, clock := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	clock.Advance(channelHealthOpenDuration)

	var allowed atomic.Int64
	var wg sync.WaitGroup
	for i := 0; i < 64; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if health.Acquire(key) {
				allowed.Add(1)
			}
		}()
	}
	wg.Wait()

	if got := allowed.Load(); got != 1 {
		t.Fatalf("half-open probes allowed = %d, want 1", got)
	}
	if got := health.State(key); got != ChannelHealthHalfOpen {
		t.Fatalf("state after probe = %v, want %v", got, ChannelHealthHalfOpen)
	}
}

func TestChannelHealthHalfOpenResultControlsRecovery(t *testing.T) {
	t.Run("success closes circuit", func(t *testing.T) {
		health, clock := newTestChannelHealth(t)
		key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
		for i := 0; i < channelHealthFailureThreshold; i++ {
			health.Record(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
		}
		clock.Advance(channelHealthOpenDuration)
		if !health.Acquire(key) {
			t.Fatal("expected half-open probe")
		}

		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 100 * time.Millisecond})
		if got := health.State(key); got != ChannelHealthClosed {
			t.Fatalf("state after successful probe = %v, want %v", got, ChannelHealthClosed)
		}
		if got := health.Failures(key); got != 0 {
			t.Fatalf("failures after recovery = %d, want 0", got)
		}
	})

	t.Run("failure reopens circuit", func(t *testing.T) {
		health, clock := newTestChannelHealth(t)
		key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
		for i := 0; i < channelHealthFailureThreshold; i++ {
			health.Record(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
		}
		clock.Advance(channelHealthOpenDuration)
		if !health.Acquire(key) {
			t.Fatal("expected half-open probe")
		}

		health.Record(key, ChannelOutcome{StatusCode: http.StatusBadGateway})
		if got := health.State(key); got != ChannelHealthOpen {
			t.Fatalf("state after failed probe = %v, want %v", got, ChannelHealthOpen)
		}
		if health.Acquire(key) {
			t.Fatal("failed probe did not restart open interval")
		}
	})
}

func TestChannelHealthScoresLatencyAndIsolatesKeys(t *testing.T) {
	health, _ := newTestChannelHealth(t)
	fast := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
	slow := ChannelHealthKey{ChannelID: 29, Model: "gpt-5.5", Path: "/v1/responses"}
	otherPath := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/chat/completions"}

	for i := 0; i < 5; i++ {
		health.Record(fast, ChannelOutcome{StatusCode: http.StatusOK, Latency: 100 * time.Millisecond})
		health.Record(slow, ChannelOutcome{StatusCode: http.StatusOK, Latency: 2 * time.Second})
	}
	if health.Score(slow) >= health.Score(fast) {
		t.Fatalf("slow score %f must be below fast score %f", health.Score(slow), health.Score(fast))
	}
	for i := 0; i < channelHealthFailureThreshold; i++ {
		health.Record(fast, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	if got := health.State(otherPath); got != ChannelHealthClosed {
		t.Fatalf("different path state = %v, want %v", got, ChannelHealthClosed)
	}
}

func TestChannelHealthIgnoresSemanticClientErrors(t *testing.T) {
	health, _ := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold+1; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusBadGateway, SemanticError: true})
	}
	if got := health.Failures(key); got != 0 {
		t.Fatalf("semantic failure count = %d, want 0", got)
	}
	if got := health.State(key); got != ChannelHealthClosed {
		t.Fatalf("semantic error state = %v, want %v", got, ChannelHealthClosed)
	}
}

func TestIsChannelFastEnoughForAffinity(t *testing.T) {
	oldEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	clearChannelHealthForTest()
	t.Cleanup(func() {
		clearChannelHealthForTest()
		common.AdaptiveChannelHealthEnabled = oldEnabled
	})

	cold := ChannelHealthKey{ChannelID: 40, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	if !IsChannelFastEnoughForAffinity(cold) {
		t.Fatal("cold/unknown sticky channel must keep affinity")
	}

	fast := ChannelHealthKey{ChannelID: 41, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	for i := 0; i < 4; i++ {
		RecordChannelOutcome(fast, ChannelOutcome{StatusCode: http.StatusOK, Latency: 1500 * time.Millisecond})
	}
	if !IsChannelFastEnoughForAffinity(fast) {
		t.Fatal("fast sticky channel must keep affinity")
	}

	slow := ChannelHealthKey{ChannelID: 42, Model: "gpt-5.6-sol", Path: "/v1/responses"}
	for i := 0; i < 5; i++ {
		RecordChannelOutcome(slow, ChannelOutcome{StatusCode: http.StatusOK, Latency: 20 * time.Second})
	}
	if IsChannelFastEnoughForAffinity(slow) {
		t.Fatal("sustained-slow sticky channel must yield affinity so routing can pick a faster channel")
	}

	// Gate: disabled adaptive health keeps affinity regardless (current behavior).
	common.AdaptiveChannelHealthEnabled = false
	if !IsChannelFastEnoughForAffinity(slow) {
		t.Fatal("with adaptive health off, affinity must be preserved (no-op)")
	}
	common.AdaptiveChannelHealthEnabled = true
}

func TestChannelHealthOpensOnSustainedSlowness(t *testing.T) {
	health, _ := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 50, Model: "gpt-5.5", Path: "/v1/responses"}
	slow := channelHealthSlowLatency() + time.Second

	for i := 0; i < channelHealthSlowThreshold; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	}
	if got := health.State(key); got != ChannelHealthOpen {
		t.Fatalf("state after %d slow successes = %v, want %v (consistently-slow channel must be evicted)", channelHealthSlowThreshold, got, ChannelHealthOpen)
	}
	if health.Acquire(key) {
		t.Fatal("slow-tripped channel allowed a request before its recovery interval")
	}
}

func TestChannelHealthFastSuccessResetsSlowness(t *testing.T) {
	health, _ := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 50, Model: "gpt-5.5", Path: "/v1/responses"}
	slow := channelHealthSlowLatency() + time.Second
	fast := 500 * time.Millisecond

	// A fast success between slow ones must reset the counter, so an occasional
	// spike on an otherwise-fast channel never trips the circuit.
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: fast})
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	if got := health.State(key); got != ChannelHealthClosed {
		t.Fatalf("state = %v, want %v (a fast success must reset the slow counter)", got, ChannelHealthClosed)
	}
}

func TestChannelHealthHalfOpenSlowProbeReopens(t *testing.T) {
	health, clock := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 50, Model: "gpt-5.5", Path: "/v1/responses"}
	slow := channelHealthSlowLatency() + time.Second
	for i := 0; i < channelHealthSlowThreshold; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	}
	clock.Advance(channelHealthOpenDuration)
	if !health.Acquire(key) {
		t.Fatal("expected half-open probe after open interval")
	}

	// A still-slow probe must reopen, not recover.
	health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: slow})
	if got := health.State(key); got != ChannelHealthOpen {
		t.Fatalf("state after slow probe = %v, want %v", got, ChannelHealthOpen)
	}
}

func TestChannelHealthCountsOverloadStatuses(t *testing.T) {
	// 408/429 mean the channel is overloaded / rate-limited right now: a
	// channel-capacity signal that should deprioritize it, unlike genuine
	// client 4xx.
	for _, status := range []int{http.StatusRequestTimeout, http.StatusTooManyRequests} {
		health, _ := newTestChannelHealth(t)
		key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
		for i := 0; i < channelHealthFailureThreshold; i++ {
			health.Record(key, ChannelOutcome{StatusCode: status})
		}
		if got := health.State(key); got != ChannelHealthOpen {
			t.Fatalf("status %d: state = %v, want %v (overloaded channel must lose health)", status, got, ChannelHealthOpen)
		}
	}
}

func TestChannelHealthIgnoresGenuineClientErrors(t *testing.T) {
	// Real client errors (bad request, auth, not found, unprocessable) are not
	// the channel's availability problem; credential failures are handled by the
	// cooldown/auto-ban system, not the health circuit.
	for _, status := range []int{http.StatusBadRequest, http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity} {
		health, _ := newTestChannelHealth(t)
		key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
		for i := 0; i < channelHealthFailureThreshold+1; i++ {
			health.Record(key, ChannelOutcome{StatusCode: status})
		}
		if got := health.State(key); got != ChannelHealthClosed {
			t.Fatalf("status %d: state = %v, want %v (client errors must not affect channel health)", status, got, ChannelHealthClosed)
		}
	}
}

func TestChannelHealthTripsOnSpreadOutIntermittentFailures(t *testing.T) {
	// A volatile channel that times out intermittently, with the failures spread
	// far enough apart (40s) that no 60s window ever holds three of them, must
	// still trip on the rate-based window. Under the time-window-only rule this
	// channel would never open and would keep being selected.
	health, clock := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 42, Model: "gpt-5.6-sol", Path: "/v1/responses"}

	seq := []bool{true, false, true, false, true} // fail, ok, fail, ok, fail
	for i, failed := range seq {
		if failed {
			health.Record(key, ChannelOutcome{StatusCode: http.StatusInternalServerError})
		} else {
			health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 500 * time.Millisecond})
		}
		if i < len(seq)-1 {
			clock.Advance(40 * time.Second)
		}
	}

	if got := health.Failures(key); got >= channelHealthFailureThreshold {
		t.Fatalf("time-window failures = %d; test must exercise the rate window, not the 60s burst rule", got)
	}
	if got := health.State(key); got != ChannelHealthOpen {
		t.Fatalf("state after 3-of-5 intermittent failures = %v, want %v (volatile channel must trip)", got, ChannelHealthOpen)
	}
}

func TestChannelHealthBackoffEscalatesOnRepeatedOpens(t *testing.T) {
	// A channel that fails again right after recovering must stay open longer the
	// second time, so a flapping channel is not retried every base interval.
	health, clock := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 42, Model: "gpt-5.6-sol", Path: "/v1/responses"}

	for i := 0; i < channelHealthFailureThreshold; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	clock.Advance(channelHealthOpenDuration)
	if !health.Acquire(key) {
		t.Fatal("expected half-open probe after the base open interval")
	}
	// Probe fails -> reopen with escalated (2x) backoff.
	health.Record(key, ChannelOutcome{StatusCode: http.StatusBadGateway})
	if got := health.State(key); got != ChannelHealthOpen {
		t.Fatalf("state after failed probe = %v, want %v", got, ChannelHealthOpen)
	}
	// One base interval is no longer enough to release the escalated open.
	clock.Advance(channelHealthOpenDuration)
	if health.Acquire(key) {
		t.Fatal("escalated backoff must keep the circuit open longer than the base interval")
	}
	// A second base interval (2x total) elapses -> a probe is allowed.
	clock.Advance(channelHealthOpenDuration)
	if !health.Acquire(key) {
		t.Fatal("circuit should allow a probe once the escalated interval elapses")
	}
}

func TestChannelHealthBackoffResetsAfterSustainedHealth(t *testing.T) {
	health, clock := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 42, Model: "gpt-5.6-sol", Path: "/v1/responses"}

	// Trip and escalate the backoff once.
	for i := 0; i < channelHealthFailureThreshold; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	clock.Advance(channelHealthOpenDuration)
	if !health.Acquire(key) {
		t.Fatal("expected first half-open probe")
	}
	health.Record(key, ChannelOutcome{StatusCode: http.StatusBadGateway}) // reopen, escalated
	clock.Advance(2 * channelHealthOpenDuration)
	if !health.Acquire(key) {
		t.Fatal("expected half-open probe after the escalated interval")
	}
	// Sustained health: enough fast successes (probe + closed-state) to reset.
	for i := 0; i < channelHealthBackoffResetStreak; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 100 * time.Millisecond})
	}
	if got := health.State(key); got != ChannelHealthClosed {
		t.Fatalf("state after sustained healthy successes = %v, want %v", got, ChannelHealthClosed)
	}
	// Trip again: the backoff must be back to the base interval, not escalated.
	for i := 0; i < channelHealthFailureThreshold; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusServiceUnavailable})
	}
	clock.Advance(channelHealthOpenDuration)
	if !health.Acquire(key) {
		t.Fatal("after sustained health the backoff must reset to the base open interval")
	}
}

func TestChannelHealthToleratesOccasionalBlip(t *testing.T) {
	// A healthy channel with an isolated failure among many successes (well under
	// the rate threshold) must not trip.
	health, _ := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 28, Model: "gpt-5.6-sol", Path: "/v1/responses"}

	for i := 0; i < 4; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 300 * time.Millisecond})
	}
	health.Record(key, ChannelOutcome{StatusCode: http.StatusInternalServerError})
	for i := 0; i < 4; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusOK, Latency: 300 * time.Millisecond})
	}
	if got := health.State(key); got != ChannelHealthClosed {
		t.Fatalf("state after a single blip among successes = %v, want %v", got, ChannelHealthClosed)
	}
}

func TestChannelHealthIgnoresGatewayLocalErrors(t *testing.T) {
	health, _ := newTestChannelHealth(t)
	key := ChannelHealthKey{ChannelID: 17, Model: "gpt-5.5", Path: "/v1/responses"}
	for i := 0; i < channelHealthFailureThreshold+1; i++ {
		health.Record(key, ChannelOutcome{StatusCode: http.StatusInternalServerError, LocalError: true})
	}
	if got := health.Failures(key); got != 0 {
		t.Fatalf("local failure count = %d, want 0", got)
	}
	if got := health.State(key); got != ChannelHealthClosed {
		t.Fatalf("local error state = %v, want %v", got, ChannelHealthClosed)
	}
}
