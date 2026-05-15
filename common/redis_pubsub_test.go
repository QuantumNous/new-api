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
	mr, cleanup := setupMiniredis(t)
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
	_ = mr
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
