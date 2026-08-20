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

// TestShouldPassThroughTextRequestForcesGrokChatConversion 锁住 Chat 侧 PassThrough 挡板
// 对 Grok Subscription 渠道的覆盖（与 claude_handler 侧 shouldClaudeUseResponsesBridge 对称）：
// Grok 上游只有 /v1/responses 端点，chat 原文透传必然协议不匹配，即使全局/渠道透传
// 开关开启也必须走转换路径。
func TestShouldPassThroughTextRequestForcesGrokChatConversion(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	previous := settings.PassThroughRequestEnabled
	t.Cleanup(func() {
		settings.PassThroughRequestEnabled = previous
	})

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeGrokSubscription,
		},
	}

	// 全局透传开关开。
	settings.PassThroughRequestEnabled = true
	require.False(t, shouldPassThroughTextRequest(info))

	// 渠道级透传开关开（全局关）。
	settings.PassThroughRequestEnabled = false
	info.ChannelSetting.PassThroughBodyEnabled = true
	require.False(t, shouldPassThroughTextRequest(info))

	// 挡板只管 chat：Grok 渠道走 Responses 端点本身就该透传，别挡错面。
	settings.PassThroughRequestEnabled = true
	info.RelayMode = relayconstant.RelayModeResponses
	info.ChannelSetting.PassThroughBodyEnabled = false
	require.True(t, shouldPassThroughTextRequest(info))

	// 对照：Codex chat 同样被挡（镜像确认既有行为）。
	codexInfo := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeCodex,
		},
	}
	require.False(t, shouldPassThroughTextRequest(codexInfo))
}
