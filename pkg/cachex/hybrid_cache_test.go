package cachex

import (
	"testing"
	"time"

	"github.com/samber/hot"
	"github.com/stretchr/testify/require"
)

func TestSetIfAbsentWithTTLDoesNotOverwriteOrRefresh(t *testing.T) {
	cache := NewHybridCache[string](HybridCacheConfig[string]{
		Namespace: "set-if-absent-test",
		Memory: func() *hot.HotCache[string, string] {
			return hot.NewHotCache[string, string](hot.LRU, 10).Build()
		},
	})

	created, err := cache.SetIfAbsentWithTTL("key", "first", 300*time.Millisecond)
	require.NoError(t, err)
	require.True(t, created)

	time.Sleep(150 * time.Millisecond)
	created, err = cache.SetIfAbsentWithTTL("key", "second", 300*time.Millisecond)
	require.NoError(t, err)
	require.False(t, created)
	value, found, err := cache.Get("key")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "first", value)

	time.Sleep(200 * time.Millisecond)
	_, found, err = cache.Get("key")
	require.NoError(t, err)
	require.False(t, found)
}
