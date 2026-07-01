package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedCacheHitLog(t *testing.T, log Log) {
	t.Helper()
	if log.Type == 0 {
		log.Type = LogTypeConsume
	}
	require.NoError(t, LOG_DB.Create(&log).Error)
}

func TestSumUsedQuotaCacheHitRateUsesAnthropicInputSemantic(t *testing.T) {
	truncateTables(t)

	seedCacheHitLog(t, Log{
		CreatedAt:        1000,
		Type:             LogTypeConsume,
		Username:         "alice",
		TokenName:        "token-a",
		ModelName:        "claude-sonnet-4-6",
		ChannelId:        1,
		Group:            "default",
		Quota:            10,
		PromptTokens:     72,
		CompletionTokens: 8,
		Other:            `{"cache_tokens":3199,"cache_creation_tokens":1024,"claude":true,"usage_semantic":"anthropic"}`,
	})

	stat, err := SumUsedQuota(LogTypeConsume, 900, 1100, "claude-sonnet-4-6", "alice", "token-a", 1, "default")
	require.NoError(t, err)

	assert.Equal(t, 3199, stat.CacheTokens)
	assert.InDelta(t, float64(3199)/float64(72+3199+1024)*100, stat.CacheHitRate, 0.0001)
}

func TestSumCacheTokensByModelUsesNormalizedTotalInput(t *testing.T) {
	truncateTables(t)

	seedCacheHitLog(t, Log{
		CreatedAt:        1000,
		Type:             LogTypeConsume,
		Username:         "alice",
		ModelName:        "gpt-4o",
		PromptTokens:     400,
		CompletionTokens: 50,
		Other:            `{"cache_tokens":100,"input_tokens_total":500}`,
	})
	seedCacheHitLog(t, Log{
		CreatedAt:        1001,
		Type:             LogTypeConsume,
		Username:         "alice",
		ModelName:        "claude-sonnet-4-6",
		PromptTokens:     72,
		CompletionTokens: 8,
		Other:            `{"cache_tokens":3199,"cache_creation_tokens":1024,"claude":true}`,
	})

	stats, err := SumCacheTokensByModel(900, 1100, "alice")
	require.NoError(t, err)
	require.Len(t, stats, 2)

	byModel := make(map[string]ModelCacheStat, len(stats))
	for _, stat := range stats {
		byModel[stat.ModelName] = stat
	}

	openAIStat, ok := byModel["gpt-4o"]
	require.True(t, ok)
	assert.Equal(t, 100, openAIStat.CacheTokens)
	assert.Equal(t, 500, openAIStat.TotalPrompt)
	assert.InDelta(t, 20.0, openAIStat.CacheHitRate, 0.0001)

	claudeStat, ok := byModel["claude-sonnet-4-6"]
	require.True(t, ok)
	assert.Equal(t, 3199, claudeStat.CacheTokens)
	assert.Equal(t, 72+3199+1024, claudeStat.TotalPrompt)
	assert.InDelta(t, float64(3199)/float64(72+3199+1024)*100, claudeStat.CacheHitRate, 0.0001)
}
