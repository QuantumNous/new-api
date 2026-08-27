package relayconvert

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/require"
)

// Standard API fixtures used as conversion stand-ins for each wire format.
const (
	standardChatModel      = "glm-5.2"
	standardResponsesModel = "gpt-5.6-sol"
	standardClaudeModel    = "minimax-m3"
	standardGeminiModel    = "gemini-3.7-flash"
)

var standardTextFormats = []types.RelayFormat{
	types.RelayFormatOpenAI,
	types.RelayFormatOpenAIResponses,
	types.RelayFormatClaude,
	types.RelayFormatGemini,
}

func standardModel(format types.RelayFormat) string {
	switch format {
	case types.RelayFormatOpenAIResponses:
		return standardResponsesModel
	case types.RelayFormatClaude:
		return standardClaudeModel
	case types.RelayFormatGemini:
		return standardGeminiModel
	default:
		return standardChatModel
	}
}

func TestStandardAPIFormatRequestMatrix(t *testing.T) {
	for _, from := range standardTextFormats {
		from := from
		t.Run(string(from), func(t *testing.T) {
			src := mustStandardThinkToolRequest(t, from)
			for _, to := range standardTextFormats {
				if from == to {
					continue
				}
				to := to
				t.Run("to_"+string(to), func(t *testing.T) {
					info := &convmeta.Values{
						IsStream:            true,
						ChannelMetaAttached: true,
						UpstreamModelName:   standardModel(to),
						ConversionChain:     []types.RelayFormat{from},
						Options: &convmeta.Options{
							Claude: convmeta.ClaudeOptions{
								DefaultMaxTokens: func(string) int { return 4096 },
							},
						},
					}
					result, err := ConvertRequest(context.Background(), info, to, src)
					require.NoError(t, err, "from=%s to=%s", from, to)
					require.Equal(t, from, result.From)
					require.Equal(t, to, result.To)
					assertStandardRequestShape(t, to, result.Value)
				})
			}
		})
	}
}

func TestStandardAPIFormatResponseMatrix(t *testing.T) {
	t.Parallel()
	for _, from := range standardTextFormats {
		from := from
		t.Run(string(from), func(t *testing.T) {
			t.Parallel()
			src := mustStandardThinkToolResponse(t, from)
			for _, to := range standardTextFormats {
				if from == to {
					continue
				}
				to := to
				t.Run("to_"+string(to), func(t *testing.T) {
					result, err := ConvertResponse(context.Background(), nil, to, src)
					require.NoError(t, err, "from=%s to=%s", from, to)
					assertStandardResponseShape(t, to, result.Value)
				})
			}
		})
	}
}

func TestStandardAPIStreamToResponsesHasItemID(t *testing.T) {
	t.Parallel()
	info := &convmeta.Values{
		IsStream:            true,
		ChannelMetaAttached: true,
		UpstreamModelName:   standardResponsesModel,
		ConversionChain:     []types.RelayFormat{types.RelayFormatOpenAI},
	}
	state, err := NewResponseStreamState(types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses, ResponseStreamOptions{
		ID:    "chatcmpl-matrix",
		Model: standardChatModel,
	})
	require.NoError(t, err)

	thinkChunk := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-matrix",
		Model: standardChatModel,
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{},
		}},
	}
	thinkChunk.Choices[0].Delta.SetReasoningContent("let me think")
	thinkResults, err := ConvertStreamResponseChunk(context.Background(), info, state, thinkChunk)
	require.NoError(t, err)

	textChunk := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-matrix",
		Model: standardChatModel,
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{},
		}},
	}
	textChunk.Choices[0].Delta.SetContentString("the answer")
	textResults, err := ConvertStreamResponseChunk(context.Background(), info, state, textChunk)
	require.NoError(t, err)

	var events []any
	for _, result := range append(thinkResults, textResults...) {
		events = append(events, streamValues(result.Value)...)
	}
	require.NotEmpty(t, events)
	itemIDs := map[string]string{}
	for _, event := range events {
		resp, ok := asResponsesStream(event)
		if !ok {
			continue
		}
		switch resp.Type {
		case "response.output_item.added":
			require.NotNil(t, resp.Item)
			require.NotEmpty(t, resp.Item.ID)
			itemIDs[resp.Item.Type] = resp.Item.ID
			require.Equal(t, resp.Item.ID, resp.ItemID)
		case "response.reasoning_summary_text.delta", "response.output_text.delta":
			require.NotEmpty(t, resp.ItemID)
		}
	}
	require.NotEmpty(t, itemIDs["reasoning"], "thinking must open a reasoning item")
	require.NotEmpty(t, itemIDs["message"], "text must open a message item")
}

