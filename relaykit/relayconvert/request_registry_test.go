package relayconvert

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	sharedgemini "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/gemini"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestConverterRegistryKeepsImageConverters(t *testing.T) {
	spec, ok := LookupRequestConverter(ConverterOpenAIImageToGeminiContent)
	require.True(t, ok)
	assert.Equal(t, types.RelayFormat(types.RelayFormatOpenAIImage), spec.From)
	assert.Equal(t, types.RelayFormat(types.RelayFormatGemini), spec.To)
	assert.NotNil(t, spec.Convert)
	assert.Len(t, requestConverters, 1)
}

func TestConvertRequestToTargetRecordsConversionChain(t *testing.T) {
	info := &convmeta.Values{
		ConversionChain: []types.RelayFormat{types.RelayFormatOpenAI},
	}
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "user", Content: "hello"},
		},
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatOpenAIResponses, req)

	require.NoError(t, err)
	require.IsType(t, &dto.OpenAIResponsesRequest{}, result.Value)
	assert.Equal(t, types.RelayFormatOpenAI, result.From)
	assert.Equal(t, types.RelayFormat(types.RelayFormatOpenAIResponses), result.To)
	assert.Equal(t, ConverterOpenAIChatToOpenAIResponses, result.Converter)
	assert.Equal(t, RequestConverterQualityGood, result.Quality)
	assert.Equal(t, []RequestStep{
		{
			Converter: ConverterOpenAIChatToOpenAIResponses,
			From:      types.RelayFormatOpenAI,
			To:        types.RelayFormatOpenAIResponses,
		},
	}, result.Steps)
	assert.Equal(t, []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses}, info.ConversionChain)
}

func TestConvertRequestChatThinkingAsksResponsesForSummary(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:           "gpt-test",
		ReasoningEffort: "high",
		Messages:        []dto.Message{{Role: "user", Content: "think"}},
	}
	result, err := ConvertRequest(nil, nil, types.RelayFormatOpenAIResponses, req)
	require.NoError(t, err)
	out, ok := result.Value.(*dto.OpenAIResponsesRequest)
	require.True(t, ok)
	require.NotNil(t, out.Reasoning)
	assert.Equal(t, "high", out.Reasoning.Effort)
	assert.Equal(t, "auto", out.Reasoning.Summary)
}

func TestConvertRequestChatXHighToGeminiNativeThinkingLevel(t *testing.T) {
	info := &convmeta.Values{
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-3.7-pro",
		Options:             &convmeta.Options{},
	}
	result, err := ConvertRequest(context.Background(), info, types.RelayFormatGemini, &dto.GeneralOpenAIRequest{
		Model:           "client-model",
		ReasoningEffort: "xhigh",
		Messages:        []dto.Message{{Role: "user", Content: "think"}},
	})
	require.NoError(t, err)
	out := result.Value.(*dto.GeminiChatRequest)
	require.NotNil(t, out.GenerationConfig.ThinkingConfig)
	require.Equal(t, "HIGH", out.GenerationConfig.ThinkingConfig.ThinkingLevel)
	require.Nil(t, out.GenerationConfig.ThinkingConfig.ThinkingBudget)
	require.True(t, out.GenerationConfig.ThinkingConfig.IncludeThoughts)
	require.False(t, result.Report.Empty())
}

func TestConvertRequestChatEffortToGemini25DynamicBudgetReportsLoss(t *testing.T) {
	info := &convmeta.Values{
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-2.5-pro",
		Options:             &convmeta.Options{},
	}
	result, err := ConvertRequest(context.Background(), info, types.RelayFormatGemini, &dto.GeneralOpenAIRequest{
		ReasoningEffort: "high",
		Messages:        []dto.Message{{Role: "user", Content: "think"}},
	})
	require.NoError(t, err)
	out := result.Value.(*dto.GeminiChatRequest)
	require.NotNil(t, out.GenerationConfig.ThinkingConfig)
	require.NotNil(t, out.GenerationConfig.ThinkingConfig.ThinkingBudget)
	require.Equal(t, -1, *out.GenerationConfig.ThinkingConfig.ThinkingBudget)
	found := false
	for _, loss := range result.Report.Losses {
		if loss.Field == "thinking.effort_to_budget" && loss.Kind == ir.LossCoerced {
			found = true
		}
	}
	require.True(t, found, "losses=%#v", result.Report.Losses)
}

