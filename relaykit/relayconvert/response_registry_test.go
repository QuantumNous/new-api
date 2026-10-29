package relayconvert

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLookupBuiltinResponseConverters(t *testing.T) {
	tests := []struct {
		lookupID       string
		id             string
		from           types.RelayFormat
		to             types.RelayFormat
		quality        ResponseConverterQuality
		stepConverters []string
	}{
		{lookupID: ResponseConverterOAIChatToOAIResponses, id: ConverterOpenAIChatToOpenAIResponses, from: types.RelayFormatOpenAI, to: types.RelayFormatOpenAIResponses, quality: ResponseConverterQualityGood},
		{lookupID: ResponseConverterOAIResponsesToOAIChat, id: ConverterOpenAIResponsesToOpenAIChat, from: types.RelayFormatOpenAIResponses, to: types.RelayFormatOpenAI, quality: ResponseConverterQualityGood},
		{lookupID: ResponseConverterOAIChatToClaudeMessages, id: ConverterOpenAIChatToClaudeMessages, from: types.RelayFormatOpenAI, to: types.RelayFormatClaude, quality: ResponseConverterQualityFair},
		{lookupID: ResponseConverterOAIChatToGeminiChat, id: ConverterOpenAIChatToGeminiContent, from: types.RelayFormatOpenAI, to: types.RelayFormatGemini, quality: ResponseConverterQualityFair},
		{lookupID: ResponseConverterClaudeMessagesToOAIChat, id: ConverterClaudeMessagesToOpenAIChat, from: types.RelayFormatClaude, to: types.RelayFormatOpenAI, quality: ResponseConverterQualityFair},
		{lookupID: ResponseConverterGeminiChatToOAIChat, id: ConverterGeminiContentToOpenAIChat, from: types.RelayFormatGemini, to: types.RelayFormatOpenAI, quality: ResponseConverterQualityFair},
		{
			lookupID: responseConverterClaudeToGemini,
			id:       requestConverterClaudeToGemini,
			from:     types.RelayFormatClaude,
			to:       types.RelayFormatGemini,
			quality:  ResponseConverterQualityDiscouraged,
			stepConverters: []string{
				ConverterClaudeMessagesToOpenAIChat,
				ConverterOpenAIChatToGeminiContent,
			},
		},
		{
			lookupID: responseConverterClaudeToResponses,
			id:       requestConverterClaudeToResponses,
			from:     types.RelayFormatClaude,
			to:       types.RelayFormatOpenAIResponses,
			quality:  ResponseConverterQualityFair,
			stepConverters: []string{
				ConverterClaudeMessagesToOpenAIChat,
				ConverterOpenAIChatToOpenAIResponses,
			},
		},
		{
			lookupID: responseConverterGeminiToClaude,
			id:       requestConverterGeminiToClaude,
			from:     types.RelayFormatGemini,
			to:       types.RelayFormatClaude,
			quality:  ResponseConverterQualityDiscouraged,
			stepConverters: []string{
				ConverterGeminiContentToOpenAIChat,
				ConverterOpenAIChatToClaudeMessages,
			},
		},
		{
			lookupID: responseConverterGeminiToResponses,
			id:       requestConverterGeminiToResponses,
			from:     types.RelayFormatGemini,
			to:       types.RelayFormatOpenAIResponses,
			quality:  ResponseConverterQualityFair,
			stepConverters: []string{
				ConverterGeminiContentToOpenAIChat,
				ConverterOpenAIChatToOpenAIResponses,
			},
		},
		{
			lookupID: responseConverterResponsesToClaude,
			id:       requestConverterResponsesToClaude,
			from:     types.RelayFormatOpenAIResponses,
			to:       types.RelayFormatClaude,
			quality:  ResponseConverterQualityFair,
		},
		{
			lookupID: responseConverterResponsesToGemini,
			id:       ConverterOpenAIResponsesToGemini,
			from:     types.RelayFormatOpenAIResponses,
			to:       types.RelayFormatGemini,
			quality:  ResponseConverterQualityFair,
			stepConverters: []string{
				ConverterOpenAIResponsesToOpenAIChat,
				ConverterOpenAIChatToGeminiContent,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.lookupID, func(t *testing.T) {
			spec, ok := LookupResponseConverter(tt.lookupID)
			require.True(t, ok)
			assert.Equal(t, tt.id, spec.ID)
			assert.Equal(t, tt.from, spec.From)
			assert.Equal(t, tt.to, spec.To)
			assert.Equal(t, tt.quality, spec.Quality)
			assert.Equal(t, tt.stepConverters, spec.StepConverters)
			if len(tt.stepConverters) == 0 {
				assert.NotNil(t, spec.Convert)
			} else {
				assert.Nil(t, spec.Convert)
			}
		})
	}

	_, ok := LookupResponseConverter("missing")
	assert.False(t, ok)
}

func TestConvertResponseRejectsNilAndUnsupportedRoute(t *testing.T) {
	_, err := ConvertResponse(nil, nil, types.RelayFormatOpenAI, (*dto.OpenAITextResponse)(nil))
	require.Error(t, err)

	_, err = ConvertResponse(nil, nil, types.RelayFormatEmbedding, &dto.OpenAITextResponse{})
	require.Error(t, err)
}

func TestConvertResponseDirectConverters(t *testing.T) {
	chat := textRegistryChatResponse()
	info := &convmeta.Values{ChannelMetaAttached: true, UpstreamModelName: "gemini-test"}

	toResponses, err := ConvertResponse(nil, info, types.RelayFormatOpenAIResponses, chat)
	require.NoError(t, err)
	assert.Equal(t, ConverterOpenAIChatToOpenAIResponses, toResponses.Converter)
	assert.Equal(t, ResponseConverterQualityGood, toResponses.Quality)
	assert.Equal(t, types.RelayFormatOpenAI, toResponses.From)
	assert.Equal(t, types.RelayFormat(types.RelayFormatOpenAIResponses), toResponses.To)
	assert.Equal(t, []ResponseStep{{Converter: ConverterOpenAIChatToOpenAIResponses, From: types.RelayFormatOpenAI, To: types.RelayFormatOpenAIResponses}}, toResponses.Steps)
	require.IsType(t, &dto.OpenAIResponsesResponse{}, toResponses.Value)
	assert.Equal(t, 9, toResponses.Usage.TotalTokens)
	require.NotNil(t, toResponses.Usage.BillingUsage)
	require.NotNil(t, toResponses.Usage.BillingUsage.OpenAIUsage)
	assert.Equal(t, dto.BillingUsageSourceOAIChat, toResponses.Usage.BillingUsage.Source)
	assert.Equal(t, 4, toResponses.Usage.BillingUsage.OpenAIUsage.PromptTokens)

	responses := &dto.OpenAIResponsesResponse{
		ID:        "resp_1",
		CreatedAt: 123,
		Model:     "gpt-test",
		Status:    []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{
				Type: "message",
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: "hello"},
				},
			},
		},
		Usage: &dto.Usage{InputTokens: 4, OutputTokens: 6, TotalTokens: 10},
	}
	toChat, err := ConvertResponse(nil, info, types.RelayFormatOpenAI, responses)
	require.NoError(t, err)
	assert.Equal(t, ConverterOpenAIResponsesToOpenAIChat, toChat.Converter)
	assert.Equal(t, ResponseConverterQualityGood, toChat.Quality)
	require.IsType(t, &dto.OpenAITextResponse{}, toChat.Value)
	assert.Equal(t, 10, toChat.Usage.TotalTokens)
	require.NotNil(t, toChat.Usage.BillingUsage)
	require.NotNil(t, toChat.Usage.BillingUsage.OpenAIUsage)
	assert.Equal(t, dto.BillingUsageSourceOAIResponses, toChat.Usage.BillingUsage.Source)
	assert.Equal(t, 4, toChat.Usage.BillingUsage.OpenAIUsage.InputTokens)

	toClaude, err := ConvertResponse(nil, info, types.RelayFormatClaude, chat)
	require.NoError(t, err)
	assert.Equal(t, ConverterOpenAIChatToClaudeMessages, toClaude.Converter)
	assert.Equal(t, ResponseConverterQualityFair, toClaude.Quality)
	require.IsType(t, &dto.ClaudeResponse{}, toClaude.Value)
	assert.Equal(t, 9, toClaude.Usage.TotalTokens)
	require.NotNil(t, toClaude.Usage.BillingUsage)
	require.NotNil(t, toClaude.Usage.BillingUsage.OpenAIUsage)
	claudeValue := toClaude.Value.(*dto.ClaudeResponse)
	require.NotNil(t, claudeValue.Usage)
	require.NotNil(t, claudeValue.Usage.BillingUsage)
	require.NotNil(t, claudeValue.Usage.BillingUsage.OpenAIUsage)

	toGemini, err := ConvertResponse(nil, info, types.RelayFormatGemini, chat)
	require.NoError(t, err)
	assert.Equal(t, ConverterOpenAIChatToGeminiContent, toGemini.Converter)
	assert.Equal(t, ResponseConverterQualityFair, toGemini.Quality)
	require.IsType(t, &dto.GeminiChatResponse{}, toGemini.Value)
	assert.Equal(t, 9, toGemini.Usage.TotalTokens)
	require.NotNil(t, toGemini.Usage.BillingUsage)
	require.NotNil(t, toGemini.Usage.BillingUsage.OpenAIUsage)
	geminiValue := toGemini.Value.(*dto.GeminiChatResponse)
	require.NotNil(t, geminiValue.UsageMetadata.BillingUsage)
	require.NotNil(t, geminiValue.UsageMetadata.BillingUsage.OpenAIUsage)
}

