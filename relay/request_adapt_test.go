package relay

import (
	"encoding/json"
	"strings"
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
	case constant.APITypeVertexAi:
		channelType = constant.ChannelTypeVertexAi
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

func TestApplyInboundDefaultsGeminiThinkingUsesProviderType(t *testing.T) {
	geminiReq := &dto.GeminiChatRequest{}
	geminiInfo := testRelayInfo(constant.APITypeGemini, "gemini-3.7-flash")
	geminiInfo.RelayFormat = types.RelayFormatGemini
	applyInboundDefaults(geminiInfo, geminiReq)
	if geminiReq.GenerationConfig.ThinkingConfig == nil {
		t.Fatal("Gemini provider should receive Gemini-native thinking defaults")
	}

	xaiReq := &dto.GeminiChatRequest{}
	xaiInfo := testRelayInfo(constant.APITypeXai, "gemini-3.7-flash")
	xaiInfo.RelayFormat = types.RelayFormatGemini
	applyInboundDefaults(xaiInfo, xaiReq)
	if xaiReq.GenerationConfig.ThinkingConfig != nil {
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
	info := testRelayInfo(constant.APITypeOpenAI, "glm-test")
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

func TestConvertRequestToChannelNativeOpenAIGPTDefaultsToResponses(t *testing.T) {
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
	switch got.(type) {
	case *dto.OpenAIResponsesRequest, dto.OpenAIResponsesRequest:
	default:
		t.Fatalf("got %T", got)
	}
	if info.GetFinalRequestRelayFormat() != types.RelayFormatOpenAIResponses {
		t.Fatalf("final format=%s", info.GetFinalRequestRelayFormat())
	}
}

func TestConvertRequestToChannelNativeGLMResponsesUsesChat(t *testing.T) {
	info := testRelayInfo(constant.APITypeOpenAI, "glm-5.2")
	info.RelayFormat = types.RelayFormatOpenAIResponses
	adaptor := GetAdaptor(constant.APITypeOpenAI)
	adaptor.Init(info)

	got, err := convertRequestToChannelNative(nil, info, adaptor, &dto.OpenAIResponsesRequest{
		Model: "glm-5.2",
		Input: []byte(`[{"role":"user","content":"hello"}]`),
	})
	if err != nil {
		t.Fatal(err)
	}
	chatReq, ok := got.(*dto.GeneralOpenAIRequest)
	if !ok {
		t.Fatalf("got %T", got)
	}
	if len(chatReq.Messages) != 1 || chatReq.Messages[0].StringContent() != "hello" {
		t.Fatalf("messages=%#v", chatReq.Messages)
	}
	if info.GetFinalRequestRelayFormat() != types.RelayFormatOpenAI {
		t.Fatalf("final format=%s", info.GetFinalRequestRelayFormat())
	}
}

func TestConvertRequestToChannelNativeClaudeToGemini(t *testing.T) {
	info := testRelayInfo(constant.APITypeGemini, "gemini-3.7-flash")
	adaptor := GetAdaptor(constant.APITypeGemini)
	adaptor.Init(info)

	maxTokens := uint(1024)
	got, err := convertRequestToChannelNative(nil, info, adaptor, &dto.ClaudeRequest{
		Model:     "gemini-3.7-flash",
		MaxTokens: &maxTokens,
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hi"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	req, ok := got.(*dto.GeminiChatRequest)
	if !ok {
		t.Fatalf("got %T", got)
	}
	if len(req.Contents) == 0 || req.Contents[0].Role != "user" {
		t.Fatalf("contents=%#v", req.Contents)
	}
	if info.GetFinalRequestRelayFormat() != types.RelayFormatGemini {
		t.Fatalf("final format=%s", info.GetFinalRequestRelayFormat())
	}
}

func TestConvertRequestToChannelNativeClaudeToVertexGemini(t *testing.T) {
	info := testRelayInfo(constant.APITypeVertexAi, "gemini-3.7-flash")
	adaptor := GetAdaptor(constant.APITypeVertexAi)
	adaptor.Init(info)

	maxTokens := uint(1024)
	got, err := convertRequestToChannelNative(nil, info, adaptor, &dto.ClaudeRequest{
		Model:     "gemini-3.7-flash",
		MaxTokens: &maxTokens,
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hi"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := got.(*dto.GeminiChatRequest); !ok {
		t.Fatalf("got %T", got)
	}
	if info.GetFinalRequestRelayFormat() != types.RelayFormatGemini {
		t.Fatalf("final format=%s", info.GetFinalRequestRelayFormat())
	}
}

func TestConvertRequestToChannelNativeClaudeThinkingMatchesGeminiCapability(t *testing.T) {
	budget := 2048
	tests := []struct {
		name       string
		apiType    int
		model      string
		effort     string
		wantBudget *int
		wantLevel  string
	}{
		{
			name:      "Gemini 3 budget becomes high level",
			apiType:   constant.APITypeGemini,
			model:     "gemini-3.7-flash",
			wantLevel: "HIGH",
		},
		{
			name:      "Vertex publisher prefix keeps level capability",
			apiType:   constant.APITypeVertexAi,
			model:     "google/gemini-3.7-flash",
			wantLevel: "HIGH",
		},
		{
			name:      "Gemini 3 explicit effort wins over budget",
			apiType:   constant.APITypeGemini,
			model:     "gemini-3.7-flash",
			effort:    "medium",
			wantLevel: "MEDIUM",
		},
		{
			name:       "Gemini 2.5 preserves budget",
			apiType:    constant.APITypeGemini,
			model:      "gemini-2.5-flash",
			wantBudget: &budget,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := testRelayInfo(tt.apiType, tt.model)
			adaptor := GetAdaptor(tt.apiType)
			adaptor.Init(info)
			request := &dto.ClaudeRequest{
				Model:    "client-model",
				Messages: []dto.ClaudeMessage{{Role: "user", Content: "think"}},
				Thinking: &dto.Thinking{Type: "enabled", BudgetTokens: &budget},
			}
			if tt.effort != "" {
				request.OutputConfig = json.RawMessage(`{"effort":"` + tt.effort + `"}`)
			}

			got, err := convertRequestToChannelNative(nil, info, adaptor, request)
			if err != nil {
				t.Fatal(err)
			}
			geminiRequest, ok := got.(*dto.GeminiChatRequest)
			if !ok {
				t.Fatalf("got %T", got)
			}
			thinking := geminiRequest.GenerationConfig.ThinkingConfig
			if thinking == nil || !thinking.IncludeThoughts {
				t.Fatalf("thinkingConfig=%#v", thinking)
			}
			if thinking.ThinkingLevel != tt.wantLevel {
				t.Fatalf("thinkingLevel=%q want %q", thinking.ThinkingLevel, tt.wantLevel)
			}
			if tt.wantBudget == nil {
				if thinking.ThinkingBudget != nil {
					t.Fatalf("thinkingBudget=%d should be omitted", *thinking.ThinkingBudget)
				}
			} else if thinking.ThinkingBudget == nil || *thinking.ThinkingBudget != *tt.wantBudget {
				t.Fatalf("thinkingBudget=%v want %d", thinking.ThinkingBudget, *tt.wantBudget)
			}
			if thinking.ThinkingBudget != nil && thinking.ThinkingLevel != "" {
				t.Fatalf("thinking controls conflict: %#v", thinking)
			}
			if info.GetFinalRequestRelayFormat() != types.RelayFormatGemini {
				t.Fatalf("final format=%s", info.GetFinalRequestRelayFormat())
			}
		})
	}
}

func TestConvertRequestToChannelNativeUpgradeUsesResponses(t *testing.T) {
	info := testRelayInfo(constant.APITypeOpenAI, "gpt-5")
	info.RelayFormat = types.RelayFormatOpenAI
	info.BuildTextPlan(types.RelayFormatOpenAIResponses)
	adaptor := GetAdaptor(constant.APITypeOpenAI)
	adaptor.Init(info)

	got, err := convertRequestToChannelNative(nil, info, adaptor, &dto.GeneralOpenAIRequest{
		Model:    "gpt-5",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	switch got.(type) {
	case *dto.OpenAIResponsesRequest, dto.OpenAIResponsesRequest:
	default:
		t.Fatalf("got %T", got)
	}
	if info.GetFinalRequestRelayFormat() != types.RelayFormatOpenAIResponses {
		t.Fatalf("final format=%s", info.GetFinalRequestRelayFormat())
	}
}

func TestOpenAIAdaptorRejectsForeignClaudeConvert(t *testing.T) {
	info := testRelayInfo(constant.APITypeOpenAI, "gpt-4o")
	adaptor := GetAdaptor(constant.APITypeOpenAI)
	adaptor.Init(info)

	_, err := adaptor.ConvertClaudeRequest(nil, info, &dto.ClaudeRequest{
		Model: "gpt-4o",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hi"},
		},
	})
	if err == nil {
		t.Fatal("expected leftover ConvertClaudeRequest to fail")
	}
	if got, want := err.Error(), "ConvertRequestToChannelNative"; !strings.Contains(got, want) {
		t.Fatalf("err=%q want substring %q", got, want)
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
