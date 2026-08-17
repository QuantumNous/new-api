package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/require"
)

func TestShouldPassThroughTextRequestForcesCodexChatConversion(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	previous := settings.PassThroughRequestEnabled
	t.Cleanup(func() {
		settings.PassThroughRequestEnabled = previous
	})

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeCodex,
			ChannelSetting: dto.ChannelSettings{
				PassThroughBodyEnabled: true,
			},
		},
	}

	settings.PassThroughRequestEnabled = false
	require.False(t, shouldPassThroughTextRequest(info))

	info.ChannelSetting.PassThroughBodyEnabled = false
	settings.PassThroughRequestEnabled = true
	require.False(t, shouldPassThroughTextRequest(info))
}

func TestShouldPassThroughTextRequestHonorsSettingsForOtherChannels(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	previous := settings.PassThroughRequestEnabled
	t.Cleanup(func() {
		settings.PassThroughRequestEnabled = previous
	})

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeOpenAI,
		},
	}

	settings.PassThroughRequestEnabled = true
	require.True(t, shouldPassThroughTextRequest(info))

	settings.PassThroughRequestEnabled = false
	info.ChannelSetting.PassThroughBodyEnabled = true
	require.True(t, shouldPassThroughTextRequest(info))
}