func TestResponsesDeveloperProjectsToChatSystem(t *testing.T) {
	request := &dto.OpenAIResponsesRequest{
		Model: standardResponsesModel,
		Input: mustJSON(t, []map[string]any{
			{"role": "developer", "content": "Follow the deployment policy."},
			{"role": "user", "content": "hello"},
		}),
	}
	result, err := ConvertRequest(context.Background(), &convmeta.Values{
		ChannelMetaAttached: true,
		UpstreamModelName:   standardChatModel,
	}, types.RelayFormatOpenAI, request)
	require.NoError(t, err)
	chat := result.Value.(*dto.GeneralOpenAIRequest)
	require.Len(t, chat.Messages, 2)
	require.Equal(t, "system", chat.Messages[0].Role)
	require.Equal(t, "Follow the deployment policy.", chat.Messages[0].StringContent())
	summary, err := SummarizeRequestConversion(result.From, result.To, request, result.Value, result.Report)
	require.NoError(t, err)
	require.Equal(t, []string{"developer", "user"}, summary.SourceRoles)
	require.Equal(t, []string{"system", "user"}, summary.TargetRoles)

	native, err := ConvertRequest(context.Background(), nil, types.RelayFormatOpenAIResponses, request)
	require.NoError(t, err)
	require.Same(t, request, native.Value)
	require.Contains(t, string(request.Input), `"developer"`)
}