func TestConvertRequestResponsesXHighSummaryToGemini(t *testing.T) {
	info := &convmeta.Values{
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-3.7-pro",
		Options:             &convmeta.Options{},
	}
	result, err := ConvertRequest(context.Background(), info, types.RelayFormatGemini, &dto.OpenAIResponsesRequest{
		Model:     "client-model",
		Input:     json.RawMessage(`"think"`),
		Reasoning: &dto.Reasoning{Effort: "xhigh", Summary: "auto"},
	})
	require.NoError(t, err)
	out := result.Value.(*dto.GeminiChatRequest)
	require.NotNil(t, out.GenerationConfig.ThinkingConfig)
	require.Equal(t, "HIGH", out.GenerationConfig.ThinkingConfig.ThinkingLevel)
	require.True(t, out.GenerationConfig.ThinkingConfig.IncludeThoughts)
}

func TestConvertRequestClaudeSummarizedXHighToResponses(t *testing.T) {
	result, err := ConvertRequest(context.Background(), nil, types.RelayFormatOpenAIResponses, &dto.ClaudeRequest{
		Model:        "claude-opus-4-7",
		Messages:     []dto.ClaudeMessage{{Role: "user", Content: "think"}},
		Thinking:     &dto.Thinking{Type: "adaptive", Display: "summarized"},
		OutputConfig: json.RawMessage(`{"effort":"xhigh"}`),
	})
	require.NoError(t, err)
	out := result.Value.(*dto.OpenAIResponsesRequest)
	require.NotNil(t, out.Reasoning)
	require.Equal(t, "xhigh", out.Reasoning.Effort)
	require.Equal(t, "auto", out.Reasoning.Summary)
}

func TestConvertRequestGeminiBudgetToChatHighWithLoss(t *testing.T) {
	budget := 16000
	result, err := ConvertRequest(context.Background(), nil, types.RelayFormatOpenAI, &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{Text: "think"}}}},
		GenerationConfig: dto.GeminiChatGenerationConfig{
			ThinkingConfig: &dto.GeminiThinkingConfig{ThinkingBudget: &budget, IncludeThoughts: true},
		},
	})
	require.NoError(t, err)
	out := result.Value.(*dto.GeneralOpenAIRequest)
	require.Equal(t, "high", out.ReasoningEffort)
	found := false
	for _, loss := range result.Report.Losses {
		if loss.Field == "thinking.budget" && loss.Kind == ir.LossCoerced {
			found = true
		}
	}
	require.True(t, found, "losses=%#v", result.Report.Losses)
}

func TestConvertRequestClaudeToChatDropsCacheControl(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model: "claude-test",
		Messages: []dto.ClaudeMessage{
			{
				Role: "user",
				Content: []map[string]any{
					{
						"type":          "text",
						"text":          "hello workspace",
						"cache_control": map[string]any{"type": "ephemeral", "ttl": "1h"},
					},
				},
			},
		},
	}

	result, err := ConvertRequest(nil, nil, types.RelayFormatOpenAI, req)
	require.NoError(t, err)
	chatReq, ok := result.Value.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Len(t, chatReq.Messages, 1)
	content, ok := chatReq.Messages[0].Content.(string)
	require.True(t, ok, "content=%T", chatReq.Messages[0].Content)
	require.Equal(t, "hello workspace", content)
	raw, err := json.Marshal(chatReq.Messages[0])
	require.NoError(t, err)
	require.NotContains(t, string(raw), "cache_control")
}

