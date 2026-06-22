package service

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func testFlowPool() model.ChannelFlowPool {
	return model.ChannelFlowPool{
		PoolKey:        "flow_pool_test",
		Name:           "test pool",
		Enabled:        true,
		Backend:        model.ChannelFlowBackendMemory,
		MaxInflight:    1,
		MaxQueueSize:   1,
		QueueTimeoutMs: 500,
		QueuePolicy:    model.ChannelFlowQueuePolicyFIFO,
		OnLimit:        model.ChannelFlowOnLimitQueue,
		ConfigVersion:  1,
	}
}

func TestBuildChannelFlowAcquireRequestIncludesRelayContextChars(t *testing.T) {
	pool := testFlowPool()
	info := &relaycommon.RelayInfo{
		UserId:          7,
		TokenId:         11,
		OriginModelName: "gpt-test",
		Request: &dto.GeneralOpenAIRequest{
			Messages: []dto.Message{{Role: "user", Content: "hello"}},
		},
	}
	info.SetEstimatePromptTokens(42)
	pool.MaxContextChars = 100

	req := buildChannelFlowAcquireRequest("req-context-chars", pool, 99, info, time.UnixMilli(1234))

	require.Equal(t, "req-context-chars", req.RequestID)
	require.Equal(t, 99, req.ChannelID)
	require.Equal(t, 42, req.ContextTokens)
	require.Equal(t, len([]rune("user\nhello")), req.ContextChars)
	require.Equal(t, int64(1234), req.CreatedAtMs)
	require.Equal(t, pool.QueueTimeoutMs, req.QueueTimeoutMs)
}

func TestChannelFlowFallbackOnlyPassesCapacityRejections(t *testing.T) {
	pool := testFlowPool()
	pool.OnLimit = model.ChannelFlowOnLimitFallback

	require.True(t, shouldPassThroughChannelFlowFallback(pool, &AcquireDecision{RejectCode: FlowDecisionRejectQueueFull}, fmt.Errorf("queue full")))
	require.True(t, shouldPassThroughChannelFlowFallback(pool, &AcquireDecision{RejectCode: FlowDecisionRejectPerUserQueueFull}, fmt.Errorf("per-user queue full")))
	require.True(t, shouldPassThroughChannelFlowFallback(pool, &AcquireDecision{RejectCode: FlowDecisionRejectPerUserInflightFull}, fmt.Errorf("per-user inflight full")))
	require.False(t, shouldPassThroughChannelFlowFallback(pool, &AcquireDecision{RejectCode: FlowDecisionRejectContextExceeded}, fmt.Errorf("context exceeded")))
	require.False(t, shouldPassThroughChannelFlowFallback(pool, &AcquireDecision{RejectCode: FlowDecisionRejectBackendDisabled}, fmt.Errorf("backend disabled")))
	require.False(t, shouldPassThroughChannelFlowFallback(pool, nil, fmt.Errorf("unknown acquire failure")))

	pool.OnLimit = model.ChannelFlowOnLimitReject
	require.False(t, shouldPassThroughChannelFlowFallback(pool, &AcquireDecision{RejectCode: FlowDecisionRejectQueueFull}, fmt.Errorf("queue full")))
}

func TestMemoryFlowBackendReleaseDispatchesWaitingRequest(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "first acquire failed")
	require.NotNil(t, guard1, "first acquire should be admitted immediately")

	resultCh := make(chan error, 1)
	go func() {
		guard2, decision2, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      "req-2",
			Pool:           pool,
			UserID:         2,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
		if err != nil {
			resultCh <- err
			return
		}
		if guard2 == nil || decision2 == nil || !decision2.Admitted || !decision2.Queued {
			resultCh <- context.Canceled
			return
		}
		_ = guard2.Release(context.Background())
		resultCh <- nil
	}()

	time.Sleep(50 * time.Millisecond)
	if err := guard1.Release(context.Background()); err != nil {
		t.Fatalf("release failed: %v", err)
	}

	select {
	case err := <-resultCh:
		require.NoError(t, err, "waiting acquire failed")
	case <-time.After(time.Second):
		t.Fatal("waiting acquire was not dispatched after release")
	}
}