func TestStandardAPIPDFConversionMatrix(t *testing.T) {
	const pdfBase64 = "JVBERi0xLjQKMSAwIG9iago8PD4+CmVuZG9iago="
	const pdfDataURL = "data:application/pdf;base64," + pdfBase64

	newInfo := func(target types.RelayFormat) *convmeta.Values {
		return &convmeta.Values{
			ChannelMetaAttached: true,
			UpstreamModelName:   standardModel(target),
			Options: &convmeta.Options{Claude: convmeta.ClaudeOptions{
				DefaultMaxTokens: func(string) int { return 4096 },
			}},
		}
	}
	newChatRequest := func() *dto.GeneralOpenAIRequest {
		return &dto.GeneralOpenAIRequest{
			Model: standardChatModel,
			Messages: []dto.Message{{Role: "user", Content: []any{
				map[string]any{"type": "text", "text": "read the document"},
				map[string]any{"type": "file", "file": map[string]any{
					"filename":  "matrix-document.pdf",
					"file_data": pdfDataURL,
				}},
			}}},
		}
	}

	t.Run("chat to responses", func(t *testing.T) {
		result, err := ConvertRequest(context.Background(), newInfo(types.RelayFormatOpenAIResponses), types.RelayFormatOpenAIResponses, newChatRequest())
		require.NoError(t, err)
		file := responsesFilePart(t, result.Value.(*dto.OpenAIResponsesRequest))
		require.Equal(t, "matrix-document.pdf", file["filename"])
		require.Equal(t, pdfDataURL, file["file_data"])
		assertPDFBytes(t, file["file_data"].(string), pdfBase64)
		require.NotContains(t, file, "file_url")
		require.NotContains(t, file, "file_id")
		summary, err := SummarizeRequestConversion(result.From, result.To, newChatRequest(), result.Value, result.Report)
		require.NoError(t, err)
		require.Len(t, summary.Media, 1)
		require.Equal(t, "application/pdf", summary.Media[0].MIME)
		require.NotEmpty(t, summary.Media[0].SHA256)
		summaryJSON, err := json.Marshal(summary)
		require.NoError(t, err)
		require.NotContains(t, string(summaryJSON), pdfBase64)
		require.NotContains(t, string(summaryJSON), "read the document")
	})

	t.Run("chat to claude", func(t *testing.T) {
		result, err := ConvertRequest(context.Background(), newInfo(types.RelayFormatClaude), types.RelayFormatClaude, newChatRequest())
		require.NoError(t, err)
		request := result.Value.(*dto.ClaudeRequest)
		content := request.Messages[0].Content.([]any)
		document := content[1].(map[string]any)
		source := document["source"].(map[string]any)
		require.Equal(t, "document", document["type"])
		require.Equal(t, "base64", source["type"])
		require.Equal(t, "application/pdf", source["media_type"])
		require.Equal(t, pdfBase64, source["data"])
		require.NotContains(t, source["data"].(string), "data:")
	})

	t.Run("chat to gemini", func(t *testing.T) {
		result, err := ConvertRequest(context.Background(), newInfo(types.RelayFormatGemini), types.RelayFormatGemini, newChatRequest())
		require.NoError(t, err)
		request := result.Value.(*dto.GeminiChatRequest)
		require.NotNil(t, request.Contents[0].Parts[1].InlineData)
		require.Equal(t, "application/pdf", request.Contents[0].Parts[1].InlineData.MimeType)
		require.Equal(t, pdfBase64, request.Contents[0].Parts[1].InlineData.Data)
		require.NotContains(t, request.Contents[0].Parts[1].InlineData.Data, "data:")
	})

	responsesRequest := func() *dto.OpenAIResponsesRequest {
		return &dto.OpenAIResponsesRequest{
			Model: standardResponsesModel,
			Input: mustJSON(t, []map[string]any{{
				"role": "user",
				"content": []map[string]any{{
					"type":      "input_file",
					"filename":  "matrix-document.pdf",
					"file_data": pdfDataURL,
				}},
			}}),
		}
	}

	for _, target := range []types.RelayFormat{types.RelayFormatClaude, types.RelayFormatGemini} {
		target := target
		t.Run("responses to "+string(target), func(t *testing.T) {
			result, err := ConvertRequest(context.Background(), newInfo(target), target, responsesRequest())
			require.NoError(t, err)
			raw, err := json.Marshal(result.Value)
			require.NoError(t, err)
			require.Contains(t, string(raw), pdfBase64)
			require.NotContains(t, string(raw), pdfDataURL)
			require.Contains(t, string(raw), "application/pdf")
		})
	}

	t.Run("claude to responses", func(t *testing.T) {
		request := &dto.ClaudeRequest{
			Model: standardClaudeModel,
			Messages: []dto.ClaudeMessage{{Role: "user", Content: []any{map[string]any{
				"type":   "document",
				"source": map[string]any{"type": "base64", "media_type": "application/pdf", "data": pdfBase64},
			}}}},
		}
		result, err := ConvertRequest(context.Background(), newInfo(types.RelayFormatOpenAIResponses), types.RelayFormatOpenAIResponses, request)
		require.NoError(t, err)
		file := responsesFilePart(t, result.Value.(*dto.OpenAIResponsesRequest))
		require.Equal(t, "document.pdf", file["filename"])
		require.Equal(t, pdfDataURL, file["file_data"])
	})

	t.Run("gemini to responses", func(t *testing.T) {
		request := &dto.GeminiChatRequest{Contents: []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{
			InlineData: &dto.GeminiInlineData{MimeType: "application/pdf", Data: pdfBase64},
		}}}}}
		result, err := ConvertRequest(context.Background(), newInfo(types.RelayFormatOpenAIResponses), types.RelayFormatOpenAIResponses, request)
		require.NoError(t, err)
		file := responsesFilePart(t, result.Value.(*dto.OpenAIResponsesRequest))
		require.Equal(t, "document.pdf", file["filename"])
		require.Equal(t, pdfDataURL, file["file_data"])
	})
}

