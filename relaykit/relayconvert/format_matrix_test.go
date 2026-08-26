package relayconvert

import (
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
	standardClaudeModel    = "MiniMax-M3-福利"
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
					result, err := ConvertRequest(nil, info, to, src)
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
					result, err := ConvertResponse(nil, nil, to, src)
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
	thinkResults, err := ConvertStreamResponseChunk(nil, info, state, thinkChunk)
	require.NoError(t, err)

	textChunk := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-matrix",
		Model: standardChatModel,
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{},
		}},
	}
	textChunk.Choices[0].Delta.SetContentString("the answer")
	textResults, err := ConvertStreamResponseChunk(nil, info, state, textChunk)
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

func TestStandardAPIResponsesStatefulRejected(t *testing.T) {
	t.Parallel()
	req := &dto.OpenAIResponsesRequest{
		Model:              standardResponsesModel,
		PreviousResponseID: "resp_abc",
		Input:              json.RawMessage(`"hello"`),
	}
	_, err := ConvertRequest(nil, nil, types.RelayFormatOpenAI, req)
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