func TestConvertResponseDirectAndMultiHopConverters(t *testing.T) {
	responses := textRegistryResponsesResponse()

	toClaude, err := ConvertResponse(nil, &convmeta.Values{}, types.RelayFormatClaude, responses)
	require.NoError(t, err)
	assert.Equal(t, requestConverterResponsesToClaude, toClaude.Converter)
	assert.Equal(t, ResponseConverterQualityFair, toClaude.Quality)
	assert.Equal(t, []ResponseStep{
		{Converter: ConverterOpenAIResponsesToClaudeMessages, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatClaude},
	}, toClaude.Steps)
	require.IsType(t, &dto.ClaudeResponse{}, toClaude.Value)
	claudeValue := toClaude.Value.(*dto.ClaudeResponse)
	require.Len(t, claudeValue.Content, 2)
	assert.Equal(t, "text", claudeValue.Content[0].Type)
	assert.Equal(t, "tool_use", claudeValue.Content[1].Type)
	assert.Equal(t, "lookup", claudeValue.Content[1].Name)
	assert.Equal(t, map[string]any{"q": "x"}, claudeValue.Content[1].Input)
	assert.Equal(t, 11, toClaude.Usage.TotalTokens)

	toGemini, err := ConvertResponse(nil, &convmeta.Values{ChannelMetaAttached: true, UpstreamModelName: "gemini-test"}, types.RelayFormatGemini, responses)
	require.NoError(t, err)
	assert.Equal(t, ConverterOpenAIResponsesToGemini, toGemini.Converter)
	assert.Equal(t, ResponseConverterQualityFair, toGemini.Quality)
	assert.Equal(t, []ResponseStep{
		{Converter: ConverterOpenAIResponsesToOpenAIChat, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatOpenAI},
		{Converter: ConverterOpenAIChatToGeminiContent, From: types.RelayFormatOpenAI, To: types.RelayFormatGemini},
	}, toGemini.Steps)
	require.IsType(t, &dto.GeminiChatResponse{}, toGemini.Value)
	geminiValue := toGemini.Value.(*dto.GeminiChatResponse)
	require.Len(t, geminiValue.Candidates, 1)
	require.Len(t, geminiValue.Candidates[0].Content.Parts, 2)
	assert.Equal(t, "hello", geminiValue.Candidates[0].Content.Parts[0].Text)
	require.NotNil(t, geminiValue.Candidates[0].Content.Parts[1].FunctionCall)
	assert.Equal(t, "lookup", geminiValue.Candidates[0].Content.Parts[1].FunctionCall.FunctionName)
	assert.Equal(t, map[string]any{"q": "x"}, geminiValue.Candidates[0].Content.Parts[1].FunctionCall.Arguments)
	assert.Equal(t, 11, toGemini.Usage.TotalTokens)
}

