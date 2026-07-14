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
