package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestChannelAffinityExclusiveLockRejectsOtherToken(t *testing.T) {
	prevRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = prevRedisEnabled
		ClearChannelAffinityExclusiveCacheAll()
	})

	ClearChannelAffinityExclusiveCacheAll()

	require.True(t, TrySetChannelAffinityExclusiveLock(101, 1001, time.Minute))
	require.True(t, IsChannelAffinityExclusiveAvailable(101, 1001))
	require.False(t, IsChannelAffinityExclusiveAvailable(101, 1002))
	require.False(t, IsChannelAffinityExclusiveAvailable(101, 0))
	require.False(t, TrySetChannelAffinityExclusiveLock(101, 1002, time.Minute))

	holder, found := GetChannelAffinityExclusiveLockHolder(101)
	require.True(t, found)
	require.Equal(t, 1001, holder)
}

func TestCleanupChannelAffinityExclusiveBindingsByAffinityKeysKeepsLockUntilLastBindingRemoved(t *testing.T) {
	prevRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = prevRedisEnabled
		ClearChannelAffinityExclusiveCacheAll()
	})

	ClearChannelAffinityExclusiveCacheAll()

	ttl := time.Minute
	require.True(t, TrySetChannelAffinityExclusiveLock(201, 2001, ttl))
	require.NoError(t, setChannelAffinityExclusiveBinding("rule-a:key-1", ChannelAffinityExclusiveBinding{ChannelID: 201, TokenID: 2001}, ttl))
	require.NoError(t, setChannelAffinityExclusiveBinding("rule-a:key-2", ChannelAffinityExclusiveBinding{ChannelID: 201, TokenID: 2001}, ttl))

	cleanupChannelAffinityExclusiveBindingsByAffinityKeys([]string{"rule-a:key-1"})
	require.False(t, IsChannelAffinityExclusiveAvailable(201, 3001))

	cleanupChannelAffinityExclusiveBindingsByAffinityKeys([]string{"rule-a:key-2"})
	require.True(t, IsChannelAffinityExclusiveAvailable(201, 3001))
}

func TestClearChannelAffinityCacheByRuleNameAlsoClearsExclusiveBinding(t *testing.T) {
	prevRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = prevRedisEnabled
		ClearChannelAffinityExclusiveCacheAll()
		_ = ClearChannelAffinityCacheAll()
	})

	ClearChannelAffinityExclusiveCacheAll()
	_ = ClearChannelAffinityCacheAll()

	var matchedRule *operation_setting.ChannelAffinityRule
	for i := range operation_setting.GetChannelAffinitySetting().Rules {
		rule := &operation_setting.GetChannelAffinitySetting().Rules[i]
		if rule.IncludeRuleName {
			matchedRule = rule
			break
		}
	}
	require.NotNil(t, matchedRule)

	cacheKey := buildChannelAffinityCacheKeySuffix(*matchedRule, "default", "exclusive-test")
	require.NoError(t, getChannelAffinityCache().SetWithTTL(cacheKey, 301, time.Minute))
	require.True(t, TrySetChannelAffinityExclusiveLock(301, 3001, time.Minute))
	require.NoError(t, setChannelAffinityExclusiveBinding(cacheKey, ChannelAffinityExclusiveBinding{ChannelID: 301, TokenID: 3001}, time.Minute))

	deleted, err := ClearChannelAffinityCacheByRuleName(matchedRule.Name)
	require.NoError(t, err)
	require.Equal(t, 1, deleted)
	require.True(t, IsChannelAffinityExclusiveAvailable(301, 4001))
}