func TestConvertResponsePreservesInterleavedResponsesBlocksForClaude(t *testing.T) {
	responses := &dto.OpenAIResponsesResponse{
		ID:     "resp_1",
		Model:  "gpt-test",
		Status: []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{Type: "reasoning", Summary: []dto.ResponsesReasoningSummaryPart{{Type: "summary_text", Text: "**Planning file inspection**"}}},
			{Type: "message", Role: "assistant", Content: []dto.ResponsesOutputContent{{Type: "output_text", Text: "I’ll inspect the starter repository."}}},
			{Type: "reasoning", Summary: []dto.ResponsesReasoningSummaryPart{{Type: "summary_text", Text: "**Clarifying environment task requirements**"}}},
			{Type: "message", Role: "assistant", Content: []dto.ResponsesOutputContent{{Type: "output_text", Text: "What would you like me to build?"}}},
		},
	}

	result, err := ConvertResponse(nil, nil, types.RelayFormatClaude, responses)
	require.NoError(t, err)
	assert.Equal(t, []ResponseStep{
		{Converter: ConverterOpenAIResponsesToClaudeMessages, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatClaude},
	}, result.Steps)
	claudeResponse := result.Value.(*dto.ClaudeResponse)
	require.Len(t, claudeResponse.Content, 4)
	assert.Equal(t, []string{"thinking", "text", "thinking", "text"}, []string{
		claudeResponse.Content[0].Type,
		claudeResponse.Content[1].Type,
		claudeResponse.Content[2].Type,
		claudeResponse.Content[3].Type,
	})
	require.NotNil(t, claudeResponse.Content[0].Thinking)
	require.NotNil(t, claudeResponse.Content[2].Thinking)
	assert.Equal(t, "**Planning file inspection**", *claudeResponse.Content[0].Thinking)
	assert.Equal(t, "I’ll inspect the starter repository.", claudeResponse.Content[1].GetText())
	assert.Equal(t, "**Clarifying environment task requirements**", *claudeResponse.Content[2].Thinking)
	assert.Equal(t, "What would you like me to build?", claudeResponse.Content[3].GetText())
}

func TestConvertResponseByIDExecutesMultiHopAndChecksSource(t *testing.T) {
	responses := textRegistryResponsesResponse()

	result, err := ConvertResponseByID(nil, nil, responseConverterResponsesToGemini, responses)
	require.NoError(t, err)
	assert.Equal(t, ConverterOpenAIResponsesToGemini, result.Converter)
	assert.Equal(t, []ResponseStep{
		{Converter: ConverterOpenAIResponsesToOpenAIChat, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatOpenAI},
		{Converter: ConverterOpenAIChatToGeminiContent, From: types.RelayFormatOpenAI, To: types.RelayFormatGemini},
	}, result.Steps)

	_, err = ConvertResponseByID(nil, nil, responseConverterResponsesToGemini, textRegistryChatResponse())
	require.Error(t, err)
}

func TestConvertResponseProviderToOAIChatUsage(t *testing.T) {
	claude := &dto.ClaudeResponse{
		Id:         "msg_1",
		Type:       "message",
		Role:       "assistant",
		Model:      "claude-test",
		StopReason: "end_turn",
		Content: []dto.ClaudeMediaMessage{
			{Type: "tool_use", Id: "toolu_1", Name: "lookup", Input: map[string]any{"q": "x"}},
		},
		Usage: &dto.ClaudeUsage{
			InputTokens:              10,
			CacheReadInputTokens:     3,
			CacheCreationInputTokens: 4,
			OutputTokens:             5,
			CacheCreation: &dto.ClaudeCacheCreationUsage{
				Ephemeral5mInputTokens: 1,
				Ephemeral1hInputTokens: 3,
			},
		},
	}
	toChat, err := ConvertResponse(nil, nil, types.RelayFormatOpenAI, claude)
	require.NoError(t, err)
	assert.Equal(t, ConverterClaudeMessagesToOpenAIChat, toChat.Converter)
	require.IsType(t, &dto.OpenAITextResponse{}, toChat.Value)
	assert.Equal(t, 17, toChat.Usage.PromptTokens)
	assert.Equal(t, 5, toChat.Usage.CompletionTokens)
	assert.Equal(t, 22, toChat.Usage.TotalTokens)
	assert.Equal(t, 3, toChat.Usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 4, toChat.Usage.PromptTokensDetails.CachedCreationTokens)
	assert.Equal(t, 4, toChat.Usage.PromptTokensDetails.CacheWriteTokens)
	require.NotNil(t, toChat.Usage.BillingUsage)
	require.NotNil(t, toChat.Usage.BillingUsage.ClaudeUsage)
	assert.Equal(t, dto.BillingUsageSourceClaudeMessages, toChat.Usage.BillingUsage.Source)
	assert.Equal(t, dto.BillingUsageSemanticAnthropic, toChat.Usage.BillingUsage.Semantic)
	assert.Equal(t, 10, toChat.Usage.BillingUsage.ClaudeUsage.InputTokens)
	assert.Equal(t, 3, toChat.Usage.BillingUsage.ClaudeUsage.CacheReadInputTokens)
	assert.Equal(t, 4, toChat.Usage.BillingUsage.ClaudeUsage.CacheCreationInputTokens)
	assert.Equal(t, 5, toChat.Usage.BillingUsage.ClaudeUsage.OutputTokens)
	chatValue := toChat.Value.(*dto.OpenAITextResponse)
	require.Len(t, chatValue.Choices, 1)
	require.Len(t, chatValue.Choices[0].Message.ParseToolCalls(), 1)
	assert.JSONEq(t, `{"q":"x"}`, chatValue.Choices[0].Message.ParseToolCalls()[0].Function.Arguments)

	gemini := &dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Text: "hello"},
						{FunctionCall: &dto.FunctionCall{FunctionName: "lookup", Arguments: map[string]any{"q": "x"}}},
					},
				},
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:        7,
			ToolUsePromptTokenCount: 2,
			CandidatesTokenCount:    5,
			ThoughtsTokenCount:      3,
			TotalTokenCount:         17,
			CachedContentTokenCount: 4,
			PromptTokensDetails: []dto.GeminiPromptTokensDetails{
				{Modality: "TEXT", TokenCount: 5},
				{Modality: "IMAGE", TokenCount: 1},
			},
			ToolUsePromptTokensDetails: []dto.GeminiPromptTokensDetails{
				{Modality: "AUDIO", TokenCount: 3},
			},
			CandidatesTokensDetails: []dto.GeminiPromptTokensDetails{
				{Modality: "TEXT", TokenCount: 4},
				{Modality: "IMAGE", TokenCount: 1},
			},
		},
	}
	toChat, err = ConvertResponse(nil, &convmeta.Values{ChannelMetaAttached: true, UpstreamModelName: "gemini-test"}, types.RelayFormatOpenAI, gemini)
	require.NoError(t, err)
	assert.Equal(t, ConverterGeminiContentToOpenAIChat, toChat.Converter)
	require.IsType(t, &dto.OpenAITextResponse{}, toChat.Value)
	assert.Equal(t, 9, toChat.Usage.PromptTokens)
	assert.Equal(t, 8, toChat.Usage.CompletionTokens)
	assert.Equal(t, 17, toChat.Usage.TotalTokens)
	assert.Equal(t, 3, toChat.Usage.CompletionTokenDetails.ReasoningTokens)
	assert.Equal(t, 4, toChat.Usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 5, toChat.Usage.PromptTokensDetails.TextTokens)
	assert.Equal(t, 3, toChat.Usage.PromptTokensDetails.AudioTokens)
	assert.Equal(t, 1, toChat.Usage.PromptTokensDetails.ImageTokens)
	assert.Equal(t, 4, toChat.Usage.CompletionTokenDetails.TextTokens)
	assert.Equal(t, 1, toChat.Usage.CompletionTokenDetails.ImageTokens)
	require.NotNil(t, toChat.Usage.BillingUsage)
	require.NotNil(t, toChat.Usage.BillingUsage.GeminiUsageMetadata)
	assert.Equal(t, dto.BillingUsageSourceGeminiChat, toChat.Usage.BillingUsage.Source)
	assert.Equal(t, dto.BillingUsageSemanticGemini, toChat.Usage.BillingUsage.Semantic)
	assert.Equal(t, 7, toChat.Usage.BillingUsage.GeminiUsageMetadata.PromptTokenCount)
	assert.Equal(t, 2, toChat.Usage.BillingUsage.GeminiUsageMetadata.ToolUsePromptTokenCount)
	assert.Equal(t, 17, toChat.Usage.BillingUsage.GeminiUsageMetadata.TotalTokenCount)
}

