package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func testRelayInfo(apiType int, model string) *relaycommon.RelayInfo {
	channelType := constant.ChannelTypeUnknown
	switch apiType {
	case constant.APITypeOpenAI:
		channelType = constant.ChannelTypeOpenAI
	case constant.APITypeAnthropic:
		channelType = constant.ChannelTypeAnthropic
	case constant.APITypeGemini:
		channelType = constant.ChannelTypeGemini
	case constant.APITypeDeepSeek:
		channelType = constant.ChannelTypeDeepSeek
	case constant.APITypeXai:
		channelType = constant.ChannelTypeXai
	case constant.APITypeNewAPI:
		channelType = constant.ChannelTypeNewAPI
	}
	return &relaycommon.RelayInfo{
		OriginModelName: model,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       channelType,
			ApiType:           apiType,
			UpstreamModelName: model,
		},
	}
}

func TestShouldApplyGeminiNativeThinkingConfigUsesProviderType(t *testing.T) {
	request := &dto.GeminiChatRequest{}

	geminiInfo := testRelayInfo(constant.APITypeGemini, "gemini-3.7-flash")
	if !shouldApplyGeminiNativeThinkingConfig(geminiInfo, request, false) {
		t.Fatal("Gemini provider should receive Gemini-native thinking defaults")
	}

	xaiInfo := testRelayInfo(constant.APITypeXai, "gemini-3.7-flash")
	if shouldApplyGeminiNativeThinkingConfig(xaiInfo, request, false) {
		t.Fatal("xAI provider must not receive Gemini-native thinking defaults based on model name")
	}
}

func TestConvertRequestToChannelNativeChatToGeminiIncludesThoughts(t *testing.T) {
	info := testRelayInfo(constant.APITypeGemini, "gemini-3.7-flash")
	adaptor := GetAdaptor(constant.APITypeGemini)
	adaptor.Init(info)

	got, err := convertRequestToChannelNative(nil, info, adaptor, &dto.GeneralOpenAIRequest{
		Model:    "gemini-3.7-flash",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	req, ok := got.(*dto.GeminiChatRequest)
	if !ok {
		t.Fatalf("got %T", got)
	}
	if req.GenerationConfig.ThinkingConfig == nil || !req.GenerationConfig.ThinkingConfig.IncludeThoughts {
		t.Fatalf("expected includeThoughts, got %#v", req.GenerationConfig.ThinkingConfig)
	}
	if info.GetFinalRequestRelayFormat() != types.RelayFormatGemini {
		t.Fatalf("final format=%s", info.GetFinalRequestRelayFormat())
	}
}

func TestConvertRequestToChannelNativeGeminiToChat(t *testing.T) {
	info := testRelayInfo(constant.APITypeOpenAI, "gpt-test")
	adaptor := GetAdaptor(constant.APITypeOpenAI)
	adaptor.Init(info)

	include := true
	got, err := convertRequestToChannelNative(nil, info, adaptor, &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: "hi"}}},
			{Role: "model", Parts: []dto.GeminiPart{{Text: "thinking", Thought: true}, {Text: "hello"}}},
		},
		GenerationConfig: dto.GeminiChatGenerationConfig{
			ThinkingConfig: &dto.GeminiThinkingConfig{IncludeThoughts: include, ThinkingLevel: "high"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	req, ok := got.(*dto.GeneralOpenAIRequest)
	if !ok {
		t.Fatalf("got %T", got)
	}
	if req.ReasoningEffort != "high" {
		t.Fatalf("reasoning_effort=%q", req.ReasoningEffort)
	}
	if len(req.Messages) < 2 || req.Messages[1].GetReasoningContent() != "thinking" {
		t.Fatalf("messages=%#v", req.Messages)
	}
}

func TestConvertRequestToChannelNativeOpenAIChatStaysChat(t *testing.T) {
	info := testRelayInfo(constant.APITypeOpenAI, "gpt-4o")
	adaptor := GetAdaptor(constant.APITypeOpenAI)
	adaptor.Init(info)

	in := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
	}
	got, err := convertRequestToChannelNative(nil, info, adaptor, in)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := got.(*dto.GeneralOpenAIRequest); !ok {
		t.Fatalf("got %T", got)
	}
	if info.GetFinalRequestRelayFormat() != types.RelayFormatOpenAI {
		t.Fatalf("final format=%s", info.GetFinalRequestRelayFormat())
	}
}

func TestConvertRequestToChannelNativeResponsesToClaude(t *testing.T) {
	info := testRelayInfo(constant.APITypeAnthropic, "claude-sonnet-4")
	adaptor := GetAdaptor(constant.APITypeAnthropic)
	adaptor.Init(info)

	got, err := convertRequestToChannelNative(nil, info, adaptor, &dto.OpenAIResponsesRequest{
		Model: "claude-sonnet-4",
		Input: []byte(`"hello"`),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := got.(*dto.ClaudeRequest); !ok {
		t.Fatalf("got %T", got)
	}
}