func TestChatProtocolRejectsPDFFromEverySourceFormat(t *testing.T) {
	t.Parallel()
	const fileData = "JVBERi0xLjQ="
	cases := []struct {
		name    string
		from    types.RelayFormat
		request any
	}{
		{
			name: "chat",
			from: types.RelayFormatOpenAI,
			request: &dto.GeneralOpenAIRequest{
				Model: "generic-chat-model",
				Messages: []dto.Message{{Role: "user", Content: []any{map[string]any{
					"type": "file",
					"file": map[string]any{
						"filename":  "matrix-document.pdf",
						"file_data": "data:application/pdf;base64," + fileData,
					},
				}}}},
			},
		},
		{
			name: "responses",
			from: types.RelayFormatOpenAIResponses,
			request: &dto.OpenAIResponsesRequest{
				Model: "generic-chat-model",
				Input: json.RawMessage(`[{"role":"user","content":[{"type":"input_file","filename":"matrix-document.pdf","file_data":"data:application/pdf;base64,JVBERi0xLjQ="}]}]`),
			},
		},
		{
			name: "claude",
			from: types.RelayFormatClaude,
			request: &dto.ClaudeRequest{
				Model: "generic-chat-model",
				Messages: []dto.ClaudeMessage{{Role: "user", Content: []any{map[string]any{
					"type":   "document",
					"source": map[string]any{"type": "base64", "media_type": "application/pdf", "data": fileData},
				}}}},
			},
		},
		{
			name: "gemini",
			from: types.RelayFormatGemini,
			request: &dto.GeminiChatRequest{Contents: []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{
				InlineData: &dto.GeminiInlineData{MimeType: "application/pdf", Data: fileData},
			}}}}},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			info := &convmeta.Values{ChannelMetaAttached: true, UpstreamModelName: "generic-chat-model"}
			_, err := ConvertRequest(context.Background(), info, types.RelayFormatOpenAI, tc.request)
			require.Error(t, err)
			var apiErr *types.NewAPIError
			require.ErrorAs(t, err, &apiErr)
			require.Equal(t, types.ErrorCodeCapabilityUnsupported, apiErr.GetErrorCode())
			require.Equal(t, 400, apiErr.StatusCode)
			require.ErrorContains(t, apiErr, "Chat Completions protocol")
		})
	}
}

func TestPDFLocatorConflictIsRejected(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{Role: "user", Content: []any{map[string]any{
			"type": "file",
			"file": map[string]any{
				"filename":  "matrix-document.pdf",
				"file_data": "data:application/pdf;base64,JVBERi0xLjQ=",
				"file_id":   "file_123",
			},
		}}}},
	}
	_, err := ConvertRequest(context.Background(), nil, types.RelayFormatOpenAIResponses, request)
	require.ErrorContains(t, err, "exactly one")
}

func responsesFilePart(t *testing.T, request *dto.OpenAIResponsesRequest) map[string]any {
	t.Helper()
	var items []map[string]any
	require.NoError(t, json.Unmarshal(request.Input, &items))
	for _, item := range items {
		content, ok := item["content"].([]any)
		if !ok {
			continue
		}
		for _, value := range content {
			part, ok := value.(map[string]any)
			if ok && part["type"] == "input_file" {
				return part
			}
		}
	}
	t.Fatal("missing Responses input_file part")
	return nil
}

func assertPDFBytes(t *testing.T, dataURL, expectedBase64 string) {
	t.Helper()
	parts := strings.SplitN(dataURL, ",", 2)
	require.Len(t, parts, 2)
	actual, err := base64.StdEncoding.DecodeString(parts[1])
	require.NoError(t, err)
	expected, err := base64.StdEncoding.DecodeString(expectedBase64)
	require.NoError(t, err)
	require.Equal(t, expected, actual)
}

func TestStandardAPIResponsesStatefulRejected(t *testing.T) {
	t.Parallel()
	req := &dto.OpenAIResponsesRequest{
		Model:              standardResponsesModel,
		PreviousResponseID: "resp_abc",
		Input:              json.RawMessage(`"hello"`),
	}
	_, err := ConvertRequest(context.Background(), nil, types.RelayFormatOpenAI, req)
	require.Error(t, err)
	require.Contains(t, err.Error(), "previous_response_id")
}

