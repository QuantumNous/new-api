package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestClearCurrentChannelAffinity(t *testing.T) {
	originalRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = originalRedisEnabled
		_ = getChannelAffinityCache().Purge()
	})

	cache := getChannelAffinityCache()
	_ = cache.Purge()

	cacheKey := "new-api:channel_affinity:v1:codex cli trace:default:test-affinity-key"
	require.NoError(t, cache.SetWithTTL(cacheKey, 42, time.Minute))

	ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
		CacheKey:       cacheKey,
		TTLSeconds:     60,
		RuleName:       "codex cli trace",
		SkipRetry:      true,
		UsingGroup:     "default",
		ModelName:      "gpt-5",
		RequestPath:    "/v1/responses",
		KeySourceType:  "gjson",
		KeySourcePath:  "prompt_cache_key",
		KeyHint:        "test...key",
		KeyFingerprint: "abcd1234",
	})

	require.True(t, ClearCurrentChannelAffinity(ctx, "preferred affinity channel 42 is disabled"))

	_, found, err := cache.Get(cacheKey)
	require.NoError(t, err)
	require.False(t, found)
	require.False(t, ShouldSkipRetryAfterChannelAffinityFailure(ctx))

	anyInfo, ok := ctx.Get(ginKeyChannelAffinityLogInfo)
	require.True(t, ok)
	info, ok := anyInfo.(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, true, info["stale_affinity_cleared"])
	require.Equal(t, "preferred affinity channel 42 is disabled", info["stale_affinity_reason"])
	require.Equal(t, "codex cli trace", info["rule_name"])
	require.Equal(t, "default", info["using_group"])
}
