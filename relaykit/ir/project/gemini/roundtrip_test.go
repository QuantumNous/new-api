package gemini

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/stretchr/testify/require"
)

func TestRequestRoundtripGoldenFixture(t *testing.T) {
	t.Parallel()
	req := unmarshalGeminiRequest(t, `{
		"contents": [
			{"role": "user", "parts": [
				{"text": "What is in this image?"},
				{"inlineData": {"mimeType": "image/png", "data": "aGVsbG8="}}
			]},
			{"role": "model", "parts": [{"functionCall": {"name": "get_weather", "args": {"city": "Paris"}}}]},
			{"role": "user", "parts": [{"functionResponse": {"name": "get_weather", "response": {"result": "15 degrees"}}}]}
		],
		"systemInstruction": {"parts": [{"text": "You are a helpful assistant."}]},
		"tools": [{"functionDeclarations": [{"name": "get_weather", "description": "Get weather by city", "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}]}],
		"generationConfig": {"maxOutputTokens": 1024, "temperature": 0.7}
	}`)
	irReq := roundtripRequest(t, req)
	require.Equal(t, ir.RoleSystem, irReq.Messages[0].Role)
	require.Equal(t, 0.7, *irReq.Sample.Temperature)
	require.Equal(t, 1024, *irReq.Sample.MaxOutputTokens)
	require.Equal(t, "get_weather", irReq.Tools[0].Name)
	require.Equal(t, "get_weather", irReq.Messages[2].Blocks[0].ToolUse.Name)
}

func TestToRequestSplitsFunctionResponseFromFollowupText(t *testing.T) {
	t.Parallel()
	result := ir.ToolResult("call_1", []ir.Block{ir.Text(`{"temp_c":18}`)})
	result.ToolResult.Name = "get_weather"
	irReq := &ir.Request{
		Messages: []ir.Message{
			{Role: ir.RoleUser, Blocks: []ir.Block{ir.Text("Call get_weather")}},
			{Role: ir.RoleAssistant, Blocks: []ir.Block{ir.ToolUse("call_1", "get_weather", json.RawMessage(`{"city":"Paris"}`))}},
			{Role: ir.RoleUser, Blocks: []ir.Block{
				result,
				ir.Text("工具结果已经给你了。现在请回答停车费谁亏谁赚？"),
			}},
		},
	}
	out, err := ToRequest(irReq)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(out.Contents), 4)
	last := out.Contents[len(out.Contents)-1]
	prev := out.Contents[len(out.Contents)-2]
	require.NotNil(t, prev.Parts[0].FunctionResponse)
	require.Equal(t, "get_weather", prev.Parts[0].FunctionResponse.Name)
	require.Equal(t, "工具结果已经给你了。现在请回答停车费谁亏谁赚？", last.Parts[0].Text)
	require.Nil(t, last.Parts[0].FunctionResponse)
}

func TestRequestRoundtripThoughtSignature(t *testing.T) {
	t.Parallel()
	req := unmarshalGeminiRequest(t, `{
		"contents": [{
			"role": "model",
			"parts": [{
				"functionCall": {"name": "lookup", "args": {"q": "x"}},
				"thoughtSignature": "c2ln"
			}]
		}]
	}`)
	irReq := roundtripRequest(t, req)
	require.Equal(t, []byte(`"c2ln"`), irReq.Messages[0].Blocks[0].ToolUse.ProviderSig)
}

func TestResponseRoundtripGoldenFixture(t *testing.T) {
	t.Parallel()
	resp := unmarshalGeminiResponse(t, `{
		"candidates": [{
			"finishReason": "STOP",
			"content": {
				"role": "model",
				"parts": [
					{"text": "The answer is 42."},
					{"functionCall": {"name": "get_weather", "args": {"city": "Paris"}}}
				]
			}
		}],
		"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5, "thoughtsTokenCount": 2, "totalTokenCount": 15}
	}`)
	irResp := roundtripResponse(t, resp)
	require.Equal(t, ir.FinishStop, irResp.Finish)
	require.Equal(t, "The answer is 42.", irResp.Blocks[0].Text.Text)
	require.Equal(t, "get_weather", irResp.Blocks[1].ToolUse.Name)
	require.Equal(t, 2, irResp.Usage.Thought)
}

