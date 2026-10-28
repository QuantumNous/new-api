package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTotalTokensFromUsageIncludesCacheReadAndWrite(t *testing.T) {
	got := totalTokensFromUsage(100, 20, map[string]interface{}{
		"cache_tokens":       30,
		"cache_write_tokens": 40,
	})
	require.Equal(t, 190, got)
}

func TestTotalTokensFromUsageFallsBackToSplitCacheWrites(t *testing.T) {
	got := totalTokensFromUsage(100, 20, map[string]interface{}{
		"cache_tokens":             30,
		"cache_creation_tokens_5m": 40,
		"cache_creation_tokens_1h": 50,
	})
	require.Equal(t, 240, got)
}
