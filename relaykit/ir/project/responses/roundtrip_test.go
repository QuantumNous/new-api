package responses

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/stretchr/testify/require"
)

func TestRequestRoundtripGoldenFixture(t *testing.T) {
	t.Parallel()
	req := unmarshalResponsesRequest(t, `{
		"model": "gpt-test",
		"stream": true,
		"max_output_tokens": 1024,
		"instructions": "You are a helpful assistant.",
		"input": [
			{"type": "message", "role": "user", "content": [
				{"type": "input_text", "text": "What is in this image?"},
				{"type": "input_image", "image_url": "https://example.com/cat.png"}
			]},
			{"type": "function_call", "call_id": "call_abc", "name": "get_weather", "arguments": "{\"city\":\"Paris\"}"},
			{"type": "function_call_output", "call_id": "call_abc", "output": "15 degrees"}
		],
		"tools": [{"type": "function", "name": "get_weather", "description": "Get weather by city", "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}]
	}`)
	irReq := roundtripRequest(t, req)
	require.Equal(t, "gpt-test", irReq.Model)
	require.True(t, irReq.Stream)
	require.Equal(t, ir.RoleSystem, irReq.Messages[0].Role)
	require.Equal(t, "call_abc", irReq.Messages[2].Blocks[0].ToolUse.ID)
	require.Equal(t, "call_abc", irReq.Messages[3].Blocks[0].ToolResult.ToolUseID)
	require.Equal(t, ir.ToolFunction, irReq.Tools[0].Kind)
}

func TestRequestKeepsStatefulFields(t *testing.T) {
	t.Parallel()
	req := unmarshalResponsesRequest(t, `{
		"model": "gpt-test",
		"previous_response_id": "resp_123",
		"conversation": "conv_1",
		"input": "hello"
	}`)
	irReq := roundtripRequest(t, req)
	require.Equal(t, "resp_123", irReq.Extensions.Responses.PreviousResponseID)
	require.True(t, len(irReq.Extensions.Responses.Conversation) > 0)
}

func TestResponseRoundtripGoldenFixture(t *testing.T) {
	t.Parallel()
	resp := unmarshalResponsesResponse(t, `{
		"id": "resp_fixed",
		"object": "response",
		"model": "gpt-test",
		"status": "completed",
		"output": [
			{"type": "reasoning", "summary": [{"type": "summary_text", "text": "Deep thought."}]},
			{"type": "message", "role": "assistant", "status": "completed", "content": [{"type": "output_text", "text": "The answer is 42."}]},
			{"type": "function_call", "call_id": "call_abc", "name": "get_weather", "arguments": "{\"city\":\"Paris\"}", "status": "completed"}
		],
		"usage": {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}
	}`)
	irResp := roundtripResponse(t, resp)
	require.Equal(t, "resp_fixed", irResp.ID)
	require.Equal(t, "The answer is 42.", findText(irResp.Blocks))
	require.Equal(t, "call_abc", findToolUse(irResp.Blocks).ID)
}

func findText(blocks []ir.Block) string {
	for _, block := range blocks {
		if block.Kind == ir.BlockKindText && block.Text != nil {
			return block.Text.Text
		}
	}
	return ""
}

func findToolUse(blocks []ir.Block) *ir.ToolUseBlock {
	for _, block := range blocks {
		if block.Kind == ir.BlockKindToolUse {
			return block.ToolUse
		}
	}
	return nil
}

func roundtripRequest(t *testing.T, req *dto.OpenAIResponsesRequest) *ir.Request {
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

func roundtripResponse(t *testing.T, resp *dto.OpenAIResponsesResponse) *ir.Response {
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

func unmarshalResponsesRequest(t *testing.T, raw string) *dto.OpenAIResponsesRequest {
	t.Helper()
	var req dto.OpenAIResponsesRequest
	require.NoError(t, json.Unmarshal([]byte(raw), &req))
	return &req
}

func unmarshalResponsesResponse(t *testing.T, raw string) *dto.OpenAIResponsesResponse {
	t.Helper()
	var resp dto.OpenAIResponsesResponse
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

func TestToRequestSplitsThinkingTextAndTool(t *testing.T) {
	t.Parallel()
	irReq := &ir.Request{
		Model: "gpt-test",
		Messages: []ir.Message{{
			Role: ir.RoleAssistant,
			Blocks: []ir.Block{
				ir.Think("deep thought", "sig"),
				ir.Text("the answer"),
				ir.ToolUse("call_1", "lookup", json.RawMessage(`{"q":"x"}`)),
			},
		}},
	}
	out, err := ToRequest(irReq)
	require.NoError(t, err)
	var items []map[string]any
	require.NoError(t, json.Unmarshal(out.Input, &items))
	require.Len(t, items, 3)
	require.Equal(t, "reasoning", items[0]["type"])
	require.Equal(t, "message", items[1]["type"])
	require.Equal(t, "function_call", items[2]["type"])
	require.Equal(t, "call_1", items[2]["call_id"])
	require.Equal(t, "fc_call_1", items[2]["id"])
}

func TestToStreamIncludesItemIDOnDeltas(t *testing.T) {
	t.Parallel()
	state := ir.NewStreamState("resp_1", "gpt-test")
	events := []ir.Event{
		{Kind: ir.EventStart, ID: "resp_1", Model: "gpt-test"},
		{Kind: ir.EventBlockStart, Index: 0, Block: &ir.Block{Kind: ir.BlockKindText, Text: &ir.TextBlock{}}},
		{Kind: ir.EventBlockDelta, Index: 0, Delta: &ir.BlockDelta{Text: "hi"}},
	}
	out, err := ToStream(events, state)
	require.NoError(t, err)
	var addedID, deltaID string
	for _, item := range out {
		ev, ok := item.(dto.ResponsesStreamResponse)
		require.True(t, ok)
		switch ev.Type {
		case "response.output_item.added":
			require.NotNil(t, ev.Item)
			addedID = ev.Item.ID
			require.Equal(t, addedID, ev.ItemID)
		case "response.output_text.delta":
			deltaID = ev.ItemID
		}
	}
	require.NotEmpty(t, addedID)
	require.Equal(t, addedID, deltaID)
}