func TestConvertRequestClaudeToolResultKeepsFollowupTextForChat(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model: "claude-test",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "Call get_weather with city=Paris NOW."},
			{
				Role: "assistant",
				Content: []map[string]any{
					{"type": "tool_use", "id": "toolu_1", "name": "get_weather", "input": map[string]any{"city": "Paris"}},
				},
			},
			{
				Role: "user",
				Content: []map[string]any{
					{"type": "tool_result", "tool_use_id": "toolu_1", "content": "{\"city\":\"Paris\",\"temp_c\":18}"},
					{"type": "text", "text": "工具结果已经给你了。现在请回答停车费谁亏谁赚？"},
				},
			},
		},
	}

	result, err := ConvertRequest(nil, nil, types.RelayFormatOpenAI, req)
	require.NoError(t, err)
	chatReq, ok := result.Value.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.GreaterOrEqual(t, len(chatReq.Messages), 4)
	require.Equal(t, "tool", chatReq.Messages[2].Role)
	require.Equal(t, "toolu_1", chatReq.Messages[2].ToolCallId)
	require.Equal(t, "user", chatReq.Messages[3].Role)
	require.Contains(t, chatReq.Messages[3].StringContent(), "停车费")
}

func TestConvertRequestResponsesToolResultKeepsFollowupTextForChat(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "glm-5.2",
		Input: mustRawMessage(t, []map[string]any{
			{"role": "user", "content": "Call get_weather with city=北京."},
			{
				"type":      "function_call",
				"call_id":   "call_weather",
				"name":      "get_weather",
				"arguments": `{"city":"北京"}`,
			},
			{
				"type":    "function_call_output",
				"call_id": "call_weather",
				"output":  `{"temperature":"22°C"}`,
			},
			{"role": "user", "content": "请逆序排列文字"},
		}),
	}

	result, err := ConvertRequest(nil, nil, types.RelayFormatOpenAI, req)
	require.NoError(t, err)
	chatReq, ok := result.Value.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Len(t, chatReq.Messages, 4)
	require.Equal(t, "assistant", chatReq.Messages[1].Role)
	require.Len(t, chatReq.Messages[1].ParseToolCalls(), 1)
	require.Equal(t, "tool", chatReq.Messages[2].Role)
	require.Equal(t, "call_weather", chatReq.Messages[2].ToolCallId)
	require.Equal(t, "user", chatReq.Messages[3].Role)
	require.Equal(t, "请逆序排列文字", chatReq.Messages[3].StringContent())
}

func TestConvertRequestChatToolResultKeepsFollowupTurnForGemini(t *testing.T) {
	assistant := dto.Message{Role: "assistant"}
	assistant.SetToolCalls([]dto.ToolCallRequest{{
		ID:   "call_weather",
		Type: "function",
		Function: dto.FunctionRequest{
			Name:      "get_weather",
			Arguments: `{"city":"北京"}`,
		},
	}})
	req := &dto.GeneralOpenAIRequest{
		Model: "gemini-3.7-flash",
		Messages: []dto.Message{
			{Role: "user", Content: "Call get_weather with city=北京."},
			assistant,
			{Role: "tool", ToolCallId: "call_weather", Content: `{"temperature":"22°C"}`},
			{Role: "user", Content: "请逆序排列文字"},
		},
	}

	result, err := ConvertRequest(nil, nil, types.RelayFormatGemini, req)
	require.NoError(t, err)
	geminiReq, ok := result.Value.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, geminiReq.Contents, 4)
	toolResult := geminiReq.Contents[2]
	followup := geminiReq.Contents[3]
	require.Equal(t, "user", toolResult.Role)
	require.Len(t, toolResult.Parts, 1)
	require.NotNil(t, toolResult.Parts[0].FunctionResponse)
	require.Equal(t, "user", followup.Role)
	require.Len(t, followup.Parts, 1)
	require.Nil(t, followup.Parts[0].FunctionResponse)
	require.Equal(t, "请逆序排列文字", followup.Parts[0].Text)
}