func TestThinkingConfigUsesNativeLevelForGemini3(t *testing.T) {
	t.Parallel()
	out, err := ToRequest(&ir.Request{
		Model: "gemini-3.7-pro",
		Think: &ir.ThinkConfig{
			Mode:    ir.ThinkEnabled,
			Level:   "xhigh",
			Include: boolPointer(true),
			Display: ir.ThinkDisplayAuto,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, out.GenerationConfig.ThinkingConfig)
	require.Equal(t, "HIGH", out.GenerationConfig.ThinkingConfig.ThinkingLevel)
	require.Nil(t, out.GenerationConfig.ThinkingConfig.ThinkingBudget)
	require.True(t, out.GenerationConfig.ThinkingConfig.IncludeThoughts)
}

func TestThinkingConfigMapsBudgetToNativeLevelForGemini3(t *testing.T) {
	t.Parallel()
	budget := 2048
	out, err := ToRequest(&ir.Request{
		Model: "gemini-3.7-flash",
		Think: &ir.ThinkConfig{
			Mode:    ir.ThinkEnabled,
			Budget:  &budget,
			Include: boolPointer(true),
			Display: ir.ThinkDisplayAuto,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, out.GenerationConfig.ThinkingConfig)
	require.Equal(t, "HIGH", out.GenerationConfig.ThinkingConfig.ThinkingLevel)
	require.Nil(t, out.GenerationConfig.ThinkingConfig.ThinkingBudget)
	require.True(t, out.GenerationConfig.ThinkingConfig.IncludeThoughts)
}

func TestThinkingConfigUsesDynamicBudgetForGemini25(t *testing.T) {
	t.Parallel()
	out, err := ToRequest(&ir.Request{
		Model: "gemini-2.5-pro",
		Think: &ir.ThinkConfig{Mode: ir.ThinkEnabled, Level: "high", Include: boolPointer(true)},
	})
	require.NoError(t, err)
	require.NotNil(t, out.GenerationConfig.ThinkingConfig)
	require.Empty(t, out.GenerationConfig.ThinkingConfig.ThinkingLevel)
	require.NotNil(t, out.GenerationConfig.ThinkingConfig.ThinkingBudget)
	require.Equal(t, -1, *out.GenerationConfig.ThinkingConfig.ThinkingBudget)
}

func TestThinkingConfigDisabledNeverSerializesEmptyObject(t *testing.T) {
	t.Parallel()
	out, err := ToRequest(&ir.Request{
		Model: "gemini-3.7-pro",
		Think: &ir.ThinkConfig{Mode: ir.ThinkOff, Display: ir.ThinkDisplayHidden},
	})
	require.NoError(t, err)
	raw, err := json.Marshal(out)
	require.NoError(t, err)
	require.NotContains(t, string(raw), `"thinkingConfig":{}`)
	require.Contains(t, string(raw), `"thinkingLevel":"MINIMAL"`)
}

func TestFromRequestNormalizesGeminiThinkingLevelCasing(t *testing.T) {
	t.Parallel()
	for _, level := range []string{"HIGH", "high", "High"} {
		req := &dto.GeminiChatRequest{GenerationConfig: dto.GeminiChatGenerationConfig{
			ThinkingConfig: &dto.GeminiThinkingConfig{ThinkingLevel: level},
		}}
		got, err := FromRequest(req)
		require.NoError(t, err)
		require.Equal(t, "high", got.Think.Level)
	}
}

func TestToStreamBuffersFunctionCallJSON(t *testing.T) {
	t.Parallel()
	state := ir.NewStreamState("g1", "gemini-test")
	start, err := ToStream([]ir.Event{
		{Kind: ir.EventStart, ID: "g1", Model: "gemini-test"},
		{Kind: ir.EventBlockStart, Index: 0, Block: &ir.Block{
			Kind:    ir.BlockKindToolUse,
			ToolUse: &ir.ToolUseBlock{Name: "get_weather"},
		}},
		{Kind: ir.EventBlockDelta, Index: 0, Delta: &ir.BlockDelta{JSON: `{"city":`}},
	}, state)
	require.NoError(t, err)
	require.False(t, geminiStreamHasFunctionCall(t, start))

	done, err := ToStream([]ir.Event{
		{Kind: ir.EventBlockDelta, Index: 0, Delta: &ir.BlockDelta{JSON: `"Paris"}`}},
		{Kind: ir.EventBlockStop, Index: 0},
	}, state)
	require.NoError(t, err)
	calls := geminiStreamFunctionCalls(t, done)
	require.Len(t, calls, 1)
	require.Equal(t, "get_weather", calls[0].FunctionName)
	require.Equal(t, map[string]any{"city": "Paris"}, calls[0].Arguments)
}

func TestToStreamUsesLatestCompleteToolSnapshotAtStop(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		fragments []string
		want      string
	}{
		{name: "empty then complete snapshot", fragments: []string{`{}`, `{"code":"1+1"}`}, want: `{"code":"1+1"}`},
		{name: "cumulative snapshot", fragments: []string{`{"code":`, `{"code":"1+1"}`}, want: `{"code":"1+1"}`},
		{name: "standard deltas", fragments: []string{`{"code":`, `"1+1"}`}, want: `{"code":"1+1"}`},
		{name: "legitimate empty args", fragments: []string{`{}`}, want: `{}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := ir.NewStreamState("g1", "gemini-test")
			var chunks []any
			start, err := ToStream([]ir.Event{{
				Kind:  ir.EventBlockStart,
				Index: 0,
				Block: &ir.Block{Kind: ir.BlockKindToolUse, ToolUse: &ir.ToolUseBlock{ID: "call_1", Name: "eval_javascript"}},
			}}, state)
			require.NoError(t, err)
			chunks = append(chunks, start...)
			for _, fragment := range tt.fragments {
				out, err := ToStream([]ir.Event{{Kind: ir.EventBlockDelta, Index: 0, Delta: &ir.BlockDelta{JSON: fragment}}}, state)
				require.NoError(t, err)
				require.False(t, geminiStreamHasFunctionCall(t, out), "tool call emitted before block stop")
				chunks = append(chunks, out...)
			}
			done, err := ToStream([]ir.Event{{Kind: ir.EventBlockStop, Index: 0}}, state)
			require.NoError(t, err)
			chunks = append(chunks, done...)
			calls := geminiStreamFunctionCalls(t, chunks)
			require.Len(t, calls, 1)
			raw, err := json.Marshal(calls[0].Arguments)
			require.NoError(t, err)
			require.JSONEq(t, tt.want, string(raw))
		})
	}
}

func TestToStreamKeepsParallelToolCallsIsolatedAndOrdered(t *testing.T) {
	t.Parallel()
	state := ir.NewStreamState("g1", "gemini-test")
	events := []ir.Event{
		{Kind: ir.EventBlockStart, Index: 3, Block: &ir.Block{Kind: ir.BlockKindToolUse, ToolUse: &ir.ToolUseBlock{ID: "call_b", Name: "second"}}},
		{Kind: ir.EventBlockStart, Index: 1, Block: &ir.Block{Kind: ir.BlockKindToolUse, ToolUse: &ir.ToolUseBlock{ID: "call_a", Name: "first"}}},
		{Kind: ir.EventBlockDelta, Index: 3, Delta: &ir.BlockDelta{JSON: `{"value":"b"}`}},
		{Kind: ir.EventBlockDelta, Index: 1, Delta: &ir.BlockDelta{JSON: `{"value":"a"}`}},
		{Kind: ir.EventFinish, Finish: finishPointer(ir.FinishTool)},
	}
	out, err := ToStream(events, state)
	require.NoError(t, err)
	calls := geminiStreamFunctionCalls(t, out)
	require.Len(t, calls, 2)
	require.Equal(t, "first", calls[0].FunctionName)
	require.Equal(t, map[string]any{"value": "a"}, calls[0].Arguments)
	require.Equal(t, "second", calls[1].FunctionName)
	require.Equal(t, map[string]any{"value": "b"}, calls[1].Arguments)
}

func boolPointer(value bool) *bool { return &value }

func finishPointer(value ir.Finish) *ir.Finish { return &value }

func geminiStreamHasFunctionCall(t *testing.T, chunks []any) bool {
	t.Helper()
	return len(geminiStreamFunctionCalls(t, chunks)) > 0
}

func geminiStreamFunctionCalls(t *testing.T, chunks []any) []dto.FunctionCall {
	t.Helper()
	out := make([]dto.FunctionCall, 0)
	for _, chunk := range chunks {
		resp, ok := chunk.(*dto.GeminiChatResponse)
		require.True(t, ok)
		require.NotEmpty(t, resp.Candidates)
		for _, part := range resp.Candidates[0].Content.Parts {
			if part.FunctionCall != nil {
				out = append(out, *part.FunctionCall)
			}
		}
	}
	return out
}

func roundtripRequest(t *testing.T, req *dto.GeminiChatRequest) *ir.Request {
	t.Helper()
	first, err := FromRequest(req)
	require.NoError(t, err)
	wired, err := ToRequest(first)
	require.NoError(t, err)
	second, err := FromRequest(wired)
	require.NoError(t, err)
	require.Equal(t, canon(t, first), canon(t, second))
	return second
}

func roundtripResponse(t *testing.T, resp *dto.GeminiChatResponse) *ir.Response {
	t.Helper()
	first, err := FromResponse(resp)
	require.NoError(t, err)
	wired, err := ToResponse(first)
	require.NoError(t, err)
	second, err := FromResponse(wired)
	require.NoError(t, err)
	require.Equal(t, canon(t, first), canon(t, second))
	return second
}

func unmarshalGeminiRequest(t *testing.T, raw string) *dto.GeminiChatRequest {
	t.Helper()
	var req dto.GeminiChatRequest
	require.NoError(t, json.Unmarshal([]byte(raw), &req))
	return &req
}

func unmarshalGeminiResponse(t *testing.T, raw string) *dto.GeminiChatResponse {
	t.Helper()
	var resp dto.GeminiChatResponse
	require.NoError(t, json.Unmarshal([]byte(raw), &resp))
	return &resp
}

func canon(t *testing.T, v any) any {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	var out any
	require.NoError(t, json.Unmarshal(raw, &out))
	return out
}