func TestConvertResponsePreservesBillingUsageAcrossChatResponsesBridge(t *testing.T) {
	chat := textRegistryChatResponse()
	chat.Usage.BillingUsage = dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{
		InputTokens:              10,
		CacheReadInputTokens:     3,
		CacheCreationInputTokens: 4,
		OutputTokens:             5,
	})

	toResponses, err := ConvertResponse(nil, nil, types.RelayFormatOpenAIResponses, chat)
	require.NoError(t, err)
	require.NotNil(t, toResponses.Usage.BillingUsage)
	require.NotNil(t, toResponses.Usage.BillingUsage.ClaudeUsage)
	assert.Equal(t, 10, toResponses.Usage.BillingUsage.ClaudeUsage.InputTokens)

	responsesValue := toResponses.Value.(*dto.OpenAIResponsesResponse)
	toChat, err := ConvertResponse(nil, nil, types.RelayFormatOpenAI, responsesValue)
	require.NoError(t, err)
	require.NotNil(t, toChat.Usage.BillingUsage)
	require.NotNil(t, toChat.Usage.BillingUsage.ClaudeUsage)
	assert.Equal(t, 4, toChat.Usage.BillingUsage.ClaudeUsage.CacheCreationInputTokens)
}

func TestConvertResponseUsesBillingUsageWhenRestoringNativeTargets(t *testing.T) {
	chat := textRegistryChatResponse()
	chat.Usage.BillingUsage = dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{
		InputTokens:              10,
		CacheReadInputTokens:     3,
		CacheCreationInputTokens: 4,
		OutputTokens:             5,
	})

	toClaude, err := ConvertResponse(nil, nil, types.RelayFormatClaude, chat)
	require.NoError(t, err)
	claudeValue := toClaude.Value.(*dto.ClaudeResponse)
	require.NotNil(t, claudeValue.Usage)
	assert.Equal(t, 10, claudeValue.Usage.InputTokens)
	assert.Equal(t, 3, claudeValue.Usage.CacheReadInputTokens)
	assert.Equal(t, 4, claudeValue.Usage.CacheCreationInputTokens)
	assert.Equal(t, 5, claudeValue.Usage.OutputTokens)

	chat.Usage.BillingUsage = dto.NewGeminiChatBillingUsage(&dto.GeminiUsageMetadata{
		PromptTokenCount:        7,
		ToolUsePromptTokenCount: 2,
		CandidatesTokenCount:    5,
		ThoughtsTokenCount:      3,
		TotalTokenCount:         17,
	})

	toGemini, err := ConvertResponse(nil, nil, types.RelayFormatGemini, chat)
	require.NoError(t, err)
	geminiValue := toGemini.Value.(*dto.GeminiChatResponse)
	assert.Equal(t, 7, geminiValue.UsageMetadata.PromptTokenCount)
	assert.Equal(t, 2, geminiValue.UsageMetadata.ToolUsePromptTokenCount)
	assert.Equal(t, 5, geminiValue.UsageMetadata.CandidatesTokenCount)
	assert.Equal(t, 3, geminiValue.UsageMetadata.ThoughtsTokenCount)
	assert.Equal(t, 17, geminiValue.UsageMetadata.TotalTokenCount)
}

func TestConvertStreamResponseDirectConverters(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeNone,
		},
	}
	info.SendResponseCount = 1
	finishReason := "stop"
	result, err := ConvertStreamResponse(nil, info, types.RelayFormatClaude, &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				FinishReason: &finishReason,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: respPtr("hello"),
				},
			},
		},
		Usage: &dto.Usage{PromptTokens: 2, CompletionTokens: 3, TotalTokens: 5},
	})
	require.NoError(t, err)
	assert.True(t, result.Stream)
	assert.Equal(t, ConverterOpenAIChatToClaudeMessages, result.Converter)
	require.IsType(t, []*dto.ClaudeResponse{}, result.Value)
	assert.Equal(t, 5, result.Usage.TotalTokens)

	result, err = ConvertStreamResponse(nil, &convmeta.Values{ChannelMetaAttached: true, UpstreamModelName: "gemini-test"}, types.RelayFormatOpenAI, &dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{{Content: dto.GeminiChatContent{Parts: []dto.GeminiPart{{Text: "hello"}}}}},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     1,
			CandidatesTokenCount: 2,
			TotalTokenCount:      3,
		},
	})
	require.NoError(t, err)
	assert.True(t, result.Stream)
	assert.Equal(t, ConverterGeminiContentToOpenAIChat, result.Converter)
	require.IsType(t, &dto.ChatCompletionsStreamResponse{}, result.Value)
	assert.Equal(t, 3, result.Usage.TotalTokens)
}

func TestConvertStreamResponseStatefulDirectConverters(t *testing.T) {
	chatState, err := NewResponseStreamState(types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses, ResponseStreamOptions{
		ID:    "resp_1",
		Model: "gpt-test",
	})
	require.NoError(t, err)
	chatResults, err := ConvertStreamResponseChunk(nil, nil, chatState, &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: respPtr("hello")}},
		},
		Usage: &dto.Usage{PromptTokens: 2, CompletionTokens: 3, TotalTokens: 5},
	})
	require.NoError(t, err)
	require.NotEmpty(t, chatResults)
	assert.Equal(t, ConverterOpenAIChatToOpenAIResponses, chatResults[0].Converter)
	assert.Equal(t, []ResponseStep{{Converter: ConverterOpenAIChatToOpenAIResponses, From: types.RelayFormatOpenAI, To: types.RelayFormatOpenAIResponses}}, chatResults[0].Steps)
	assert.Equal(t, 5, chatState.Usage().TotalTokens)

	finalResults, err := FinalizeStreamResponse(nil, nil, chatState)
	require.NoError(t, err)
	require.NotEmpty(t, finalResults)
	lastEvent, ok := finalResults[len(finalResults)-1].Value.(ChatToResponsesStreamEvent)
	require.True(t, ok)
	assert.Equal(t, "response.completed", lastEvent.Type)

	responsesState, err := NewResponseStreamState(types.RelayFormatOpenAIResponses, types.RelayFormatOpenAI, ResponseStreamOptions{
		ID:    "chatcmpl_1",
		Model: "gpt-test",
	})
	require.NoError(t, err)
	responsesResults, err := ConvertStreamResponseChunk(nil, nil, responsesState, &dto.ResponsesStreamResponse{
		Type:  "response.output_text.delta",
		Delta: "hello",
	})
	require.NoError(t, err)
	require.NotEmpty(t, responsesResults)
	assert.Equal(t, ConverterOpenAIResponsesToOpenAIChat, responsesResults[0].Converter)
	assert.Equal(t, []ResponseStep{{Converter: ConverterOpenAIResponsesToOpenAIChat, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatOpenAI}}, responsesResults[0].Steps)
	require.IsType(t, dto.ChatCompletionsStreamResponse{}, responsesResults[len(responsesResults)-1].Value)
}

