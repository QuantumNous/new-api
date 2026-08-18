package wsmanager

import (
	"context"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		require.Equal(t, "test reason", reason, "close callback should receive the provided reason")
		calls++
	})
	Register(10, KindResponses, func(reason string) {
		mu.Lock()
		defer mu.Unlock()
		calls++
	})

	require.Equal(t, 2, CloseChannel(10, "test reason"), "CloseChannel should close every registered connection for the channel")
	require.Equal(t, 0, CloseChannel(10, "test reason"), "CloseChannel should not close already removed connections")

	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, 2, calls, "all registered close callbacks should be called once")
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

	require.Equal(t, 1, CloseChannel(10, "test"), "CloseChannel should only close the requested channel")
	assert.Equal(t, 1, calls[10], "requested channel callback should run")
	assert.Equal(t, 0, calls[20], "other channel callback should not run")
}

func TestUnregisterPreventsClose(t *testing.T) {
	resetRegistryForTest()

	calls := 0
	unregister := Register(10, KindRealtime, func(reason string) {
		calls++
	})
	unregister()

	require.Equal(t, 0, CloseChannel(10, "test"), "unregistered connections should not be closed")
	assert.Equal(t, 0, calls, "unregistered close callback should not run")
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
	require.NotNil(t, registered, "registered entry should exist")

	registered.close("test")
	registered.close("test")
	assert.Equal(t, 1, calls, "registered close callback should be idempotent")
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

	require.NoError(t, PublishCloseChannels(context.Background(), []int{10}, "test"), "publishing should no-op without Redis")
}