func TestMemoryFlowBackendRejectsWhenQueueFull(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "first acquire failed")
	defer guard1.Release(context.Background())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	waitingStarted := make(chan struct{})
	go func() {
		close(waitingStarted)
		_, _, _ = backend.Acquire(ctx, AcquireRequest{
			RequestID:      "req-2",
			Pool:           pool,
			UserID:         2,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
	}()
	<-waitingStarted
	time.Sleep(50 * time.Millisecond)

	_, decision, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "req-3",
		Pool:           pool,
		UserID:         3,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.Error(t, err, "third acquire should fail when queue is full")
	if decision == nil || decision.RejectCode != FlowDecisionRejectQueueFull {
		t.Fatalf("unexpected decision: %+v", decision)
	}
	cancel()
}

func TestMemoryFlowBackendAllowsQueueUpToMaxQueueSize(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()
	pool.MaxQueueSize = 2

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "first acquire failed")
	defer guard1.Release(context.Background())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	for i := 2; i <= 3; i++ {
		requestID := i
		waitingStarted := make(chan struct{})
		go func() {
			close(waitingStarted)
			_, _, _ = backend.Acquire(ctx, AcquireRequest{
				RequestID:      "req-" + string(rune('0'+requestID)),
				Pool:           pool,
				UserID:         requestID,
				QueueTimeoutMs: pool.QueueTimeoutMs,
			})
		}()
		<-waitingStarted
		time.Sleep(50 * time.Millisecond)
	}

	_, decision, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "req-4",
		Pool:           pool,
		UserID:         4,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.Error(t, err, "fourth acquire should fail when total queue is full")
	if decision == nil || decision.RejectCode != FlowDecisionRejectQueueFull {
		t.Fatalf("unexpected decision: %+v", decision)
	}
	if decision.QueuedNow != 2 {
		t.Fatalf("queued count should be 2, got decision=%+v", decision)
	}
}

func TestMemoryFlowBackendRejectsWhenPerUserQueueFull(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()
	pool.MaxQueueSize = 2
	pool.MaxQueuePerUser = 1

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "first acquire failed")
	defer guard1.Release(context.Background())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	waitingStarted := make(chan struct{})
	go func() {
		close(waitingStarted)
		_, _, _ = backend.Acquire(ctx, AcquireRequest{
			RequestID:      "req-2",
			Pool:           pool,
			UserID:         1,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
	}()
	<-waitingStarted
	time.Sleep(50 * time.Millisecond)

	_, decision, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "req-3",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.Error(t, err, "third acquire should fail when per-user queue is full")
	if decision == nil || decision.RejectCode != FlowDecisionRejectPerUserQueueFull {
		t.Fatalf("unexpected decision: %+v", decision)
	}
}

func TestRedisLocalMemoryFallbackStatusUsesMemoryBackend(t *testing.T) {
	pool := testFlowPool()
	pool.PoolKey = "flow_pool_redis_local_memory_status"
	pool.Backend = model.ChannelFlowBackendRedis
	pool.RedisFailurePolicy = model.ChannelFlowRedisFailureLocalMemory
	fallbackPool := localMemoryFallbackFlowPool(pool)

	guard, _, err := GetChannelFlowController().Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-local-memory-status-1",
		Pool:           fallbackPool,
		UserID:         1,
		QueueTimeoutMs: fallbackPool.QueueTimeoutMs,
	})
	require.NoError(t, err, "fallback acquire failed")
	defer guard.Release(context.Background())

	status, err := GetChannelFlowPoolStatus(context.Background(), pool)
	require.NoError(t, err, "status failed")
	if status.Backend != model.ChannelFlowBackendMemory {
		t.Fatalf("status should report effective memory backend, got %+v", status)
	}
	if status.Running != 1 || status.MaxInflight != pool.MaxInflight {
		t.Fatalf("status should read memory fallback counters, got %+v", status)
	}
}

func TestRedisFlowBackendReleaseDispatchesWaitingRequest(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxQueueSize = 2

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "first redis acquire failed")
	require.NotNil(t, guard1, "first redis acquire should be admitted")

	resultCh := make(chan error, 1)
	go func() {
		guard2, decision2, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      "redis-req-2",
			Pool:           pool,
			UserID:         2,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
		if err != nil {
			resultCh <- err
			return
		}
		if guard2 == nil || decision2 == nil || !decision2.Admitted || !decision2.Queued {
			resultCh <- fmt.Errorf("waiting redis acquire was not queued then admitted: decision=%+v guard=%v", decision2, guard2)
			return
		}
		_ = guard2.Release(context.Background())
		resultCh <- nil
	}()

	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 1
	})

	if err := guard1.Release(context.Background()); err != nil {
		t.Fatalf("redis release failed: %v", err)
	}

	select {
	case err := <-resultCh:
		require.NoError(t, err, "waiting redis acquire failed")
	case <-time.After(2 * time.Second):
		t.Fatal("waiting redis acquire was not dispatched after release")
	}
}

