package relay

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/require"
)

func TestShouldPassThroughResponsesRequest_BlockRunBridgeForcesConvert(t *testing.T) {
	original := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	defer func() {
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = original
	}()

	model_setting.GetGlobalSettings().PassThroughRequestEnabled = true
	if shouldPassThroughResponsesRequest(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType:        constant.APITypeBlockRun,
			ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}) {
		t.Fatalf("blockrun responses bridge must not pass through raw Responses body to chat-completions upstream")
	}
}

func TestShouldPassThroughResponsesRequest_OpenAIHonorsPassThrough(t *testing.T) {
	original := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	defer func() {
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = original
	}()

	model_setting.GetGlobalSettings().PassThroughRequestEnabled = true
	if !shouldPassThroughResponsesRequest(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeOpenAI,
		},
	}) {
		t.Fatalf("openai responses should honor global pass-through")
	}

	model_setting.GetGlobalSettings().PassThroughRequestEnabled = false
	if !shouldPassThroughResponsesRequest(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType:        constant.APITypeOpenAI,
			ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}) {
		t.Fatalf("openai responses should honor channel pass-through")
	}
}

func TestNormalizeOpenAIResponsesRequestPropagatesCompactFields(t *testing.T) {
	temperature := 0.0
	topP := 0.0
	maxOutputTokens := uint(0)
	maxToolCalls := uint(0)
	topLogProbs := 0
	reasoning := &dto.Reasoning{
		Mode:    json.RawMessage(`"extended"`),
		Context: json.RawMessage(`{"turn_id":"turn_1"}`),
	}
	compact := &dto.OpenAIResponsesCompactionRequest{
		Model:                "gpt-5.6-sol",
		Input:                json.RawMessage(`"hello"`),
		Conversation:         json.RawMessage(`{"id":"conv_1"}`),
		ContextManagement:    json.RawMessage(`{"type":"compaction"}`),
		Instructions:         json.RawMessage(`"be concise"`),
		MaxOutputTokens:      &maxOutputTokens,
		TopLogProbs:          &topLogProbs,
		PreviousResponseID:   "resp_1",
		Tools:                json.RawMessage(`[{"type":"function","name":"lookup"}]`),
		ToolChoice:           json.RawMessage(`{"type":"function","name":"lookup"}`),
		ParallelToolCalls:    json.RawMessage(`false`),
		Reasoning:            reasoning,
		ServiceTier:          "priority",
		PromptCacheKey:       json.RawMessage(`"cache-key"`),
		PromptCacheOptions:   json.RawMessage(`{"mode":"explicit","ttl":"30m"}`),
		PromptCacheRetention: json.RawMessage(`"24h"`),
		Text:                 json.RawMessage(`{"format":{"type":"text"}}`),
		Temperature:          &temperature,
		TopP:                 &topP,
		Truncation:           json.RawMessage(`"auto"`),
		MaxToolCalls:         &maxToolCalls,
		ClientMetadata:       json.RawMessage(`{"client_version":"1.2.3"}`),
	}

	request, err := normalizeOpenAIResponsesRequest(compact)
	require.NoError(t, err)
	require.Equal(t, compact.Model, request.Model)
	require.JSONEq(t, string(compact.Conversation), string(request.Conversation))
	require.JSONEq(t, string(compact.ContextManagement), string(request.ContextManagement))
	require.JSONEq(t, string(compact.Tools), string(request.Tools))
	require.JSONEq(t, string(compact.ToolChoice), string(request.ToolChoice))
	require.JSONEq(t, string(compact.ParallelToolCalls), string(request.ParallelToolCalls))
	require.Same(t, reasoning, request.Reasoning)
	require.Equal(t, compact.ServiceTier, request.ServiceTier)
	require.JSONEq(t, string(compact.PromptCacheKey), string(request.PromptCacheKey))
	require.JSONEq(t, string(compact.PromptCacheOptions), string(request.PromptCacheOptions))
	require.JSONEq(t, string(compact.PromptCacheRetention), string(request.PromptCacheRetention))
	require.JSONEq(t, string(compact.Text), string(request.Text))
	require.Same(t, compact.Temperature, request.Temperature)
	require.Same(t, compact.TopP, request.TopP)
	require.Same(t, compact.MaxOutputTokens, request.MaxOutputTokens)
	require.Same(t, compact.MaxToolCalls, request.MaxToolCalls)
	require.Same(t, compact.TopLogProbs, request.TopLogProbs)
	require.JSONEq(t, string(compact.Truncation), string(request.Truncation))
	require.JSONEq(t, string(compact.ClientMetadata), string(request.ClientMetadata))
}

func TestNormalizeOpenAIResponsesRequestRejectsUnexpectedType(t *testing.T) {
	request, err := normalizeOpenAIResponsesRequest(struct{}{})
	require.Nil(t, request)
	require.ErrorContains(t, err, "invalid request type")
}
