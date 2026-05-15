package common

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
)

// setupMiniredis returns a miniredis instance with RDB and RedisEnabled wired
// to it. Returns a cleanup function the caller must defer.
func setupMiniredis(t *testing.T) (*miniredis.Miniredis, func()) {
	t.Helper()
	mr := miniredis.RunT(t)
	prevRDB := RDB
	prevEnabled := RedisEnabled
	RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	RedisEnabled = true
	return mr, func() {
		_ = RDB.Close()
		RDB = prevRDB
		RedisEnabled = prevEnabled
	}
}

func TestPublishConfigChanged_DeliversMessage(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()

	ctx := context.Background()
	sub := RDB.Subscribe(ctx, ConfigChangedChannel)
	defer sub.Close()
	if _, err := sub.Receive(ctx); err != nil {
		t.Fatalf("subscribe receive failed: %v", err)
	}
	ch := sub.Channel()

	if err := PublishConfigChanged(ctx, "options"); err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	select {
	case msg := <-ch:
		if msg.Channel != ConfigChangedChannel {
			t.Errorf("channel = %q, want %q", msg.Channel, ConfigChangedChannel)
		}
		if !contains(msg.Payload, `"scope":"options"`) {
			t.Errorf("payload missing scope: %q", msg.Payload)
		}
		if !contains(msg.Payload, GetReplicaID()) {
			t.Errorf("payload missing replica id: %q", msg.Payload)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive message within 2s")
	}
}

func TestPublishConfigChanged_NoopWhenRedisDisabled(t *testing.T) {
	prev := RedisEnabled
	RedisEnabled = false
	defer func() { RedisEnabled = prev }()

	if err := PublishConfigChanged(context.Background(), "options"); err != nil {
		t.Errorf("expected nil error when Redis disabled, got %v", err)
	}
}

// NOTE: a `contains` helper already exists in url_validator_test.go in this
// package with the same (s, substr string) bool signature — we reuse it
// rather than redeclaring (which would fail to compile).

func TestSubscribeConfigChanged_DispatchesHandler(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()

	received := make(chan string, 1)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go SubscribeConfigChanged(ctx, func(scope string) {
		select {
		case received <- scope:
		default:
		}
	})
	// Give subscriber a moment to register
	time.Sleep(100 * time.Millisecond)

	// Publish from a different "source" so the handler runs (PublishConfigChanged
	// would use our own ReplicaID and be filtered as self — bypass it by emitting
	// raw JSON to simulate another replica).
	otherPayload := `{"scope":"channels","source":"other-replica-uuid"}`
	if err := RDB.Publish(ctx, ConfigChangedChannel, otherPayload).Err(); err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	select {
	case scope := <-received:
		if scope != "channels" {
			t.Errorf("scope = %q, want %q", scope, "channels")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("handler not called within 2s")
	}
}

func TestSubscribeConfigChanged_FiltersSelfMessages(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()

	received := make(chan string, 1)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go SubscribeConfigChanged(ctx, func(scope string) {
		received <- scope
	})
	time.Sleep(100 * time.Millisecond)

	// PublishConfigChanged uses our own ReplicaID; subscriber must ignore it.
	if err := PublishConfigChanged(ctx, "options"); err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	select {
	case scope := <-received:
		t.Fatalf("handler should not have been called for self-published message, got %q", scope)
	case <-time.After(500 * time.Millisecond):
		// expected
	}
}

func TestSubscribeConfigChanged_NoopWhenRedisDisabled(t *testing.T) {
	prev := RedisEnabled
	RedisEnabled = false
	defer func() { RedisEnabled = prev }()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() {
		SubscribeConfigChanged(ctx, func(string) {})
		close(done)
	}()

	select {
	case <-done:
		// expected: returns immediately
	case <-time.After(500 * time.Millisecond):
		t.Fatal("SubscribeConfigChanged should return immediately when Redis disabled")
	}
}