func TestConvertRequestClaudeToChatRecordsSignatureLoss(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model: "claude-test",
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []map[string]any{
					{"type": "thinking", "thinking": "secret", "signature": "sig-1"},
					{"type": "text", "text": "hello"},
				},
			},
		},
	}

	result, err := ConvertRequest(nil, nil, types.RelayFormatOpenAI, req)
	require.NoError(t, err)
	require.False(t, result.Report.Empty())
	found := false
	for _, loss := range result.Report.Losses {
		if loss.Field == "thinking.signature" {
			found = true
			break
		}
	}
	require.True(t, found, "losses=%#v", result.Report.Losses)
}

func TestConvertRequestPlansMultiHopPath(t *testing.T) {
	info := &convmeta.Values{
		ConversionChain: []types.RelayFormat{types.RelayFormatClaude},
	}
	req := &dto.ClaudeRequest{
		Model: "claude-test",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hello"},
		},
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatOpenAIResponses, req)

	require.NoError(t, err)
	require.IsType(t, &dto.OpenAIResponsesRequest{}, result.Value)
	assert.Equal(t, types.RelayFormat(types.RelayFormatClaude), result.From)
	assert.Equal(t, types.RelayFormat(types.RelayFormatOpenAIResponses), result.To)
	assert.Equal(t, requestConverterClaudeToResponses, result.Converter)
	assert.Equal(t, RequestConverterQualityFair, result.Quality)
	assert.Equal(t, []RequestStep{
		{
			Converter: requestConverterClaudeToResponses,
			From:      types.RelayFormatClaude,
			To:        types.RelayFormatOpenAIResponses,
		},
	}, result.Steps)
	assert.Equal(t, []types.RelayFormat{types.RelayFormatClaude, types.RelayFormatOpenAIResponses}, info.ConversionChain)
}

func TestConvertRequestViaExecutesExplicitPath(t *testing.T) {
	info := &convmeta.Values{
		ConversionChain: []types.RelayFormat{types.RelayFormatOpenAI},
	}
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "user", Content: "hello"},
		},
	}

	result, err := ConvertRequestVia(nil, info, req, types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses)

	require.NoError(t, err)
	require.IsType(t, &dto.OpenAIResponsesRequest{}, result.Value)
	assert.Equal(t, []RequestStep{
		{
			Converter: ConverterOpenAIChatToOpenAIResponses,
			From:      types.RelayFormatOpenAI,
			To:        types.RelayFormatOpenAIResponses,
		},
	}, result.Steps)
	assert.Equal(t, []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses}, info.ConversionChain)
}

func TestConvertRequestResponsesToGeminiAppliesResponsesPreprocess(t *testing.T) {
	info := &convmeta.Values{
		ConversionChain:     []types.RelayFormat{types.RelayFormatOpenAIResponses},
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-test",
	}
	req := &dto.OpenAIResponsesRequest{
		Model: "gemini-test",
		Input: mustRawMessage(t, []map[string]any{
			{
				"role":    "user",
				"content": "next turn",
			},
			{
				"type":    "custom_tool_call",
				"call_id": "call_custom",
				"name":    "apply_patch",
				"input":   "patch body",
			},
			{
				"type":    "custom_tool_call_output",
				"call_id": "call_custom",
				"output":  "ok",
			},
			{
				"type":    "function_call_output",
				"call_id": "call_custom",
				"output":  "legacy custom output",
			},
		}),
		Tools: mustRawMessage(t, []map[string]any{
			{"type": "custom", "name": "apply_patch"},
		}),
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatGemini, req)

	require.NoError(t, err)
	geminiReq, ok := result.Value.(*dto.GeminiChatRequest)
	require.True(t, ok)
	assert.Empty(t, geminiReq.GetTools())
	require.Len(t, geminiReq.Contents, 1)
	assert.Equal(t, "user", geminiReq.Contents[0].Role)
	require.Len(t, geminiReq.Contents[0].Parts, 1)
	assert.Equal(t, "next turn", geminiReq.Contents[0].Parts[0].Text)
	assert.Equal(t, ConverterOpenAIResponsesToGemini, result.Converter)
	assert.Equal(t, RequestConverterQualityFair, result.Quality)
	assert.Equal(t, []RequestStep{
		{
			Converter: ConverterOpenAIResponsesToGemini,
			From:      types.RelayFormatOpenAIResponses,
			To:        types.RelayFormatGemini,
		},
	}, result.Steps)
	assert.Equal(t, []types.RelayFormat{types.RelayFormatOpenAIResponses, types.RelayFormatGemini}, info.ConversionChain)
}

