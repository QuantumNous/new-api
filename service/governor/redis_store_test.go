package governor

import (
	"context"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
)

func TestRedisStoreAcquireReleaseLease(t *testing.T) {
	t.Parallel()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run(): %v", err)
	}
	defer mr.Close()

	ctx := context.Background()

	store, err := NewRedisStore(mr.Addr())
	if err != nil {
		t.Fatalf("NewRedisStore(): %v", err)
	}

	lease, acquired, err := store.AcquireLease(ctx, "test-key", 10*time.Second)
	if err != nil {
		t.Fatalf("AcquireLease(): %v", err)
	}
	if !acquired {
		t.Fatalf("expected acquired=true")
	}

	_, acquired2, err := store.AcquireLease(ctx, "test-key", 10*time.Second)
	if err != nil {
		t.Fatalf("AcquireLease(second): %v", err)
	}
	if acquired2 {
		t.Fatalf("expected acquired=false while lease is held")
	}

	if err := store.ReleaseLease(ctx, lease); err != nil {
		t.Fatalf("ReleaseLease(): %v", err)
	}

	_, acquired3, err := store.AcquireLease(ctx, "test-key", 10*time.Second)
	if err != nil {
		t.Fatalf("AcquireLease(third): %v", err)
	}
	if !acquired3 {
		t.Fatalf("expected acquired=true after release")
	}
}

func TestRedisStoreTouchLeaseExtendsLease(t *testing.T) {
	t.Parallel()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run(): %v", err)
	}
	defer mr.Close()

	ctx := context.Background()

	store, err := NewRedisStore(mr.Addr())
	if err != nil {
		t.Fatalf("NewRedisStore(): %v", err)
	}

	lease, acquired, err := store.AcquireLease(ctx, "touch-key", 10*time.Second)
	if err != nil {
		t.Fatalf("AcquireLease(): %v", err)
	}
	if !acquired {
		t.Fatalf("expected acquired=true")
	}

	mr.FastForward(9 * time.Second)

	touched, err := store.TouchLease(ctx, lease, 10*time.Second)
	if err != nil {
		t.Fatalf("TouchLease(): %v", err)
	}
	if !touched {
		t.Fatalf("expected touched=true")
	}

	// Without the touch, the original 10s TTL would have expired at t=10s.
	// After a touch at t=9s extending by 10s, the lease should still be held at t=11s.
	mr.FastForward(2 * time.Second)

	_, acquired2, err := store.AcquireLease(ctx, "touch-key", 10*time.Second)
	if err != nil {
		t.Fatalf("AcquireLease(after-touch): %v", err)
	}
	if acquired2 {
		t.Fatalf("expected acquired=false because touch should extend TTL")
	}

	// After enough time passes beyond the extended TTL, the lease should be acquirable again.
	mr.FastForward(9 * time.Second)

	_, acquired3, err := store.AcquireLease(ctx, "touch-key", 10*time.Second)
	if err != nil {
		t.Fatalf("AcquireLease(after-expiry): %v", err)
	}
	if !acquired3 {
		t.Fatalf("expected acquired=true after extended TTL expires")
	}
}