func mustStandardThinkToolRequest(t *testing.T, format types.RelayFormat) any {
	t.Helper()
	switch format {
	case types.RelayFormatOpenAI:
		reasoning := "secret chain"
		assistant := dto.Message{Role: "assistant", ReasoningContent: &reasoning}
		assistant.SetToolCalls([]dto.ToolCallRequest{{
			ID:   "call_weather",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "get_weather",
				Arguments: `{"city":"Paris"}`,
			},
		}})
		return &dto.GeneralOpenAIRequest{
			Model: standardChatModel,
			Messages: []dto.Message{
				{Role: "user", Content: "What is the weather in Paris?"},
				assistant,
				{Role: "tool", ToolCallId: "call_weather", Content: `{"ok":true,"temp":15}`},
			},
			Tools: []dto.ToolCallRequest{{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:        "get_weather",
					Description: "Get weather by city",
					Parameters: map[string]any{
						"type":       "object",
						"properties": map[string]any{"city": map[string]any{"type": "string"}},
						"required":   []any{"city"},
					},
				},
			}},
		}
	case types.RelayFormatClaude:
		thinking := "secret chain"
		text := "I will look it up."
		return &dto.ClaudeRequest{
			Model:     standardClaudeModel,
			MaxTokens: uintPtr(1024),
			Messages: []dto.ClaudeMessage{
				{Role: "user", Content: []map[string]any{
					{"type": "text", "text": "What is the weather in Paris?", "cache_control": map[string]any{"type": "ephemeral", "ttl": "1h"}},
				}},
				{Role: "assistant", Content: []map[string]any{
					{"type": "thinking", "thinking": thinking, "signature": "sig-1"},
					{"type": "text", "text": text},
					{"type": "tool_use", "id": "toolu_weather", "name": "get_weather", "input": map[string]any{"city": "Paris"}},
				}},
				{Role: "user", Content: []map[string]any{
					{"type": "tool_result", "tool_use_id": "toolu_weather", "content": `{"ok":true,"temp":15}`},
				}},
			},
			Tools: []map[string]any{{
				"name":         "get_weather",
				"description":  "Get weather by city",
				"input_schema": map[string]any{"type": "object", "properties": map[string]any{"city": map[string]any{"type": "string"}}},
			}},
		}
	case types.RelayFormatOpenAIResponses:
		return &dto.OpenAIResponsesRequest{
			Model: standardResponsesModel,
			Input: mustJSON(t, []map[string]any{
				{"type": "message", "role": "user", "content": "What is the weather in Paris?"},
				{"type": "reasoning", "summary": []map[string]any{{"type": "summary_text", "text": "secret chain"}}},
				{"type": "message", "role": "assistant", "content": []map[string]any{{"type": "output_text", "text": "I will look it up."}}},
				{"type": "function_call", "call_id": "call_weather", "id": "fc_weather", "name": "get_weather", "arguments": `{"city":"Paris"}`},
				{"type": "function_call_output", "call_id": "call_weather", "output": `{"ok":true,"temp":15}`},
			}),
			Tools: mustJSON(t, []map[string]any{{
				"type": "function", "name": "get_weather", "description": "Get weather by city",
				"parameters": map[string]any{"type": "object", "properties": map[string]any{"city": map[string]any{"type": "string"}}},
			}}),
		}
	case types.RelayFormatGemini:
		return &dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{Role: "user", Parts: []dto.GeminiPart{{Text: "What is the weather in Paris?"}}},
				{Role: "model", Parts: []dto.GeminiPart{
					{Text: "secret chain", Thought: true},
					{Text: "I will look it up."},
					{FunctionCall: &dto.FunctionCall{FunctionName: "get_weather", Arguments: map[string]any{"city": "Paris"}}},
				}},
				{Role: "user", Parts: []dto.GeminiPart{
					{FunctionResponse: &dto.GeminiFunctionResponse{Name: "get_weather", Response: map[string]any{"ok": true, "temp": 15}}},
				}},
			},
			Tools: json.RawMessage(`[{"functionDeclarations":[{"name":"get_weather","description":"Get weather by city","parameters":{"type":"object","properties":{"city":{"type":"string"}}}}]}]`),
		}
	default:
		t.Fatalf("unknown format %s", format)
		return nil
	}
}