func TestConvertRequestResponsesToGeminiUsesDirectConverter(t *testing.T) {
	info := &convmeta.Values{
		Options:             &convmeta.Options{Gemini: convmeta.GeminiOptions{FunctionCallThoughtSignatureEnabled: true}},
		ConversionChain:     []types.RelayFormat{types.RelayFormatOpenAIResponses},
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-test",
	}
	maxOutputTokens := uint(256)
	req := &dto.OpenAIResponsesRequest{
		Model:           "gemini-test",
		Instructions:    mustRawMessage(t, "system rules"),
		MaxOutputTokens: &maxOutputTokens,
		Input: mustRawMessage(t, []map[string]any{
			{
				"role": "assistant",
				"content": []map[string]any{
					{"type": "output_text", "text": "I will call."},
				},
			},
			{
				"type":      "function_call",
				"call_id":   "call_1",
				"name":      "lookup",
				"arguments": map[string]any{"q": "x"},
			},
			{
				"type":    "function_call_output",
				"call_id": "call_1",
				"output":  map[string]any{"ok": true},
			},
		}),
		Tools: mustRawMessage(t, []map[string]any{
			{
				"type":        "function",
				"name":        "lookup",
				"description": "Lookup data",
				"parameters": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"propertyNames":        map[string]any{"pattern": "^[a-z]+$"},
					"properties": map[string]any{
						"q": map[string]any{
							"type":             "string",
							"exclusiveMinimum": 0,
						},
						"filters": map[string]any{
							"type": "array",
							"items": map[string]any{
								"type":                 "object",
								"additionalProperties": true,
								"properties": map[string]any{
									"name": map[string]any{"type": "string"},
								},
							},
						},
					},
				},
			},
		}),
		Text: mustRawMessage(t, map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"name":   "answer",
				"schema": map[string]any{"type": "object"},
			},
		}),
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatGemini, req)

	require.NoError(t, err)
	geminiReq, ok := result.Value.(*dto.GeminiChatRequest)
	require.True(t, ok)
	assert.Equal(t, ConverterOpenAIResponsesToGemini, result.Converter)
	assert.Equal(t, []RequestStep{
		{
			Converter: ConverterOpenAIResponsesToGemini,
			From:      types.RelayFormatOpenAIResponses,
			To:        types.RelayFormatGemini,
		},
	}, result.Steps)
	assert.Equal(t, []types.RelayFormat{types.RelayFormatOpenAIResponses, types.RelayFormatGemini}, info.ConversionChain)

	require.NotNil(t, geminiReq.SystemInstructions)
	require.Len(t, geminiReq.SystemInstructions.Parts, 1)
	assert.Equal(t, "system rules", geminiReq.SystemInstructions.Parts[0].Text)
	assert.Equal(t, "application/json", geminiReq.GenerationConfig.ResponseMimeType)
	assert.Equal(t, maxOutputTokens, *geminiReq.GenerationConfig.MaxOutputTokens)

	tools := geminiReq.GetTools()
	require.Len(t, tools, 1)
	functions, err := kitutil.Any2Type[[]dto.FunctionRequest](tools[0].FunctionDeclarations)
	require.NoError(t, err)
	require.Len(t, functions, 1)
	assert.Equal(t, "lookup", functions[0].Name)
	params, ok := functions[0].Parameters.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "OBJECT", params["type"])
	assert.NotContains(t, params, "additionalProperties")
	assert.NotContains(t, params, "propertyNames")
	properties, ok := params["properties"].(map[string]any)
	require.True(t, ok)
	queryParam, ok := properties["q"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "STRING", queryParam["type"])
	assert.NotContains(t, queryParam, "exclusiveMinimum")
	filterParam, ok := properties["filters"].(map[string]any)
	require.True(t, ok)
	filterItems, ok := filterParam["items"].(map[string]any)
	require.True(t, ok)
	assert.NotContains(t, filterItems, "additionalProperties")

	require.GreaterOrEqual(t, len(geminiReq.Contents), 2)
	modelIdx := 0
	if geminiReq.Contents[0].Role == "user" && geminiReq.Contents[0].Parts[0].FunctionResponse == nil {
		modelIdx = 1
	}
	assert.Equal(t, "model", geminiReq.Contents[modelIdx].Role)
	require.Len(t, geminiReq.Contents[modelIdx].Parts, 2)
	var functionPart, textPart dto.GeminiPart
	for _, part := range geminiReq.Contents[modelIdx].Parts {
		if part.FunctionCall != nil {
			functionPart = part
		}
		if part.Text != "" {
			textPart = part
		}
	}
	require.NotNil(t, functionPart.FunctionCall)
	assert.Equal(t, "lookup", functionPart.FunctionCall.FunctionName)
	assert.Equal(t, map[string]any{"q": "x"}, functionPart.FunctionCall.Arguments)
	var thoughtSignature string
	require.NoError(t, kitutil.Unmarshal(functionPart.ThoughtSignature, &thoughtSignature))
	assert.Equal(t, sharedgemini.ThoughtSignatureBypassValue, thoughtSignature)
	assert.Equal(t, "I will call.", textPart.Text)

	userIdx := modelIdx + 1
	assert.Equal(t, "user", geminiReq.Contents[userIdx].Role)
	require.Len(t, geminiReq.Contents[userIdx].Parts, 1)
	functionResponse := geminiReq.Contents[userIdx].Parts[0].FunctionResponse
	require.NotNil(t, functionResponse)
	assert.Equal(t, "lookup", functionResponse.Name)
	assert.Equal(t, true, functionResponse.Response["ok"])
	assert.Empty(t, geminiReq.Contents[userIdx].Parts[0].ThoughtSignature)
}

