package service

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-redis/redis/v8"
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

func TestMemoryFlowBackendReleaseDispatchesWaitingRequest(t *testing.T) {
	backend := NewMemoryFlowBackend()
	pool := testFlowPool()

	guard1, decision1, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	if err != nil {
		t.Fatalf("first acquire failed: %v", err)
	}
	if guard1 == nil || decision1 == nil || !decision1.Admitted {
		t.Fatalf("first acquire should be admitted immediately, decision=%+v guard=%v", decision1, guard1)
	}

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
		if err != nil {
			t.Fatalf("waiting acquire failed: %v", err)
		}
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
	if err != nil {
		t.Fatalf("first acquire failed: %v", err)
	}
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
	if err == nil {
		t.Fatal("third acquire should fail when queue is full")
	}
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
	if err != nil {
		t.Fatalf("first acquire failed: %v", err)
	}
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
	if err == nil {
		t.Fatal("fourth acquire should fail when total queue is full")
	}
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
	if err != nil {
		t.Fatalf("first acquire failed: %v", err)
	}
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
	if err == nil {
		t.Fatal("third acquire should fail when per-user queue is full")
	}
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
	if err != nil {
		t.Fatalf("fallback acquire failed: %v", err)
	}
	defer guard.Release(context.Background())

	status, err := GetChannelFlowPoolStatus(context.Background(), pool)
	if err != nil {
		t.Fatalf("status failed: %v", err)
	}
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

	guard1, decision1, err := backend.Acquire(context.Background(), AcquireRequest{
		RequestID:      "redis-req-1",
		Pool:           pool,
		UserID:         1,
		QueueTimeoutMs: pool.QueueTimeoutMs,
	})
	if err != nil {
		t.Fatalf("first redis acquire failed: %v", err)
	}
	if guard1 == nil || decision1 == nil || !decision1.Admitted {
		t.Fatalf("first redis acquire should be admitted, decision=%+v guard=%v", decision1, guard1)
	}

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
		if err != nil {
			t.Fatalf("waiting redis acquire failed: %v", err)
		}
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
	if err != nil {
		t.Fatalf("first redis acquire failed: %v", err)
	}
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
	if err == nil {
		t.Fatal("fourth redis acquire should fail when total queue is full")
	}
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
			if err != nil {
				t.Fatal(err)
			}
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
	if err != nil {
		t.Fatalf("first redis acquire failed: %v", err)
	}
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
	if err == nil {
		t.Fatal("third redis acquire should fail when per-user queue is full")
	}
	if decision == nil || decision.RejectCode != FlowDecisionRejectPerUserQueueFull {
		t.Fatalf("unexpected redis decision: %+v", decision)
	}
}

func newRedisFlowBackendForTest(t *testing.T) (*redisFlowBackend, model.ChannelFlowPool, func()) {
	t.Helper()
	redisURL := os.Getenv("REDIS_CONN_STRING")
	if redisURL == "" {
		t.Skip("REDIS_CONN_STRING is not set")
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("parse redis url: %v", err)
	}
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
		if err != nil {
			t.Fatalf("scan redis flow keys: %v", err)
		}
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