func mustStandardThinkToolResponse(t *testing.T, format types.RelayFormat) any {
	t.Helper()
	switch format {
	case types.RelayFormatOpenAI:
		reasoning := "secret chain"
		msg := dto.Message{Role: "assistant", Content: "15 degrees", ReasoningContent: &reasoning}
		msg.SetToolCalls([]dto.ToolCallRequest{{
			ID: "call_weather", Type: "function",
			Function: dto.FunctionRequest{Name: "get_weather", Arguments: `{"city":"Paris"}`},
		}})
		return &dto.OpenAITextResponse{
			Id:    "chatcmpl-matrix",
			Model: standardChatModel,
			Choices: []dto.OpenAITextResponseChoice{{
				Message:      msg,
				FinishReason: "tool_calls",
			}},
			Usage: dto.Usage{PromptTokens: 10, CompletionTokens: 8, TotalTokens: 18},
		}
	case types.RelayFormatClaude:
		thinking := "secret chain"
		text := "15 degrees"
		return &dto.ClaudeResponse{
			Id:    "msg_matrix",
			Type:  "message",
			Role:  "assistant",
			Model: standardClaudeModel,
			Content: []dto.ClaudeMediaMessage{
				{Type: "thinking", Thinking: &thinking, Signature: "sig-1"},
				{Type: "text", Text: &text},
				{Type: "tool_use", Id: "toolu_weather", Name: "get_weather", Input: map[string]any{"city": "Paris"}},
			},
			Usage: &dto.ClaudeUsage{InputTokens: 10, OutputTokens: 8},
		}
	case types.RelayFormatOpenAIResponses:
		return &dto.OpenAIResponsesResponse{
			ID:    "resp_matrix",
			Model: standardResponsesModel,
			Output: []dto.ResponsesOutput{
				{Type: "reasoning", ID: "rs_1", Status: "completed", Summary: []dto.ResponsesReasoningSummaryPart{{Type: "summary_text", Text: "secret chain"}}},
				{Type: "message", ID: "msg_1", Status: "completed", Role: "assistant", Content: []dto.ResponsesOutputContent{{Type: "output_text", Text: "15 degrees"}}},
				{Type: "function_call", ID: "fc_weather", CallId: "call_weather", Name: "get_weather", Status: "completed", Arguments: json.RawMessage(`{"city":"Paris"}`)},
			},
			Usage: &dto.Usage{InputTokens: 10, OutputTokens: 8, TotalTokens: 18},
		}
	case types.RelayFormatGemini:
		stop := "STOP"
		return &dto.GeminiChatResponse{
			Candidates: []dto.GeminiChatCandidate{{
				Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{
					{Text: "secret chain", Thought: true},
					{Text: "15 degrees"},
					{FunctionCall: &dto.FunctionCall{FunctionName: "get_weather", Arguments: map[string]any{"city": "Paris"}}},
				}},
				FinishReason: &stop,
			}},
			UsageMetadata: dto.GeminiUsageMetadata{PromptTokenCount: 10, CandidatesTokenCount: 8, ThoughtsTokenCount: 3, TotalTokenCount: 21},
		}
	default:
		t.Fatalf("unknown format %s", format)
		return nil
	}
}

func assertStandardRequestShape(t *testing.T, to types.RelayFormat, value any) {
	t.Helper()
	raw, err := json.Marshal(value)
	require.NoError(t, err)
	body := string(raw)
	switch to {
	case types.RelayFormatOpenAI:
		req, ok := value.(*dto.GeneralOpenAIRequest)
		require.True(t, ok)
		require.NotEmpty(t, req.Messages)
		require.NotNil(t, req.Stream)
		require.True(t, *req.Stream, "Gemini/Claude stream must set Chat stream=true")
		require.NotContains(t, body, `"cache_control"`)
		for _, msg := range req.Messages {
			if msg.Role == "user" || msg.Role == "system" {
				if _, isString := msg.Content.(string); !isString && msg.Content != nil {
					if hasOnlyTextParts(msg.Content) {
						t.Fatalf("text-only Chat content must be string, got %T %s", msg.Content, mustJSONString(t, msg.Content))
					}
				}
			}
			if msg.Role == "tool" {
				text, _ := msg.Content.(string)
				require.NotContains(t, mustJSONString(t, msg.Content), `"content":{"ok"`)
				require.True(t, strings.Contains(text, `"ok"`) || strings.Contains(mustJSONString(t, msg.Content), `ok`), "tool result should keep JSON text")
			}
		}
	case types.RelayFormatOpenAIResponses:
		req, ok := value.(*dto.OpenAIResponsesRequest)
		require.True(t, ok)
		if req.Stream == nil || !*req.Stream {
			t.Fatalf("responses stream flag missing, body=%s", body)
		}
		require.NotEmpty(t, req.Input, "responses input missing, body=%s", body)
		items := decodeJSONArray(t, req.Input)
		typesFound := itemTypes(items)
		require.Contains(t, typesFound, "reasoning", "thinking must become a reasoning item, got %v body=%s", typesFound, body)
		require.Contains(t, typesFound, "function_call", "tool use must become function_call, got %v", typesFound)
		for _, item := range items {
			if item["type"] == "function_call" {
				require.NotEmpty(t, item["call_id"])
				require.NotEmpty(t, item["id"])
			}
		}
	case types.RelayFormatClaude:
		req, ok := value.(*dto.ClaudeRequest)
		require.True(t, ok)
		require.NotEmpty(t, req.Messages)
		require.NotContains(t, body, `"content":{"ok":true}`)
		require.Contains(t, body, `get_weather`)
	case types.RelayFormatGemini:
		req, ok := value.(*dto.GeminiChatRequest)
		require.True(t, ok)
		require.NotEmpty(t, req.Contents)
		require.Equal(t, "user", req.Contents[0].Role, "Gemini contents must start with user")
		require.Contains(t, body, `get_weather`)
	}
}