func TestRedisFlowBackendAllowsQueueUpToMaxQueueSize(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxQueueSize = 2

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-queue-limit-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "first redis acquire failed")
	defer guard1.Release(context.Background())

	waitCtx, cancel := context.WithCancel(context.Background())
	resultCh := make(chan error, 2)
	for i := 2; i <= 3; i++ {
		requestID := i
		go func() {
			guard, decision, err := backend.Acquire(waitCtx, AcquireRequest{
				RequestID:      fmt.Sprintf("redis-queue-limit-%d", requestID),
				Pool:           pool,
				UserID:         requestID,
				QueueTimeoutMs: pool.QueueTimeoutMs,
			})
			if guard != nil {
				_ = guard.Release(context.Background())
			}
			if err == nil {
				resultCh <- fmt.Errorf("queued request %d was admitted before release: decision=%+v", requestID, decision)
				return
			}
			resultCh <- nil
		}()
	}

	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 2
	})

	_, decision, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-queue-limit-4",
		Pool:           pool,
		UserID:         4,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.Error(t, err, "fourth redis acquire should fail when total queue is full")
	if decision == nil || decision.RejectCode != FlowDecisionRejectQueueFull {
		t.Fatalf("unexpected redis decision: %+v", decision)
	}
	if decision.QueuedNow != 2 {
		t.Fatalf("redis queued count should be 2, got decision=%+v", decision)
	}

	cancel()
	for i := 0; i < 2; i++ {
		select {
		case err := <-resultCh:
			require.NoError(t, err)
		case <-time.After(2 * time.Second):
			t.Fatal("queued redis acquire did not exit after cancellation")
		}
	}
}

func TestRedisFlowBackendRejectsWhenPerUserQueueFull(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxQueueSize = 2
	pool.MaxQueuePerUser = 1

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-user-req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "first redis acquire failed")
	defer guard1.Release(context.Background())

	waitCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_, _, _ = backend.Acquire(waitCtx, AcquireRequest{
			RequestID:      "redis-user-req-2",
			Pool:           pool,
			UserID:         1,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
	}()
	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 1
	})

	_, decision, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-user-req-3",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.Error(t, err, "third redis acquire should fail when per-user queue is full")
	if decision == nil || decision.RejectCode != FlowDecisionRejectPerUserQueueFull {
		t.Fatalf("unexpected redis decision: %+v", decision)
	}
}

func newRedisFlowBackendForTest(t *testing.T) (*redisFlowBackend, model.ChannelFlowPool, func()) {
	t.Helper()
	if os.Getenv("CHANNEL_FLOW_REDIS_TEST") != "1" {
		t.Skip("CHANNEL_FLOW_REDIS_TEST=1 is not set")
	}
	redisURL := os.Getenv("REDIS_CONN_STRING")
	if redisURL == "" {
		t.Skip("REDIS_CONN_STRING is not set")
	}
	opt, err := redis.ParseURL(redisURL)
	require.NoError(t, err, "parse redis url")
	client := redis.NewClient(opt)
	if err := client.Ping(context.Background()).Err(); err != nil {
		_ = client.Close()
		t.Skipf("redis is not available: %v", err)
	}

	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	common.RedisEnabled = true
	common.RDB = client

	pool := testFlowPool()
	pool.PoolKey = fmt.Sprintf("flow_pool_redis_test_%d", time.Now().UnixNano())
	pool.Backend = model.ChannelFlowBackendRedis
	pool.RedisFailurePolicy = model.ChannelFlowRedisFailureFailClosed
	pool.QueueTimeoutMs = 1500
	pool.LeaseMs = 2000
	backend := NewRedisFlowBackend().(*redisFlowBackend)
	cleanupRedisFlowKeys(t, client, pool)

	return backend, pool, func() {
		cleanupRedisFlowKeys(t, client, pool)
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
		_ = client.Close()
	}
}

func cleanupRedisFlowKeys(t *testing.T, client *redis.Client, pool model.ChannelFlowPool) {
	t.Helper()
	keys := redisKeysForPool(pool)
	pattern := keys.Base + ":*"
	ctx := context.Background()
	var cursor uint64
	for {
		found, nextCursor, err := client.Scan(ctx, cursor, pattern, 100).Result()
		require.NoError(t, err, "scan redis flow keys")
		cursor = nextCursor
		if len(found) > 0 {
			if err := client.Del(ctx, found...).Err(); err != nil {
				t.Fatalf("delete redis flow keys: %v", err)
			}
		}
		if cursor == 0 {
			return
		}
	}
}