func TestConvertStreamResponseStatefulDirectResponsesToClaude(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeNone,
		},
	}
	state, err := NewResponseStreamState(types.RelayFormatOpenAIResponses, types.RelayFormatClaude, ResponseStreamOptions{
		ID:    "chatcmpl_1",
		Model: "gpt-test",
	})
	require.NoError(t, err)

	results, err := ConvertStreamResponseChunk(nil, info, state, &dto.ResponsesStreamResponse{
		Type:  "response.output_text.delta",
		Delta: "hello",
	})
	require.NoError(t, err)
	require.NotEmpty(t, results)
	assert.Equal(t, requestConverterResponsesToClaude, results[0].Converter)
	assert.Equal(t, []ResponseStep{
		{Converter: ConverterOpenAIResponsesToClaudeMessages, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatClaude},
	}, results[0].Steps)

	var sawTextDelta bool
	for _, result := range results {
		claudeResponse, ok := result.Value.(*dto.ClaudeResponse)
		if !ok || claudeResponse == nil {
			continue
		}
		if claudeResponse.Type == "content_block_delta" && claudeResponse.Delta != nil && claudeResponse.Delta.Text != nil && *claudeResponse.Delta.Text == "hello" {
			sawTextDelta = true
		}
	}
	assert.True(t, sawTextDelta)

	state.SetUsage(&dto.Usage{PromptTokens: 2, CompletionTokens: 3, TotalTokens: 5})
	_, err = FinalizeStreamResponse(nil, info, state)
	require.NoError(t, err)
	assert.Equal(t, 5, state.Usage().TotalTokens)
}

func TestResponseUsageMatrixChatAndResponsesDetails(t *testing.T) {
	chat := textRegistryChatResponse()
	chat.Usage = dto.Usage{
		PromptTokens:     10,
		CompletionTokens: 5,
		TotalTokens:      20,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         3,
			CachedCreationTokens: 2,
			CacheWriteTokens:     6,
			TextTokens:           4,
			AudioTokens:          1,
			ImageTokens:          5,
		},
		CompletionTokenDetails: dto.OutputTokenDetails{
			ReasoningTokens: 2,
			TextTokens:      2,
			AudioTokens:     1,
			ImageTokens:     2,
		},
	}
	result, err := ConvertResponse(nil, nil, types.RelayFormatOpenAIResponses, chat)
	require.NoError(t, err)
	assert.Equal(t, 10, result.Usage.InputTokens)
	assert.Equal(t, 5, result.Usage.OutputTokens)
	assert.Equal(t, 20, result.Usage.TotalTokens)
	require.NotNil(t, result.Usage.InputTokensDetails)
	assert.Equal(t, 3, result.Usage.InputTokensDetails.CachedTokens)
	assert.Equal(t, 2, result.Usage.InputTokensDetails.CachedCreationTokens)
	assert.Equal(t, 6, result.Usage.InputTokensDetails.CacheWriteTokens)
	assert.Equal(t, 4, result.Usage.InputTokensDetails.TextTokens)
	assert.Equal(t, 1, result.Usage.InputTokensDetails.AudioTokens)
	assert.Equal(t, 5, result.Usage.InputTokensDetails.ImageTokens)
	assert.Equal(t, 2, result.Usage.CompletionTokenDetails.ReasoningTokens)
	assert.Equal(t, 2, result.Usage.CompletionTokenDetails.TextTokens)
	assert.Equal(t, 1, result.Usage.CompletionTokenDetails.AudioTokens)
	assert.Equal(t, 2, result.Usage.CompletionTokenDetails.ImageTokens)

	responses := &dto.OpenAIResponsesResponse{
		ID:        "resp_1",
		Status:    []byte(`"completed"`),
		Model:     "gpt-test",
		Output:    []dto.ResponsesOutput{},
		CreatedAt: 123,
		Usage: &dto.Usage{
			InputTokens:  12,
			OutputTokens: 8,
			TotalTokens:  21,
			InputTokensDetails: &dto.InputTokenDetails{
				CachedTokens:         4,
				CachedCreationTokens: 1,
				CacheWriteTokens:     7,
				TextTokens:           5,
				AudioTokens:          2,
				ImageTokens:          1,
			},
			CompletionTokenDetails: dto.OutputTokenDetails{
				ReasoningTokens: 3,
				TextTokens:      4,
				AudioTokens:     1,
				ImageTokens:     3,
			},
		},
	}
	result, err = ConvertResponse(nil, nil, types.RelayFormatOpenAI, responses)
	require.NoError(t, err)
	assert.Equal(t, 12, result.Usage.PromptTokens)
	assert.Equal(t, 8, result.Usage.CompletionTokens)
	assert.Equal(t, 21, result.Usage.TotalTokens)
	assert.Equal(t, 4, result.Usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 1, result.Usage.PromptTokensDetails.CachedCreationTokens)
	assert.Equal(t, 7, result.Usage.PromptTokensDetails.CacheWriteTokens)
	assert.Equal(t, 5, result.Usage.PromptTokensDetails.TextTokens)
	assert.Equal(t, 2, result.Usage.PromptTokensDetails.AudioTokens)
	assert.Equal(t, 1, result.Usage.PromptTokensDetails.ImageTokens)
	assert.Equal(t, 3, result.Usage.CompletionTokenDetails.ReasoningTokens)
	assert.Equal(t, 4, result.Usage.CompletionTokenDetails.TextTokens)
	assert.Equal(t, 1, result.Usage.CompletionTokenDetails.AudioTokens)
	assert.Equal(t, 3, result.Usage.CompletionTokenDetails.ImageTokens)
}

