package wsmanager

import (
	"context"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func resetRegistryForTest() {
	mu.Lock()
	defer mu.Unlock()
	registry = map[int]map[uint64]*entry{}
	nextID = 0
}

func TestCloseChannelClosesRegisteredConnectionsOnce(t *testing.T) {
	resetRegistryForTest()

	var mu sync.Mutex
	calls := 0
	Register(10, KindRealtime, func(reason string) {
		mu.Lock()
		defer mu.Unlock()
		if reason != "test reason" {
			t.Fatalf("reason = %q, want test reason", reason)
		}
		calls++
	})
	Register(10, KindResponses, func(reason string) {
		mu.Lock()
		defer mu.Unlock()
		calls++
	})

	if closed := CloseChannel(10, "test reason"); closed != 2 {
		t.Fatalf("closed = %d, want 2", closed)
	}
	if closed := CloseChannel(10, "test reason"); closed != 0 {
		t.Fatalf("second close = %d, want 0", closed)
	}

	mu.Lock()
	defer mu.Unlock()
	if calls != 2 {
		t.Fatalf("calls = %d, want 2", calls)
	}
}

func TestCloseChannelDoesNotCloseOtherChannels(t *testing.T) {
	resetRegistryForTest()

	calls := map[int]int{}
	Register(10, KindRealtime, func(reason string) {
		calls[10]++
	})
	Register(20, KindRealtime, func(reason string) {
		calls[20]++
	})

	if closed := CloseChannel(10, "test"); closed != 1 {
		t.Fatalf("closed = %d, want 1", closed)
	}
	if calls[10] != 1 {
		t.Fatalf("channel 10 calls = %d, want 1", calls[10])
	}
	if calls[20] != 0 {
		t.Fatalf("channel 20 calls = %d, want 0", calls[20])
	}
}

func TestUnregisterPreventsClose(t *testing.T) {
	resetRegistryForTest()

	calls := 0
	unregister := Register(10, KindRealtime, func(reason string) {
		calls++
	})
	unregister()

	if closed := CloseChannel(10, "test"); closed != 0 {
		t.Fatalf("closed = %d, want 0", closed)
	}
	if calls != 0 {
		t.Fatalf("calls = %d, want 0", calls)
	}
}

func TestRegisteredCloseIsIdempotent(t *testing.T) {
	resetRegistryForTest()

	calls := 0
	Register(10, KindRealtime, func(reason string) {
		calls++
	})

	mu.Lock()
	var registered *entry
	for _, e := range registry[10] {
		registered = e
	}
	mu.Unlock()
	if registered == nil {
		t.Fatal("registered entry is nil")
	}

	registered.close("test")
	registered.close("test")
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
}

func TestPublishCloseChannelsNoopsWhenRedisDisabled(t *testing.T) {
	resetRegistryForTest()

	oldEnabled := common.RedisEnabled
	oldRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = oldEnabled
		common.RDB = oldRDB
	}()

	if err := PublishCloseChannels(context.Background(), []int{10}, "test"); err != nil {
		t.Fatalf("PublishCloseChannels() error = %v", err)
	}
}