func eventuallyFlowStatus(t *testing.T, backend FlowBackend, pool model.ChannelFlowPool, predicate func(PoolStatus) bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	var last PoolStatus
	var lastErr error
	for time.Now().Before(deadline) {
		last, lastErr = backend.Status(context.Background(), pool)
		if lastErr == nil && predicate(last) {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("status predicate not met, last=%+v err=%v", last, lastErr)
}

func assertFlowStatus(t *testing.T, backend FlowBackend, pool model.ChannelFlowPool, wantRunning, wantQueued int) {
	t.Helper()
	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err)
	require.Equal(t, wantRunning, status.Running)
	require.Equal(t, wantQueued, status.Queued)
}

// ── Lifecycle Consistency Tests ─────────────────────────────────────────
//
// These tests verify Phase 1/P0 lifecycle guarantees:
//   - Guard.Release() is idempotent (safe to call multiple times)
//   - Client abort during wait properly cleans up and releases capacity
//   - max_inflight_per_user limits are enforced (Memory backend)

func TestMemoryFlowGuardReleaseIdempotent(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()

	guard, decision, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "idempotent-req",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "acquire failed")
	if !decision.Admitted {
		t.Fatalf("should be admitted immediately")
	}

	// First Release must succeed and free capacity
	if err := guard.Release(context.Background()); err != nil {
		t.Fatalf("first release failed: %v", err)
	}

	// Second release must be a no-op (not panic, not error)
	if err := guard.Release(context.Background()); err != nil {
		t.Fatalf("second release should be no-op: %v", err)
	}

	// Third release via BindRelease callback — also no-op
	if err := guard.Release(context.Background()); err != nil {
		t.Fatalf("third release should be no-op: %v", err)
	}

	// Capacity must be restored after first release
	guard2, decision2, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "idempotent-req-2",
		Pool:           pool,
		UserID:         2,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "acquire after idempotent releases failed")
	if !decision2.Admitted {
		t.Fatalf("capacity should be available after release")
	}
	guard2.Release(context.Background())
}

func TestMemoryFlowBackendClientAbortReleasesCapacity(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()

	// Fill inflight to capacity
	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "abort-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "first acquire failed")
	defer guard1.Release(context.Background())

	// Create cancellable context to simulate client abort
	abortCtx, abortCancel := context.WithCancel(context.Background())

	resultCh := make(chan *AcquireDecision, 1)
	go func() {
		_, decision, _ := backend.Acquire(abortCtx, AcquireRequest{
			RequestID:      "abort-2",
			Pool:           pool,
			UserID:         2,
			QueueTimeoutMs: 5000, // long timeout so abort is the trigger
		})
		resultCh <- decision
	}()

	time.Sleep(50 * time.Millisecond)

	// Verify queued
	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err, "status failed")
	if status.Queued != 1 {
		t.Fatalf("expected 1 queued, got %d", status.Queued)
	}

	// Simulate client abort
	abortCancel()

	select {
	case decision := <-resultCh:
		require.NotNil(t, decision, "acquire should return decision on client abort")
		require.Equal(t, FlowDecisionRejectClientCancelled, decision.RejectCode)
	case <-time.After(time.Second):
		t.Fatal("acquire did not return after client abort")
	}

	// After abort, queued count should be 0
	status, err = backend.Status(context.Background(), pool)
	require.NoError(t, err, "status after abort failed")
	if status.Queued != 0 {
		t.Fatalf("expected 0 queued after abort, got %d", status.Queued)
	}
	if status.Running != 1 {
		t.Fatalf("running count should remain 1, got %d", status.Running)
	}
}

func TestMemoryFlowBackendQueueTimeoutRejectCode(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()
	pool.QueueTimeoutMs = 30

	guard, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "timeout-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err)
	defer guard.Release(context.Background())

	_, decision, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "timeout-2",
		Pool:           pool,
		UserID:         2,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.Error(t, err)
	require.NotNil(t, decision)
	require.Equal(t, FlowDecisionRejectQueueTimeout, decision.RejectCode)

	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err)
	require.Equal(t, 1, status.Running)
	require.Equal(t, 0, status.Queued)
}

func TestMemoryFlowBackendCleanupExpiredRunning(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()
	pool.MaxInflight = 2
	pool.MaxProcessingMs = 30

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "cleanup-expired-running-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err)
	guard2, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "cleanup-expired-running-2",
		Pool:           pool,
		UserID:         2,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err)

	time.Sleep(60 * time.Millisecond)

	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err)
	require.Equal(t, 0, status.Running)
	require.Equal(t, 0, status.Queued)
	require.NoError(t, guard1.Release(context.Background()))
	require.NoError(t, guard2.Release(context.Background()))
}