func textRegistryChatResponse() *dto.OpenAITextResponse {
	msg := dto.Message{
		Role:    "assistant",
		Content: "hello",
	}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "lookup",
				Arguments: `{"q":"x"}`,
			},
		},
	})
	return &dto.OpenAITextResponse{
		Id:      "chatcmpl_1",
		Model:   "gpt-test",
		Created: 123,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        0,
				Message:      msg,
				FinishReason: "tool_calls",
			},
		},
		Usage: dto.Usage{PromptTokens: 4, CompletionTokens: 5, TotalTokens: 9},
	}
}

func textRegistryResponsesResponse() *dto.OpenAIResponsesResponse {
	return &dto.OpenAIResponsesResponse{
		ID:        "resp_1",
		CreatedAt: 123,
		Model:     "gpt-test",
		Status:    []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{
				Type: "message",
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: "hello"},
				},
			},
			{
				Type:      "function_call",
				ID:        "call_1",
				CallId:    "call_1",
				Name:      "lookup",
				Arguments: []byte(`{"q":"x"}`),
			},
		},
		Usage: &dto.Usage{InputTokens: 4, OutputTokens: 7, TotalTokens: 11},
	}
}

func respPtr[T any](value T) *T {
	return &value
}

func TestConvertResponseToResponsesRestoresRecordedCustomTools(t *testing.T) {
	info := &convmeta.Values{ResponsesTools: &convmeta.ResponsesToolState{CustomToolNames: map[string]struct{}{"exec": {}}}}
	chatMessage := dto.Message{Role: "assistant"}
	chatMessage.SetToolCalls([]dto.ToolCallRequest{{ID: "call_exec", Type: "function", Function: dto.FunctionRequest{Name: "exec", Arguments: `{"input":"ls"}`}}})
	geminiExecCall := `{"candidates":[{"finishReason":"STOP","content":{"role":"model","parts":[{"functionCall":{"name":"exec","args":{"input":"ls"}}}]}}],"usageMetadata":{"promptTokenCount":4,"candidatesTokenCount":2,"totalTokenCount":6}}`
	tests := []struct {
		name     string
		from     types.RelayFormat
		response any
		stream   []any
	}{
		{
			name: "chat",
			from: types.RelayFormatOpenAI,
			response: &dto.OpenAITextResponse{
				Id:      "chatcmpl_1",
				Model:   "gpt-test",
				Choices: []dto.OpenAITextResponseChoice{{Message: chatMessage, FinishReason: "tool_calls"}},
			},
			stream: []any{
				chatStreamChunk(`{"id":"chatcmpl_1","model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_exec","type":"function","function":{"name":"exec","arguments":"{\"input\":"}}]}}]}`),
				chatStreamChunk(`{"id":"chatcmpl_1","model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"ls\"}"}}]},"finish_reason":"tool_calls"}]}`),
			},
		},
		{
			name: "claude",
			from: types.RelayFormatClaude,
			response: &dto.ClaudeResponse{
				Id:         "msg_1",
				Type:       "message",
				Role:       "assistant",
				Model:      "claude-test",
				StopReason: "tool_use",
				Content:    []dto.ClaudeMediaMessage{{Type: "tool_use", Id: "toolu_exec", Name: "exec", Input: map[string]any{"input": "ls"}}},
			},
			stream: []any{
				claudeStreamChunk(`{"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-test","content":[],"usage":{"input_tokens":4,"output_tokens":0}}}`),
				claudeStreamChunk(`{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_exec","name":"exec","input":{}}}`),
				claudeStreamChunk(`{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"input\":"}}`),
				claudeStreamChunk(`{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\"ls\"}"}}`),
				claudeStreamChunk(`{"type":"content_block_stop","index":0}`),
				claudeStreamChunk(`{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":2}}`),
				claudeStreamChunk(`{"type":"message_stop"}`),
			},
		},
		{
			name:     "gemini",
			from:     types.RelayFormatGemini,
			response: geminiStreamChunk(geminiExecCall),
			stream:   []any{geminiStreamChunk(geminiExecCall)},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertResponse(nil, info, types.RelayFormatOpenAIResponses, tt.response)
			require.NoError(t, err)
			responses, ok := result.Value.(*dto.OpenAIResponsesResponse)
			require.True(t, ok)
			require.Len(t, responses.Output, 1)
			assert.Equal(t, "custom_tool_call", responses.Output[0].Type)
			assert.Equal(t, "exec", responses.Output[0].Name)
			assert.Equal(t, `"ls"`, string(responses.Output[0].Input))

			state, err := NewResponseStreamState(tt.from, types.RelayFormatOpenAIResponses, ResponseStreamOptions{ID: "resp_1", Model: "model-test"})
			require.NoError(t, err)
			var results []ResponseResult
			for _, chunk := range tt.stream {
				chunkResults, err := ConvertStreamResponseChunk(nil, info, state, chunk)
				require.NoError(t, err)
				results = append(results, chunkResults...)
			}
			finals, err := FinalizeStreamResponse(nil, info, state)
			require.NoError(t, err)
			results = append(results, finals...)

			var toolEvents []string
			for _, result := range results {
				event, ok := result.Value.(ChatToResponsesStreamEvent)
				require.True(t, ok)
				switch {
				case event.Payload.Item != nil && event.Payload.Item.Type != "message":
					toolEvents = append(toolEvents, event.Type+" "+event.Payload.Item.Type+" "+string(event.Payload.Item.Input))
				case event.Type == "response.custom_tool_call_input.delta":
					toolEvents = append(toolEvents, event.Type+" "+event.Payload.Delta)
				case event.Type == "response.custom_tool_call_input.done":
					require.NotNil(t, event.Payload.Input)
					toolEvents = append(toolEvents, event.Type+" "+*event.Payload.Input)
				case strings.Contains(event.Type, "function_call_arguments"):
					toolEvents = append(toolEvents, event.Type)
				}
			}
			assert.Equal(t, []string{
				`response.output_item.added custom_tool_call ""`,
				"response.custom_tool_call_input.delta ls",
				"response.custom_tool_call_input.done ls",
				`response.output_item.done custom_tool_call "ls"`,
			}, toolEvents)
		})
	}
}

const bridgeLogprobs = `[{"token":"x","logprob":0,"bytes":[120],"top_logprobs":[{"token":"x","logprob":0,"bytes":[120]}]}]`