func TestConvertRequestResponsesToGeminiSkipsThoughtSignatureWhenDisabled(t *testing.T) {
	info := &convmeta.Values{
		Options:             &convmeta.Options{Gemini: convmeta.GeminiOptions{FunctionCallThoughtSignatureEnabled: false}},
		ConversionChain:     []types.RelayFormat{types.RelayFormatOpenAIResponses},
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-test",
	}
	req := &dto.OpenAIResponsesRequest{
		Model: "gemini-test",
		Input: mustRawMessage(t, []map[string]any{
			{
				"type":      "function_call",
				"call_id":   "call_1",
				"name":      "lookup",
				"arguments": map[string]any{"q": "x"},
			},
		}),
		Tools: mustRawMessage(t, []map[string]any{
			{"type": "function", "name": "lookup", "parameters": map[string]any{"type": "object"}},
		}),
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatGemini, req)

	require.NoError(t, err)
	geminiReq, ok := result.Value.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.NotEmpty(t, geminiReq.Contents)
	model := geminiReq.Contents[0]
	if model.Role != "model" && len(geminiReq.Contents) > 1 {
		model = geminiReq.Contents[1]
	}
	require.Equal(t, "model", model.Role)
	require.Len(t, model.Parts, 1)
	require.NotNil(t, model.Parts[0].FunctionCall)
	assert.Empty(t, model.Parts[0].ThoughtSignature)
}