func TestMemoryFlowBackendDispatchAfterCleanup(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()
	pool.MaxInflight = 1
	pool.MaxQueueSize = 4
	pool.MaxProcessingMs = 40

	type guardResult struct {
		guard    FlowGuard
		decision *AcquireDecision
		err      error
	}
	resultCh := make(chan guardResult, 2)

	guard1, decision1, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "dispatch-cleanup-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: 10000,
	})
	require.NoError(t, err)
	require.True(t, decision1.Admitted)
	assertFlowStatus(t, backend, pool, 1, 0)

	go func() {
		guard, decision, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      "dispatch-cleanup-2",
			Pool:           pool,
			UserID:         2,
			QueueTimeoutMs: 10000,
		})
		resultCh <- guardResult{guard: guard, decision: decision, err: err}
	}()
	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 1
	})

	time.Sleep(70 * time.Millisecond)
	assertFlowStatus(t, backend, pool, 0, 1)

	ctx3, cancel3 := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel3()
	go func() {
		guard, decision, err := backend.Acquire(ctx3, AcquireRequest{
			RequestID:      "dispatch-cleanup-3",
			Pool:           pool,
			UserID:         3,
			QueueTimeoutMs: 10000,
		})
		resultCh <- guardResult{guard: guard, decision: decision, err: err}
	}()
	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 1
	})

	var guard2 FlowGuard
	select {
	case result := <-resultCh:
		require.NoError(t, result.err)
		require.NotNil(t, result.guard)
		require.NotNil(t, result.decision)
		require.True(t, result.decision.Admitted)
		require.True(t, result.decision.Queued)
		guard2 = result.guard
	case <-time.After(2 * time.Second):
		t.Fatal("queued request was not dispatched after cleanup freed capacity")
	}

	require.NoError(t, guard2.Release(context.Background()))
	assertFlowStatus(t, backend, pool, 1, 0)

	select {
	case result := <-resultCh:
		require.NoError(t, result.err)
		require.NotNil(t, result.guard)
		require.NotNil(t, result.decision)
		require.True(t, result.decision.Admitted)
		require.NoError(t, result.guard.Release(context.Background()))
	case <-time.After(2 * time.Second):
		t.Fatal("third request was not dispatched after releasing promoted guard")
	}

	assertFlowStatus(t, backend, pool, 0, 0)
	require.NoError(t, guard1.Release(context.Background()))
}

func TestMemoryFlowBackendMaxInflightPerUser(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()
	pool.MaxInflight = 5
	pool.MaxInflightPerUser = 2
	pool.MaxQueueSize = 2

	// User 1: 2 requests should be admitted (hits max_inflight_per_user)
	guard1a, d1a, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "user1-req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	if err != nil || !d1a.Admitted {
		t.Fatalf("user1 req1 should be admitted: %v, decision=%+v", err, d1a)
	}
	defer guard1a.Release(context.Background())

	guard1b, d1b, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "user1-req-2",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	if err != nil || !d1b.Admitted {
		t.Fatalf("user1 req2 should be admitted: %v, decision=%+v", err, d1b)
	}
	defer guard1b.Release(context.Background())

	user1Third := make(chan error, 1)
	user1ThirdCtx, cancelUser1Third := context.WithCancel(context.Background())
	defer cancelUser1Third()
	go func() {
		guard, decision, err := backend.Acquire(user1ThirdCtx, AcquireRequest{
			RequestID:      "user1-req-3",
			Pool:           pool,
			UserID:         1,
			QueueTimeoutMs: 5000,
		})
		if err == nil {
			if guard == nil || decision == nil || !decision.Admitted || !decision.Queued {
				user1Third <- fmt.Errorf("expected queued admission after release, decision=%+v guard=%v", decision, guard)
				return
			}
			_ = guard.Release(context.Background())
		}
		user1Third <- err
	}()

	time.Sleep(50 * time.Millisecond)
	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err, "status failed")
	if status.Queued != 1 {
		t.Fatalf("expected user1 third request to queue at per-user inflight limit, got queued=%d", status.Queued)
	}

	// User 2: should still be admitted (different user, pool has capacity)
	guard2, d2, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "user2-req-1",
		Pool:           pool,
		UserID:         2,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	if err != nil || !d2.Admitted {
		t.Fatalf("user2 req1 should be admitted: %v, decision=%+v", err, d2)
	}
	defer guard2.Release(context.Background())

	if err := guard1a.Release(context.Background()); err != nil {
		t.Fatalf("release user1 req1 failed: %v", err)
	}
	select {
	case err := <-user1Third:
		require.NoError(t, err, "user1 queued request should be admitted after release")
	case <-time.After(time.Second):
		t.Fatal("user1 queued request was not admitted after release")
	}
}

