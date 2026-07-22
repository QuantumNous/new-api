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
	require.NoError(t, DB.Where("1 = 1").Delete(&Ability{}).Error)

	channel, err := GetChannelWithExclusions("missing", "model", 0, "", nil)

	require.NoError(t, err)
	require.Nil(t, channel)
}

func TestValidateSettingsRejectsFractionalChannelRateLimit(t *testing.T) {
	ch := &Channel{
		OtherSettings: `{"channel_rate_limit_enabled":true,"channel_rate_limit_count":1.5,"channel_rate_limit_period_seconds":60}`,
	}

	require.Error(t, ch.ValidateSettings())
}

func TestValidateSettingsAcceptsValidChannelRateLimit(t *testing.T) {
	ch := &Channel{
		OtherSettings: `{"channel_rate_limit_enabled":true,"channel_rate_limit_count":1,"channel_rate_limit_period_seconds":60}`,
	}

	require.NoError(t, ch.ValidateSettings())
}

func TestValidateSettingsAcceptsDisabledChannelRateLimitDefaults(t *testing.T) {
	ch := &Channel{
		OtherSettings: `{"channel_rate_limit_enabled":false,"channel_rate_limit_count":0,"channel_rate_limit_period_seconds":0}`,
	}

	require.NoError(t, ch.ValidateSettings())
}

func TestValidateSettingsRejectsInvalidEnabledChannelRateLimit(t *testing.T) {
	tests := []struct {
		name     string
		settings string
		message  string
	}{
		{
			name:     "zero count",
			settings: `{"channel_rate_limit_enabled":true,"channel_rate_limit_count":0,"channel_rate_limit_period_seconds":60}`,
			message:  "count must be greater than 0",
		},
		{
			name:     "zero period",
			settings: `{"channel_rate_limit_enabled":true,"channel_rate_limit_count":1,"channel_rate_limit_period_seconds":0}`,
			message:  "period must be greater than 0",
		},
		{
			name:     "invalid scope",
			settings: `{"channel_rate_limit_enabled":true,"channel_rate_limit_count":1,"channel_rate_limit_period_seconds":60,"channel_rate_limit_scope":"user"}`,
			message:  "scope must be",
		},
		{
			name:     "capacity exceeds redis exact integer range",
			settings: `{"channel_rate_limit_enabled":true,"channel_rate_limit_count":100000000,"channel_rate_limit_period_seconds":100000000}`,
			message:  "product is too large",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ch := &Channel{OtherSettings: tc.settings}

			err := ch.ValidateSettings()

			require.Error(t, err)
			require.Contains(t, err.Error(), tc.message)
		})
	}
}