func TestChatResponsesProbabilityRequestsAndImageDetail(t *testing.T) {
	for _, tc := range []struct {
		name   string
		chat   bool
		fields string
		want   string
	}{
		{"chat quantity zero", true, `"logprobs":true,"top_logprobs":0`, `"top_logprobs":0,"include":["message.output_text.logprobs"]`},
		{"chat quantity three", true, `"logprobs":true,"top_logprobs":3`, `"top_logprobs":3,"include":["message.output_text.logprobs"]`},
		{"chat probabilities only", true, `"logprobs":true`, `"include":["message.output_text.logprobs"]`},
		{"chat disabled", true, `"logprobs":false`, ""},
		{"responses quantity zero", false, `"top_logprobs":0`, `"logprobs":true,"top_logprobs":0`},
		{"responses quantity three", false, `"top_logprobs":3`, `"logprobs":true,"top_logprobs":3`},
		{"responses probabilities only", false, `"include":["message.output_text.logprobs"]`, `"logprobs":true`},
		{"responses unrelated include", false, `"include":["reasoning.encrypted_content"]`, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var request any = &dto.OpenAIResponsesRequest{}
			target := types.RelayFormat(types.RelayFormatOpenAI)
			input := `"input":"x"`
			wantInput := `"messages":[{"role":"user","content":"x"}]`
			if tc.chat {
				request = &dto.GeneralOpenAIRequest{}
				target = types.RelayFormatOpenAIResponses
				input = `"messages":[{"role":"user","content":"x"}]`
				wantInput = `"input":[{"role":"user","content":"x"}]`
			}
			require.NoError(t, kitutil.UnmarshalJsonStr(`{"model":"gpt-4o",`+input+","+tc.fields+"}", request))
			converted, err := ConvertRequest(nil, nil, target, request)
			require.NoError(t, err)
			encoded, err := kitutil.Marshal(converted.Value)
			require.NoError(t, err)
			want := `{"model":"gpt-4o",` + wantInput
			if tc.want != "" {
				want += "," + tc.want
			}
			assert.JSONEq(t, want+"}", string(encoded))
		})
	}
	for _, detail := range []string{"high", "low", "auto", "original"} {
		t.Run("image "+detail, func(t *testing.T) {
			request := &dto.OpenAIResponsesRequest{}
			require.NoError(t, kitutil.UnmarshalJsonStr(`{"model":"gpt-4o","input":[{"role":"user","content":[{"type":"input_image","image_url":"data:image/png;base64,eA==","detail":"`+detail+`"}]}]}`, request))
			converted, err := ConvertRequest(nil, nil, types.RelayFormatOpenAI, request)
			require.NoError(t, err)
			encoded, err := kitutil.Marshal(converted.Value)
			require.NoError(t, err)
			wantDetail := ""
			if detail != "original" {
				wantDetail = `,"detail":"` + detail + `"`
			}
			assert.JSONEq(t, `{"model":"gpt-4o","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"data:image/png;base64,eA=="`+wantDetail+`}}]}]}`, string(encoded))
		})
	}
}

