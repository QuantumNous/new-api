package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestGetNextEnabledKeyExcludingSkipsLimitedKeys(t *testing.T) {
	ch := &Channel{
		Key: "key-0\nkey-1\nkey-2",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				0: common.ChannelStatusEnabled,
				1: common.ChannelStatusEnabled,
				2: common.ChannelStatusManuallyDisabled,
			},
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
	}

	key, idx, err := ch.GetNextEnabledKeyExcluding(map[int]bool{0: true})
	require.Nil(t, err)
	require.Equal(t, 1, idx)
	require.Equal(t, "key-1", key)
}

func TestGetNextEnabledKeyExcludingReturnsNoAvailableKey(t *testing.T) {
	ch := &Channel{
		Key: "key-0\nkey-1",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				0: common.ChannelStatusEnabled,
				1: common.ChannelStatusEnabled,
			},
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
	}

	_, _, err := ch.GetNextEnabledKeyExcluding(map[int]bool{0: true, 1: true})
	require.NotNil(t, err)
	require.Equal(t, types.ErrorCodeChannelNoAvailableKey, err.GetErrorCode())
}

func TestGetChannelWithExclusionsNoPriorityReturnsNil(t *testing.T) {
	initCol()
	require.NoError(t, DB.AutoMigrate(&Ability{}))
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)

	channel, err := GetChannelWithExclusions("missing", "model", 0, "", nil)

	require.NoError(t, err)
	require.Nil(t, channel)
}

func TestValidateOtherSettingsRejectsFractionalChannelRateLimit(t *testing.T) {
	ch := &Channel{
		OtherSettings: `{"channel_rate_limit_enabled":true,"channel_rate_limit_count":1.5,"channel_rate_limit_period_seconds":60}`,
	}

	require.Error(t, ch.ValidateOtherSettings())
}

func TestValidateOtherSettingsAcceptsIntegerChannelRateLimit(t *testing.T) {
	ch := &Channel{
		OtherSettings: `{"channel_rate_limit_enabled":true,"channel_rate_limit_count":1,"channel_rate_limit_period_seconds":60}`,
	}

	require.NoError(t, ch.ValidateOtherSettings())
}
