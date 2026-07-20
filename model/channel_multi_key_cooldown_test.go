package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetNextEnabledKeyPrefersNonCoolingSibling(t *testing.T) {
	clearChannelCooldownsForTest()
	t.Cleanup(clearChannelCooldownsForTest)

	channel := &Channel{
		Id:   17,
		Keys: []string{"key-a", "key-b"},
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
	}
	CooldownChannelKey(channel.Id, "key-a", "upstream_rate_limit", 2*time.Hour)

	for i := 0; i < 20; i++ {
		key, index, err := channel.GetNextEnabledKey()
		require.Nil(t, err)
		assert.Equal(t, "key-b", key)
		assert.Equal(t, 1, index)
	}
}

func TestGetNextEnabledKeyFallsBackWhenEveryEnabledKeyIsCooling(t *testing.T) {
	clearChannelCooldownsForTest()
	t.Cleanup(clearChannelCooldownsForTest)

	channel := &Channel{
		Id:   18,
		Keys: []string{"key-a", "key-b"},
		ChannelInfo: ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       2,
			MultiKeyMode:       constant.MultiKeyModeRandom,
			MultiKeyStatusList: map[int]int{1: common.ChannelStatusAutoDisabled},
		},
	}
	CooldownChannelKey(channel.Id, "key-a", "upstream_rate_limit", 2*time.Hour)

	key, index, err := channel.GetNextEnabledKey()
	require.Nil(t, err)
	assert.Equal(t, "key-a", key, "cooling keys remain a last resort when no enabled healthy key exists")
	assert.Equal(t, 0, index)
}