func assertStandardResponseShape(t *testing.T, to types.RelayFormat, value any) {
	t.Helper()
	raw, err := json.Marshal(value)
	require.NoError(t, err)
	body := string(raw)
	switch to {
	case types.RelayFormatOpenAI:
		resp, ok := value.(*dto.OpenAITextResponse)
		require.True(t, ok)
		require.NotEmpty(t, resp.Choices)
		msg := resp.Choices[0].Message
		require.NotEmpty(t, msg.GetReasoningContent(), "thinking must map to reasoning_content")
		require.NotEmpty(t, msg.ParseToolCalls(), "tool_use must map to tool_calls")
	case types.RelayFormatOpenAIResponses:
		resp, ok := value.(*dto.OpenAIResponsesResponse)
		require.True(t, ok)
		var typesFound []string
		for _, item := range resp.Output {
			typesFound = append(typesFound, item.Type)
			if item.Type == "function_call" {
				require.NotEmpty(t, item.CallId)
				require.NotEmpty(t, item.ID)
			}
			if item.Type == "message" || item.Type == "reasoning" {
				require.NotEmpty(t, item.ID)
			}
		}
		require.Contains(t, typesFound, "reasoning")
		require.Contains(t, typesFound, "function_call")
	case types.RelayFormatClaude:
		resp, ok := value.(*dto.ClaudeResponse)
		require.True(t, ok)
		var typesFound []string
		for _, block := range resp.Content {
			typesFound = append(typesFound, block.Type)
		}
		require.Contains(t, typesFound, "thinking")
		require.Contains(t, typesFound, "tool_use")
	case types.RelayFormatGemini:
		resp, ok := value.(*dto.GeminiChatResponse)
		require.True(t, ok)
		require.NotEmpty(t, resp.Candidates)
		require.NotEmpty(t, resp.Candidates[0].Content.Parts)
		require.Contains(t, body, "get_weather")
	}
}

func hasOnlyTextParts(content any) bool {
	items, ok := content.([]any)
	if !ok {
		raw, err := json.Marshal(content)
		if err != nil {
			return false
		}
		if err := json.Unmarshal(raw, &items); err != nil {
			return false
		}
	}
	if len(items) == 0 {
		return false
	}
	for _, item := range items {
		m, ok := item.(map[string]any)
		if !ok {
			return false
		}
		typ, _ := m["type"].(string)
		if typ != "" && typ != "text" {
			return false
		}
	}
	return true
}

func decodeJSONArray(t *testing.T, raw json.RawMessage) []map[string]any {
	t.Helper()
	var items []map[string]any
	require.NoError(t, json.Unmarshal(raw, &items))
	return items
}

func itemTypes(items []map[string]any) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		if typ, _ := item["type"].(string); typ != "" {
			out = append(out, typ)
		}
	}
	return out
}

func streamValues(value any) []any {
	switch typed := value.(type) {
	case nil:
		return nil
	case []any:
		var out []any
		for _, item := range typed {
			out = append(out, streamValues(item)...)
		}
		return out
	case []dto.ResponsesStreamResponse:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			out = append(out, item)
		}
		return out
	case []ChatToResponsesStreamEvent:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			out = append(out, item.Payload)
		}
		return out
	case ChatToResponsesStreamEvent:
		return []any{typed.Payload}
	case dto.ResponsesStreamResponse, *dto.ResponsesStreamResponse:
		return []any{typed}
	default:
		return []any{value}
	}
}

func asResponsesStream(value any) (dto.ResponsesStreamResponse, bool) {
	switch typed := value.(type) {
	case dto.ResponsesStreamResponse:
		return typed, true
	case *dto.ResponsesStreamResponse:
		if typed == nil {
			return dto.ResponsesStreamResponse{}, false
		}
		return *typed, true
	case ChatToResponsesStreamEvent:
		return typed.Payload, true
	default:
		return dto.ResponsesStreamResponse{}, false
	}
}

func mustJSON(t *testing.T, v any) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	return raw
}

func mustJSONString(t *testing.T, v any) string {
	t.Helper()
	return string(mustJSON(t, v))
}

func uintPtr(v uint) *uint { return &v }