func TestConvertRequestOpenAIChatToGeminiAddsThoughtSignatureForAdvancedCustom(t *testing.T) {
	assistantMessage := dto.Message{Role: "assistant", Content: ""}
	assistantMessage.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "lookup",
				Arguments: `{"q":"x"}`,
			},
		},
	})
	info := &convmeta.Values{
		Options:             &convmeta.Options{Gemini: convmeta.GeminiOptions{FunctionCallThoughtSignatureEnabled: true}},
		ConversionChain:     []types.RelayFormat{types.RelayFormatOpenAI},
		ChannelMetaAttached: true,
		ChannelType:         58, // advanced-custom in the host
		UpstreamModelName:   "gemini-test",
	}
	req := &dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
			assistantMessage,
			{Role: "tool", ToolCallId: "call_1", Content: `{"ok":true}`},
		},
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:       "lookup",
					Parameters: map[string]any{"type": "object"},
				},
			},
		},
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatGemini, req)

	require.NoError(t, err)
	geminiReq, ok := result.Value.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, geminiReq.Contents, 3)
	assert.Equal(t, "model", geminiReq.Contents[1].Role)
	require.Len(t, geminiReq.Contents[1].Parts, 1)
	require.NotNil(t, geminiReq.Contents[1].Parts[0].FunctionCall)
	var thoughtSignature string
	require.NoError(t, kitutil.Unmarshal(geminiReq.Contents[1].Parts[0].ThoughtSignature, &thoughtSignature))
	assert.Equal(t, sharedgemini.ThoughtSignatureBypassValue, thoughtSignature)
}

func TestConvertRequestResponsesToClaudeUsesDirectConverter(t *testing.T) {
	info := &convmeta.Values{
		ConversionChain: []types.RelayFormat{types.RelayFormatOpenAIResponses},
	}
	stream := true
	parallelToolCalls := false
	maxOutputTokens := uint(512)
	req := &dto.OpenAIResponsesRequest{
		Model:             "claude-test",
		Instructions:      mustRawMessage(t, "system rules"),
		Stream:            &stream,
		MaxOutputTokens:   &maxOutputTokens,
		ParallelToolCalls: mustRawMessage(t, parallelToolCalls),
		Reasoning:         &dto.Reasoning{Effort: "medium"},
		Input: mustRawMessage(t, []map[string]any{
			{
				"role":    "user",
				"content": "question",
			},
			{
				"role": "assistant",
				"content": []map[string]any{
					{"type": "output_text", "text": "I will call."},
				},
			},
			{
				"type":      "function_call",
				"call_id":   "call_1",
				"name":      "lookup",
				"arguments": map[string]any{"q": "x"},
			},
			{
				"type":    "function_call_output",
				"call_id": "call_1",
				"output":  map[string]any{"ok": true},
			},
		}),
		Tools: mustRawMessage(t, []map[string]any{
			{
				"type":        "function",
				"name":        "lookup",
				"description": "Lookup data",
				"parameters": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"q": map[string]any{"type": "string"},
					},
				},
			},
		}),
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatClaude, req)

	require.NoError(t, err)
	claudeReq, ok := result.Value.(*dto.ClaudeRequest)
	require.True(t, ok)
	assert.Equal(t, requestConverterResponsesToClaude, result.Converter)
	assert.Equal(t, []RequestStep{
		{
			Converter: requestConverterResponsesToClaude,
			From:      types.RelayFormatOpenAIResponses,
			To:        types.RelayFormatClaude,
		},
	}, result.Steps)
	assert.Equal(t, []types.RelayFormat{types.RelayFormatOpenAIResponses, types.RelayFormatClaude}, info.ConversionChain)

	if claudeReq.IsStringSystem() {
		assert.Equal(t, "system rules", claudeReq.GetStringSystem())
	} else {
		system, err := kitutil.Any2Type[[]dto.ClaudeMediaMessage](claudeReq.System)
		require.NoError(t, err)
		require.Len(t, system, 1)
		assert.Equal(t, "system rules", system[0].GetText())
	}
	require.NotNil(t, claudeReq.Stream)
	assert.True(t, *claudeReq.Stream)
	assert.Equal(t, maxOutputTokens, *claudeReq.MaxTokens)
	require.NotNil(t, claudeReq.Thinking)
	assert.Equal(t, "adaptive", claudeReq.Thinking.Type)
	assert.Nil(t, claudeReq.Thinking.BudgetTokens)
	assert.JSONEq(t, `{"effort":"medium"}`, string(claudeReq.OutputConfig))

	tools, err := kitutil.Any2Type[[]*dto.Tool](claudeReq.Tools)
	require.NoError(t, err)
	require.Len(t, tools, 1)
	assert.Equal(t, "lookup", tools[0].Name)

	require.Len(t, claudeReq.Messages, 3)
	assert.Equal(t, "user", claudeReq.Messages[0].Role)
	userParts, err := claudeReq.Messages[0].ParseContent()
	require.NoError(t, err)
	require.Len(t, userParts, 1)
	assert.Equal(t, "question", userParts[0].GetText())

	assert.Equal(t, "assistant", claudeReq.Messages[1].Role)
	assistantParts, err := claudeReq.Messages[1].ParseContent()
	require.NoError(t, err)
	require.Len(t, assistantParts, 2)
	assert.Equal(t, "I will call.", assistantParts[0].GetText())
	assert.Equal(t, "tool_use", assistantParts[1].Type)
	assert.Equal(t, "call_1", assistantParts[1].Id)
	assert.Equal(t, "lookup", assistantParts[1].Name)
	assert.Equal(t, map[string]any{"q": "x"}, assistantParts[1].Input)

	assert.Equal(t, "user", claudeReq.Messages[2].Role)
	toolResultParts, err := claudeReq.Messages[2].ParseContent()
	require.NoError(t, err)
	require.Len(t, toolResultParts, 1)
	assert.Equal(t, "tool_result", toolResultParts[0].Type)
	assert.Equal(t, "call_1", toolResultParts[0].ToolUseId)
	assert.Equal(t, `{"ok":true}`, toolResultParts[0].Content)
}