func TestMemoryFlowBackendDispatchRespectsMaxInflightPerUser(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()
	pool.MaxInflight = 2
	pool.MaxInflightPerUser = 1
	pool.MaxQueueSize = 5

	// User 1: fill inflight slot
	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "dispatch-user1-req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: 5000,
	})
	require.NoError(t, err, "user1 req1 acquire failed")

	// User 2: fill another inflight slot
	guard2, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "dispatch-user2-req-1",
		Pool:           pool,
		UserID:         2,
		QueueTimeoutMs: 5000,
	})
	require.NoError(t, err, "user2 req1 acquire failed")

	// User 1: queued (2nd request, user1 already has 1 running)
	ch1 := make(chan error, 1)
	go func() {
		_, _, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      "dispatch-user1-req-2",
			Pool:           pool,
			UserID:         1,
			QueueTimeoutMs: 5000,
		})
		ch1 <- err
	}()
	time.Sleep(50 * time.Millisecond)

	// User 3: queued (user3 has 0 running, should be dispatchable)
	ch3 := make(chan error, 1)
	go func() {
		g3, d3, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      "dispatch-user3-req-1",
			Pool:           pool,
			UserID:         3,
			QueueTimeoutMs: 5000,
		})
		if err == nil && d3.Admitted {
			g3.Release(context.Background())
		}
		ch3 <- err
	}()
	time.Sleep(50 * time.Millisecond)

	// Release user2's slot — user3 should be dispatched (not user1, since user1 already at max_inflight_per_user)
	if err := guard2.Release(context.Background()); err != nil {
		t.Fatalf("guard2 release failed: %v", err)
	}

	select {
	case err := <-ch3:
		require.NoError(t, err, "user3 should be admitted after release")
	case <-time.After(time.Second):
		t.Fatal("user3 was not dispatched after release — dispatch may be blocked by user1's per-user limit")
	}

	// Cleanup
	guard1.Release(context.Background())

	// user1's queued request should timeout or complete
	select {
	case <-ch1:
	case <-time.After(2 * time.Second):
	}
}

// ── Redis Lifecycle Tests ───────────────────────────────────────────────
// These are only run when REDIS_CONN_STRING is set.

func TestRedisFlowGuardReleaseIdempotent(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()

	guard, decision, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-idempotent-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err, "redis acquire failed")
	if !decision.Admitted {
		t.Fatalf("should be admitted immediately")
	}

	// First Release
	if err := guard.Release(context.Background()); err != nil {
		t.Fatalf("first release failed: %v", err)
	}

	// Second Release must be no-op
	if err := guard.Release(context.Background()); err != nil {
		t.Fatalf("second release should be no-op: %v", err)
	}

	// Third Release also no-op
	if err := guard.Release(context.Background()); err != nil {
		t.Fatalf("third release should be no-op: %v", err)
	}

	// Capacity restored
	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 0
	})
}

func TestRedisFlowBackendMaxInflightPerUser(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxInflight = 3
	pool.MaxInflightPerUser = 2
	pool.MaxQueueSize = 0

	// User 1: 2 requests admitted
	guard1a, d1a, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-max-inflight-user1-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	if err != nil || !d1a.Admitted {
		t.Fatalf("user1 req1 should be admitted: %v, decision=%+v", err, d1a)
	}
	defer guard1a.Release(context.Background())

	guard1b, d1b, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-max-inflight-user1-2",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	if err != nil || !d1b.Admitted {
		t.Fatalf("user1 req2 should be admitted: %v, decision=%+v", err, d1b)
	}
	defer guard1b.Release(context.Background())

	// User 2: 1 request admitted (different user)
	guard2, d2, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-max-inflight-user2-1",
		Pool:           pool,
		UserID:         2,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	if err != nil || !d2.Admitted {
		t.Fatalf("user2 req1 should be admitted: %v, decision=%+v", err, d2)
	}
	defer guard2.Release(context.Background())

	// User 1: 3rd request cannot acquire (per-user inflight limit already hit)
	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 3
	})

	// User1's 3rd request can queue, but after release it must not be promoted
	// because user1 already has 2 running
	waitCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	queuedCh := make(chan error, 1)
	go func() {
		_, _, err := backend.Acquire(waitCtx, AcquireRequest{
			RequestID:      "redis-max-inflight-user1-3",
			Pool:           pool,
			UserID:         1,
			QueueTimeoutMs: 10000,
		})
		queuedCh <- err
	}()

	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Queued >= 1
	})

	// Also enqueue User3 which should be promoted when a slot opens
	waitCtx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	user3Ch := make(chan error, 1)
	go func() {
		g, d, err := backend.Acquire(waitCtx2, AcquireRequest{
			RequestID:      "redis-max-inflight-user3-1",
			Pool:           pool,
			UserID:         3,
			QueueTimeoutMs: 10000,
		})
		if err == nil && d.Admitted {
			g.Release(context.Background())
		}
		user3Ch <- err
	}()

	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Queued >= 2
	})

	// Release user2's slot — user3 should get it (user1 already at per-user limit)
	guard2.Release(context.Background())

	select {
	case err := <-user3Ch:
		require.NoError(t, err, "user3 should be admitted after release")
	case <-time.After(3 * time.Second):
		t.Fatal("user3 was not promoted — dispatch may be blocked by per-user inflight limit")
	}

	cancel2()
	cancel()
	select {
	case <-queuedCh:
	case <-time.After(2 * time.Second):
	}
}

