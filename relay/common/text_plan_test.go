package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func planInfo(channelType, apiType int, model string, client types.RelayFormat, mode int) *RelayInfo {
	return &RelayInfo{
		RelayFormat:     client,
		RelayMode:       mode,
		OriginModelName: model,
		ChannelMeta: &ChannelMeta{
			ChannelType:       channelType,
			ApiType:           apiType,
			UpstreamModelName: model,
			ChannelBaseUrl:    "https://example.invalid",
		},
	}
}

func TestBuildTextPlanClaudeClientXAIUsesChatPath(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeXai, constant.APITypeXai, "grok-4.6", types.RelayFormatClaude, relayconstant.RelayModeUnknown)
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatOpenAI {
		t.Fatalf("native=%s", plan.Native)
	}
	path, ok := info.OpenAICompatibleRequestPath()
	if !ok || path != "/v1/chat/completions" {
		t.Fatalf("path=%q ok=%v", path, ok)
	}
	if info.RelayMode != relayconstant.RelayModeUnknown {
		t.Fatalf("RelayMode rewritten: %d", info.RelayMode)
	}
}

func TestBuildTextPlanChatClientGeminiStaysGemini(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeGemini, constant.APITypeGemini, "gemini-3.7-flash", types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatGemini {
		t.Fatalf("native=%s", plan.Native)
	}
	if _, ok := info.OpenAICompatibleRequestPath(); ok {
		t.Fatal("gemini outbound is not an OpenAI-compatible path")
	}
}

func TestBuildTextPlanResponsesClientDeepSeekUsesChat(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeDeepSeek, constant.APITypeDeepSeek, "deepseek-chat", types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses)
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatOpenAI {
		t.Fatalf("native=%s", plan.Native)
	}
	path, ok := info.OpenAICompatibleRequestPath()
	if !ok || path != "/v1/chat/completions" {
		t.Fatalf("path=%q ok=%v", path, ok)
	}
}

func TestBuildTextPlanResponsesClientOpenAICompatibleGLMUsesChat(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeOpenAI, constant.APITypeOpenAI, "glm-5.2", types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses)
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatOpenAI {
		t.Fatalf("native=%s", plan.Native)
	}
	path, ok := info.OpenAICompatibleRequestPath()
	if !ok || path != "/v1/chat/completions" {
		t.Fatalf("path=%q ok=%v", path, ok)
	}
}

func TestBuildTextPlanResponsesClientGPT56UsesResponses(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeOpenAI, constant.APITypeOpenAI, "gpt-5.6-sol", types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses)
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatOpenAIResponses {
		t.Fatalf("native=%s", plan.Native)
	}
	path, ok := info.OpenAICompatibleRequestPath()
	if !ok || path != "/v1/responses" {
		t.Fatalf("path=%q ok=%v", path, ok)
	}
}

func TestBuildTextPlanUpgradeChangesNativeNotRelayMode(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeOpenAI, constant.APITypeOpenAI, "gpt-5", types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	plan := info.BuildTextPlan(true)
	if plan.Native != types.RelayFormatOpenAIResponses {
		t.Fatalf("native=%s", plan.Native)
	}
	if info.RelayMode != relayconstant.RelayModeChatCompletions {
		t.Fatalf("RelayMode rewritten: %d", info.RelayMode)
	}
	path, ok := info.OpenAICompatibleRequestPath()
	if !ok || path != "/v1/responses" {
		t.Fatalf("path=%q ok=%v", path, ok)
	}
	if info.GetFinalRequestRelayFormat() != types.RelayFormatOpenAIResponses {
		t.Fatalf("final=%s", info.GetFinalRequestRelayFormat())
	}
}

func TestBuildTextPlanVertexFollowsModelFamily(t *testing.T) {
	t.Parallel()
	gemini := planInfo(constant.ChannelTypeVertexAi, constant.APITypeVertexAi, "gemini-3.7-flash", types.RelayFormatClaude, relayconstant.RelayModeUnknown)
	if gemini.BuildTextPlan(false).Native != types.RelayFormatGemini {
		t.Fatalf("vertex gemini native=%s", gemini.TextNative())
	}
	claude := planInfo(constant.ChannelTypeVertexAi, constant.APITypeVertexAi, "claude-sonnet-4", types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	if claude.BuildTextPlan(false).Native != types.RelayFormatClaude {
		t.Fatalf("vertex claude native=%s", claude.TextNative())
	}
}

func TestBuildTextPlanCodexIsResponses(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeCodex, constant.APITypeCodex, "gpt-5", types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatOpenAIResponses {
		t.Fatalf("native=%s", plan.Native)
	}
}

func TestBuildTextPlanAdvancedCustomTargetOverridesNative(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeAdvancedCustom, constant.APITypeAdvancedCustom, "gpt-test", types.RelayFormatClaude, relayconstant.RelayModeUnknown)
	info.RequestURLPath = "/v1/messages"
	info.ChannelOtherSettings = dto.ChannelOtherSettings{
		AdvancedCustom: &dto.AdvancedCustomConfig{
			Routes: []dto.AdvancedCustomRoute{{
				IncomingPath: "/v1/messages",
				UpstreamPath: "/v1/chat/completions",
				Target:       dto.AdvancedCustomTargetChat,
			}},
		},
	}
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatOpenAI {
		t.Fatalf("native=%s", plan.Native)
	}
	if info.RelayMode != relayconstant.RelayModeUnknown {
		t.Fatalf("RelayMode rewritten: %d", info.RelayMode)
	}
}

func TestBuildTextPlanAdvancedCustomLegacyConverterMapsToTarget(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeAdvancedCustom, constant.APITypeAdvancedCustom, "gpt-test", types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	info.RequestURLPath = "/v1/chat/completions"
	info.ChannelOtherSettings = dto.ChannelOtherSettings{
		AdvancedCustom: &dto.AdvancedCustomConfig{
			Routes: []dto.AdvancedCustomRoute{{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "/v1/messages",
				Converter:    "openai_chat_completions_to_anthropic_messages",
			}},
		},
	}
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatClaude {
		t.Fatalf("native=%s", plan.Native)
	}
}

func TestBuildTextPlanAliClaudeClientUsesClaudePath(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeAli, constant.APITypeAli, "qwen-plus", types.RelayFormatClaude, relayconstant.RelayModeUnknown)
	info.ChannelBaseUrl = "https://dashscope.aliyuncs.com"
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatClaude {
		t.Fatalf("native=%s", plan.Native)
	}
}

func TestBuildTextPlanAliClaudeClientNonClaudeModelUsesChat(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeAli, constant.APITypeAli, "deepseek-r1", types.RelayFormatClaude, relayconstant.RelayModeUnknown)
	plan := info.BuildTextPlan(false)
	if plan.Native != types.RelayFormatOpenAI {
		t.Fatalf("native=%s", plan.Native)
	}
}

func TestTextNativeFallsBackWithoutPlan(t *testing.T) {
	t.Parallel()
	info := planInfo(constant.ChannelTypeGemini, constant.APITypeGemini, "gemini-3.7-flash", types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	if info.TextNative() != types.RelayFormatGemini {
		t.Fatalf("fallback native=%s", info.TextNative())
	}
}