func TestConvertRequestViaResponsesToGeminiStillUsesDirectSteps(t *testing.T) {
	info := &convmeta.Values{
		ConversionChain:     []types.RelayFormat{types.RelayFormatOpenAIResponses},
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-test",
	}
	req := &dto.OpenAIResponsesRequest{
		Model: "gemini-test",
		Input: mustRawMessage(t, []map[string]any{
			{
				"role":    "user",
				"content": "hello",
			},
		}),
	}

	result, err := ConvertRequestVia(nil, info, req, types.RelayFormatOpenAI, types.RelayFormatGemini)

	require.NoError(t, err)
	require.IsType(t, &dto.GeminiChatRequest{}, result.Value)
	assert.Equal(t, ConverterOpenAIResponsesToGemini, result.Converter)
	assert.Equal(t, []RequestStep{
		{
			Converter: ConverterOpenAIResponsesToGemini,
			From:      types.RelayFormatOpenAIResponses,
			To:        types.RelayFormatGemini,
		},
	}, result.Steps)
}

func TestConvertRequestDeduplicatesConversionChain(t *testing.T) {
	info := &convmeta.Values{
		ConversionChain: []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses},
	}
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "user", Content: "hello"},
		},
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatOpenAIResponses, req)

	require.NoError(t, err)
	require.IsType(t, &dto.OpenAIResponsesRequest{}, result.Value)
	require.Len(t, result.Steps, 1)
	assert.Equal(t, []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses}, info.ConversionChain)
}

func TestConvertRequestRejectsUnsupportedConverterAndNilRequest(t *testing.T) {
	_, err := ConvertRequest(nil, &convmeta.Values{}, types.RelayFormatOpenAIResponses, (*dto.GeneralOpenAIRequest)(nil))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "request is nil")
}

func TestConvertRequestRejectsUnregisteredExplicitPath(t *testing.T) {
	_, err := ConvertRequest(
		nil,
		&convmeta.Values{},
		types.RelayFormatEmbedding,
		&dto.ClaudeRequest{Model: "claude-test"},
	)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "from claude to embedding is not registered")
}

func mustRawMessage(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := kitutil.Marshal(value)
	require.NoError(t, err)
	return raw
}