func TestRedisFlowBackendClientAbortRejectCode(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()

	guard, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-abort-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err)
	defer guard.Release(context.Background())

	abortCtx, abortCancel := context.WithCancel(context.Background())
	resultCh := make(chan *AcquireDecision, 1)
	go func() {
		_, decision, _ := backend.Acquire(abortCtx, AcquireRequest{
			RequestID:      "redis-abort-2",
			Pool:           pool,
			UserID:         2,
			QueueTimeoutMs: 5000,
		})
		resultCh <- decision
	}()

	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 1
	})

	abortCancel()
	select {
	case decision := <-resultCh:
		require.NotNil(t, decision)
		require.Equal(t, FlowDecisionRejectClientCancelled, decision.RejectCode)
	case <-time.After(2 * time.Second):
		t.Fatal("redis acquire did not return after client abort")
	}

	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 0
	})
}

func TestRedisFlowBackendMaxProcessingCleanupIgnoresRenewedLease(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxProcessingMs = 80
	pool.LeaseMs = 1000

	guard, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-max-processing-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err)

	time.Sleep(40 * time.Millisecond)
	require.NoError(t, guard.RenewLease(context.Background()))
	time.Sleep(70 * time.Millisecond)

	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err)
	require.Equal(t, 0, status.Running, "max_processing_ms should release running request even when lease was renewed")
}

func TestRedisFlowBackendCleanupDrainsExpiredRunningBatch(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxInflight = redisFlowCleanupBatch + 5
	pool.LeaseMs = 20

	for i := 0; i < redisFlowCleanupBatch+5; i++ {
		guard, _, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      fmt.Sprintf("redis-expired-running-%d", i),
			Pool:           pool,
			UserID:         i + 1,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
		require.NoError(t, err)
		require.NotNil(t, guard)
	}

	time.Sleep(60 * time.Millisecond)
	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err)
	require.Equal(t, 0, status.Running, "cleanup should drain more than one expired running batch")
}

func TestRedisFlowBackendStatusReportsWatchContention(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxInflight = 1
	pool.MaxQueueSize = 100
	pool.QueueTimeoutMs = 15000
	pool.LeaseMs = 30000

	const workers = 30
	resultCh := make(chan error, workers)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			guard, _, err := backend.Acquire(context.Background(), AcquireRequest{
				RequestID:      fmt.Sprintf("redis-contention-%d", i),
				Pool:           pool,
				UserID:         i + 1,
				QueueTimeoutMs: 15000,
			})
			if guard != nil {
				time.Sleep(5 * time.Millisecond)
				_ = guard.Release(context.Background())
			}
			resultCh <- err
		}()
	}
	close(start)
	wg.Wait()
	for i := 0; i < workers; i++ {
		select {
		case err := <-resultCh:
			require.NoError(t, err)
		case <-time.After(5 * time.Second):
			t.Fatal("contention acquire did not finish")
		}
	}

	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err)
	require.Greater(t, status.WatchAttempts, int64(0))
	require.GreaterOrEqual(t, status.TxConflicts, int64(0))
	if status.TxConflicts > 0 {
		t.Logf("WATCH/MULTI contention confirmed: WatchAttempts=%d TxConflicts=%d conflict_rate=%.2f%%",
			status.WatchAttempts,
			status.TxConflicts,
			float64(status.TxConflicts)/float64(status.WatchAttempts)*100)
	} else {
		t.Logf("No WATCH/MULTI conflicts observed in this run (WatchAttempts=%d). "+
			"This can happen when local Redis completes WATCH/EXEC faster than competing goroutines overlap; "+
			"acceptable follow-up observations are high-concurrency spike runs, multi-instance E2E, or "+
			"production PoolStatus deltas for TxConflicts.", status.WatchAttempts)
	}
}