func TestChatResponsesRefusalAndLogprobsJSON(t *testing.T) {
	for _, tc := range []struct{ name, choice, content, chat string }{
		{"refusal", `"message":{"role":"assistant","content":null,"refusal":"no"}`, `[{"type":"refusal","refusal":"no"}]`, `{"role":"assistant","content":"","refusal":"no"}`},
		{"refusal probabilities", `"message":{"role":"assistant","content":null,"refusal":"no"},"logprobs":{"content":null,"refusal":` + bridgeLogprobs + `}`, `[{"type":"refusal","refusal":"no"}]`, `{"role":"assistant","content":"","refusal":"no"}`},
		{"probabilities", `"message":{"role":"assistant","content":"x"},"logprobs":{"content":` + bridgeLogprobs + `}`, `[{"type":"output_text","text":"x","annotations":[],"logprobs":` + bridgeLogprobs + `}]`, `{"role":"assistant","content":"x"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			chat := &dto.OpenAITextResponse{}
			require.NoError(t, kitutil.UnmarshalJsonStr(`{"id":"chat1","model":"gpt-4o","choices":[{"index":0,"finish_reason":"stop",`+tc.choice+`}],"usage":{"prompt_tokens":8,"completion_tokens":1,"total_tokens":9}}`, chat))
			result, err := ConvertResponse(nil, nil, types.RelayFormatOpenAIResponses, chat)
			require.NoError(t, err)
			response := result.Value.(*dto.OpenAIResponsesResponse)
			require.Len(t, response.Output, 1)
			encoded, err := kitutil.Marshal(response.Output[0].Content)
			require.NoError(t, err)
			assert.JSONEq(t, tc.content, string(encoded))
			reversed, err := ConvertResponse(nil, nil, types.RelayFormatOpenAI, response)
			require.NoError(t, err)
			back := reversed.Value.(*dto.OpenAITextResponse)
			require.Len(t, back.Choices, 1)
			encoded, err = kitutil.Marshal(back.Choices[0].Message)
			require.NoError(t, err)
			assert.JSONEq(t, tc.chat, string(encoded))
			if tc.name == "probabilities" {
				require.NotNil(t, back.Choices[0].Logprobs)
				encoded, err = kitutil.Marshal(back.Choices[0].Logprobs.Content)
				require.NoError(t, err)
				assert.JSONEq(t, bridgeLogprobs, string(encoded))
			}
			assert.Equal(t, 9, back.Usage.TotalTokens)
		})
	}
}

func TestChatResponsesRefusalAndLogprobsStreamLifecycle(t *testing.T) {
	for _, mode := range []string{"text first", "refusal first", "separate probabilities"} {
		refusalFirst := mode == "refusal first"
		t.Run(mode, func(t *testing.T) {
			state, err := NewResponseStreamState(types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses, ResponseStreamOptions{ID: "resp1", Model: "gpt-4o", EmitSequenceNumber: true})
			require.NoError(t, err)
			text := `{"choices":[{"index":0,"delta":{"content":"x"},"logprobs":{"content":` + bridgeLogprobs + `}}]}`
			refusal := `{"choices":[{"index":0,"delta":{"refusal":"no"}}]}`
			inputs := []string{text, refusal}
			if refusalFirst {
				inputs = []string{refusal, text}
			}
			if mode == "separate probabilities" {
				inputs = []string{
					`{"choices":[{"index":0,"delta":{"role":"assistant"},"logprobs":[]}]}`,
					`{"choices":[{"index":0,"delta":{"content":"x"}}]}`,
					`{"choices":[{"index":0,"delta":{},"logprobs":{"content":` + bridgeLogprobs + `}}]}`,
					refusal,
				}
			}
			inputs = append(inputs, `{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`)
			var events []ChatToResponsesStreamEvent
			for _, raw := range inputs {
				chunk := &dto.ChatCompletionsStreamResponse{}
				require.NoError(t, kitutil.UnmarshalJsonStr(raw, chunk))
				results, err := ConvertStreamResponseChunk(nil, nil, state, chunk)
				require.NoError(t, err)
				for _, result := range results {
					events = append(events, result.Value.(ChatToResponsesStreamEvent))
				}
			}
			finals, err := FinalizeStreamResponse(nil, nil, state)
			require.NoError(t, err)
			for _, result := range finals {
				events = append(events, result.Value.(ChatToResponsesStreamEvent))
			}
			var final *dto.OpenAIResponsesResponse
			seen := map[string]int{}
			for _, event := range events {
				seen[event.Type]++
				switch event.Type {
				case "response.output_text.delta", "response.output_text.done":
					if event.Type == "response.output_text.done" || len(event.Payload.Logprobs) > 0 {
						encoded, err := kitutil.Marshal(event.Payload.Logprobs)
						require.NoError(t, err)
						assert.JSONEq(t, bridgeLogprobs, string(encoded))
					}
					if event.Type == "response.output_text.delta" && event.Payload.Delta == "" {
						encoded, err := kitutil.Marshal(event.Payload)
						require.NoError(t, err)
						var fields map[string]json.RawMessage
						require.NoError(t, kitutil.Unmarshal(encoded, &fields))
						assert.JSONEq(t, `""`, string(fields["delta"]))
					}
				case "response.refusal.done":
					require.NotNil(t, event.Payload.Refusal)
					assert.Equal(t, "no", *event.Payload.Refusal)
				case "response.completed":
					final = event.Payload.Response
				}
			}
			assert.Equal(t, 1, seen["response.refusal.delta"])
			assert.Equal(t, 1, seen["response.refusal.done"])
			require.NotNil(t, final)
			require.Len(t, final.Output, 1)
			require.Len(t, final.Output[0].Content, 2)
			if refusalFirst {
				assert.Equal(t, "refusal", final.Output[0].Content[0].Type)
			} else {
				assert.Equal(t, "output_text", final.Output[0].Content[0].Type)
			}
			back, err := NewResponseStreamState(types.RelayFormatOpenAIResponses, types.RelayFormatOpenAI, ResponseStreamOptions{})
			require.NoError(t, err)
			accumulator := NewResponsesBufferedAccumulator()
			var textOut, refusalOut strings.Builder
			var logprobs []json.RawMessage
			for _, event := range events {
				accumulator.ProcessEvent(&event.Payload)
				results, err := ConvertStreamResponseChunk(nil, nil, back, &event.Payload)
				require.NoError(t, err)
				for _, result := range results {
					chunk := result.Value.(dto.ChatCompletionsStreamResponse)
					for _, choice := range chunk.Choices {
						textOut.WriteString(choice.Delta.GetContentString())
						if choice.Delta.Refusal != nil {
							refusalOut.WriteString(*choice.Delta.Refusal)
						}
						if choice.Logprobs != nil {
							encoded, err := kitutil.Marshal(*choice.Logprobs)
							require.NoError(t, err)
							var probabilities dto.ChatLogprobs
							require.NoError(t, kitutil.Unmarshal(encoded, &probabilities))
							logprobs = append(logprobs, probabilities.Content...)
						}
					}
				}
			}
			assert.Equal(t, "x", textOut.String())
			assert.Equal(t, "no", refusalOut.String())
			encoded, err := kitutil.Marshal(logprobs)
			require.NoError(t, err)
			assert.JSONEq(t, bridgeLogprobs, string(encoded))
			buffered := &dto.OpenAIResponsesResponse{}
			accumulator.SupplementResponseOutput(buffered)
			// Buffered items preserve content, but do not synthesize completion status.
			require.Len(t, buffered.Output, 1)
			encoded, err = kitutil.Marshal(buffered.Output[0].Content)
			require.NoError(t, err)
			want, err := kitutil.Marshal(final.Output[0].Content)
			require.NoError(t, err)
			assert.JSONEq(t, string(want), string(encoded))
		})
	}
}

func TestResponsesRefusalAndLogprobsDoneAndTerminalFallback(t *testing.T) {
	for _, mode := range []string{"terminal only", "done only", "late probabilities", "item done only"} {
		t.Run(mode, func(t *testing.T) {
			state, err := NewResponseStreamState(types.RelayFormatOpenAIResponses, types.RelayFormatOpenAI, ResponseStreamOptions{})
			require.NoError(t, err)
			var events []string
			if mode == "late probabilities" {
				events = append(events, `{"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":"x"}`)
			}
			content := `[{"type":"output_text","text":"x","annotations":null,"logprobs":` + bridgeLogprobs + `},{"type":"refusal","refusal":"no"}]`
			output := `[{"type":"message","role":"assistant","content":` + content + `}]`
			if mode == "item done only" {
				events = append(events, `{"type":"response.output_item.done","output_index":0,"item":{"type":"message","role":"assistant","content":`+content+`}}`)
			} else if mode != "terminal only" {
				events = append(events, `{"type":"response.output_text.done","output_index":0,"content_index":0,"text":"x","logprobs":`+bridgeLogprobs+`}`, `{"type":"response.refusal.done","output_index":0,"content_index":1,"refusal":"no"}`)
			}
			if mode != "terminal only" {
				output = `[]`
			}
			events = append(events, `{"type":"response.completed","response":{"status":"completed","output":`+output+`}}`)
			var text, refusal strings.Builder
			var probabilities []json.RawMessage
			accumulator := NewResponsesBufferedAccumulator()
			for _, raw := range events {
				event := &dto.ResponsesStreamResponse{}
				require.NoError(t, kitutil.UnmarshalJsonStr(raw, event))
				accumulator.ProcessEvent(event)
				results, err := ConvertStreamResponseChunk(nil, nil, state, event)
				require.NoError(t, err)
				for _, result := range results {
					for _, choice := range result.Value.(dto.ChatCompletionsStreamResponse).Choices {
						text.WriteString(choice.Delta.GetContentString())
						if choice.Delta.Refusal != nil {
							refusal.WriteString(*choice.Delta.Refusal)
						}
						if choice.Logprobs != nil {
							raw, err := kitutil.Marshal(*choice.Logprobs)
							require.NoError(t, err)
							var logs dto.ChatLogprobs
							require.NoError(t, kitutil.Unmarshal(raw, &logs))
							probabilities = append(probabilities, logs.Content...)
						}
					}
				}
			}
			assert.Equal(t, "x", text.String())
			assert.Equal(t, "no", refusal.String())
			encoded, err := kitutil.Marshal(probabilities)
			require.NoError(t, err)
			assert.JSONEq(t, bridgeLogprobs, string(encoded))
			if mode != "terminal only" {
				buffered := &dto.OpenAIResponsesResponse{}
				accumulator.SupplementResponseOutput(buffered)
				require.Len(t, buffered.Output, 1)
				encoded, err := kitutil.Marshal(buffered.Output[0].Content)
				require.NoError(t, err)
				assert.JSONEq(t, content, string(encoded))
			}
		})
	}
}
