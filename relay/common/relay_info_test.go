package common

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestResponsesUsageInfoRecordToolCall(t *testing.T) {
	t.Run("matches declared generic tools", func(t *testing.T) {
		usageInfo := &ResponsesUsageInfo{BuiltInTools: map[string]*BuildInToolInfo{
			"web_search":       {ToolName: "web_search"},
			"code_interpreter": {ToolName: "code_interpreter"},
		}}

		require.True(t, usageInfo.RecordToolCall("web_search_call"))
		require.True(t, usageInfo.RecordToolCall("code_interpreter_call"))
		require.Equal(t, 1, usageInfo.BuiltInTools["web_search"].CallCount)
		require.Equal(t, 1, usageInfo.BuiltInTools["code_interpreter"].CallCount)
	})

	t.Run("uses preview fallback only when web search is absent", func(t *testing.T) {
		usageInfo := &ResponsesUsageInfo{BuiltInTools: map[string]*BuildInToolInfo{
			dto.BuildInToolWebSearchPreview: {ToolName: dto.BuildInToolWebSearchPreview},
		}}

		require.True(t, usageInfo.RecordToolCall(dto.BuildInCallWebSearchCall))
		require.Equal(t, 1, usageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview].CallCount)
	})

	t.Run("does not bill special image generation through generic pricing", func(t *testing.T) {
		usageInfo := &ResponsesUsageInfo{BuiltInTools: map[string]*BuildInToolInfo{
			"image_generation": {ToolName: "image_generation"},
		}}

		require.False(t, usageInfo.RecordToolCall(dto.ResponsesOutputTypeImageGenerationCall))
		require.Zero(t, usageInfo.BuiltInTools["image_generation"].CallCount)
	})

	t.Run("provider usage replaces provisional output count for the current request", func(t *testing.T) {
		usageInfo := &ResponsesUsageInfo{BuiltInTools: map[string]*BuildInToolInfo{
			"web_search": {ToolName: "web_search", CallCount: 2},
		}}

		usageInfo.RecordCurrentToolUsage(map[string]int{
			"web_search": 1,
			"toutiao":    9,
		})

		require.Equal(t, 1, usageInfo.BuiltInTools["web_search"].CallCount)

		usageInfo.RecordCurrentToolUsage(map[string]int{"web_search": 0})
		require.Zero(t, usageInfo.BuiltInTools["web_search"].CallCount)
	})
}

func TestRelayInfoGetFinalRequestRelayFormatPrefersExplicitFinal(t *testing.T) {
	info := &RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		RequestConversionChain:  []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
		FinalRequestRelayFormat: types.RelayFormatOpenAIResponses,
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatOpenAIResponses), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatFallsBackToConversionChain(t *testing.T) {
	info := &RelayInfo{
		RelayFormat:            types.RelayFormatOpenAI,
		RequestConversionChain: []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatClaude), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatFallsBackToRelayFormat(t *testing.T) {
	info := &RelayInfo{
		RelayFormat: types.RelayFormatGemini,
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatGemini), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatNilReceiver(t *testing.T) {
	var info *RelayInfo
	require.Equal(t, types.RelayFormat(""), info.GetFinalRequestRelayFormat())
}