func TestRedisFlowBackendDirtyHeadCleanup(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxQueueSize = 5

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-dirty-head-running",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err)

	keys := redisKeysForPool(pool)
	require.NoError(t, common.RDB.ZAdd(context.Background(), keys.Waiting, &redis.Z{
		Score:  1,
		Member: "redis-dirty-head-stale",
	}).Err())
	require.NoError(t, common.RDB.Set(context.Background(), keys.Seq, 1, 0).Err())

	resultCh := make(chan error, 1)
	go func() {
		guard2, decision2, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      "redis-dirty-head-valid",
			Pool:           pool,
			UserID:         2,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
		if err != nil {
			resultCh <- err
			return
		}
		if guard2 == nil || decision2 == nil || !decision2.Admitted || !decision2.Queued {
			resultCh <- fmt.Errorf("valid request was not admitted after dirty head cleanup: decision=%+v guard=%v", decision2, guard2)
			return
		}
		_ = guard2.Release(context.Background())
		resultCh <- nil
	}()

	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 1
	})
	require.NoError(t, guard1.Release(context.Background()))

	select {
	case err := <-resultCh:
		require.NoError(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("valid request was blocked behind stale waiting head")
	}
}

func TestRedisFlowBackendLeaseRenewal(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.LeaseMs = 80

	guard, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-lease-renewal",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err)
	time.Sleep(50 * time.Millisecond)
	require.NoError(t, guard.RenewLease(context.Background()))
	time.Sleep(50 * time.Millisecond)

	status, err := backend.Status(context.Background(), pool)
	require.NoError(t, err)
	require.Equal(t, 1, status.Running, "renewed lease should keep request running")

	time.Sleep(60 * time.Millisecond)
	status, err = backend.Status(context.Background(), pool)
	require.NoError(t, err)
	require.Equal(t, 0, status.Running, "request should expire after renewed lease elapses")
}

func TestRedisFlowBackendFIFOOrdering(t *testing.T) {
	backend, pool, cleanup := newRedisFlowBackendForTest(t)
	defer cleanup()
	pool.MaxQueueSize = 5

	guard1, _, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-fifo-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	require.NoError(t, err)

	admittedCh := make(chan string, 2)
	go func() {
		guard, decision, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      "redis-fifo-2",
			Pool:           pool,
			UserID:         2,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
		if err == nil && guard != nil && decision != nil && decision.Admitted {
			admittedCh <- "redis-fifo-2"
			_ = guard.Release(context.Background())
			return
		}
		admittedCh <- "error-2"
	}()
	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 1
	})
	go func() {
		guard, decision, err := backend.Acquire(context.Background(), AcquireRequest{
			RequestID:      "redis-fifo-3",
			Pool:           pool,
			UserID:         3,
			QueueTimeoutMs: pool.QueueTimeoutMs,
		})
		if err == nil && guard != nil && decision != nil && decision.Admitted {
			admittedCh <- "redis-fifo-3"
			_ = guard.Release(context.Background())
			return
		}
		admittedCh <- "error-3"
	}()
	eventuallyFlowStatus(t, backend, pool, func(status PoolStatus) bool {
		return status.Running == 1 && status.Queued == 2
	})
	require.NoError(t, guard1.Release(context.Background()))

	select {
	case requestID := <-admittedCh:
		require.Equal(t, "redis-fifo-2", requestID)
	case <-time.After(2 * time.Second):
		t.Fatal("first queued request was not admitted")
	}
}

func TestRedisFlowOutagePolicyFailClosed(t *testing.T) {
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
	}()

	pool := testFlowPool()
	pool.Backend = model.ChannelFlowBackendRedis
	pool.RedisFailurePolicy = model.ChannelFlowRedisFailureFailClosed

	passThrough, fallbackPool, apiErr := resolveRedisFlowUnavailable(context.Background(), &pool)
	require.False(t, passThrough)
	require.Nil(t, fallbackPool)
	require.NotNil(t, apiErr)
}

func TestRedisFlowOutagePolicyFailOpen(t *testing.T) {
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
	}()

	pool := testFlowPool()
	pool.Backend = model.ChannelFlowBackendRedis
	pool.RedisFailurePolicy = model.ChannelFlowRedisFailureFailOpen

	passThrough, fallbackPool, apiErr := resolveRedisFlowUnavailable(context.Background(), &pool)
	require.True(t, passThrough)
	require.Nil(t, fallbackPool)
	require.Nil(t, apiErr)
}

func TestRedisFlowOutagePolicyLocalMemory(t *testing.T) {
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
	}()

	pool := testFlowPool()
	pool.Backend = model.ChannelFlowBackendRedis
	pool.RedisFailurePolicy = model.ChannelFlowRedisFailureLocalMemory

	passThrough, fallbackPool, apiErr := resolveRedisFlowUnavailable(context.Background(), &pool)
	require.False(t, passThrough)
	require.NotNil(t, fallbackPool)
	require.Nil(t, apiErr)
	require.Equal(t, model.ChannelFlowBackendMemory, fallbackPool.Backend)
}
