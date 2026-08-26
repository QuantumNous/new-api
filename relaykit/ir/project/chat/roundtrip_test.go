package chat

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/stretchr/testify/require"
)

func TestFromRequestNil(t *testing.T) {
	t.Parallel()
	_, err := FromRequest(nil)
	require.Error(t, err)
}

func TestRequestRoundtripGoldenFixture(t *testing.T) {
	t.Parallel()
	req := unmarshalChatRequest(t, `{
		"model": "gpt-test",
		"max_tokens": 1024,
		"stream": true,
		"messages": [
			{"role": "system", "content": "You are a helpful assistant."},
			{"role": "user", "content": [
				{"type": "text", "text": "What is in this image?"},
				{"type": "image_url", "image_url": {"url": "https://example.com/cat.png", "detail": "high"}}
			]},
			{"role": "assistant", "tool_calls": [{"id": "call_abc", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\":\"Paris\"}"}}]},
			{"role": "tool", "tool_call_id": "call_abc", "content": "15 degrees"},
			{"role": "user", "content": "Summarize."}
		],
		"tools": [{"type": "function", "function": {"name": "get_weather", "description": "Get weather by city", "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}}],
		"tool_choice": "auto"
	}`)
	irReq := roundtripRequest(t, req)
	require.Equal(t, "gpt-test", irReq.Model)
	require.True(t, irReq.Stream)
	require.Equal(t, 1024, *irReq.Sample.MaxOutputTokens)
	require.Equal(t, ir.ToolChoiceAuto, irReq.ToolChoice.Mode)
	require.Equal(t, "call_abc", messageByRole(t, irReq, ir.RoleAssistant).Blocks[0].ToolUse.ID)
	require.Equal(t, "call_abc", messageByRole(t, irReq, ir.RoleTool).Blocks[0].ToolResult.ToolUseID)
}

func TestRequestDoesNotReadExtraBodyGoogleIntoThink(t *testing.T) {
	t.Parallel()
	req := unmarshalChatRequest(t, `{
		"model": "gemini-2.5-pro",
		"messages": [{"role": "user", "content": "hi"}],
		"extra_body": {"google": {"thinking_config": {"thinking_budget": 8192, "include_thoughts": true}}}
	}`)
	irReq, err := FromRequest(req)
	require.NoError(t, err)
	require.Nil(t, irReq.Think)
	require.NotNil(t, irReq.Extensions.Chat)
	require.Contains(t, string(irReq.Extensions.Chat.Raw), "extra_body")
}

func TestRequestRoundtripReasoningEffort(t *testing.T) {
	t.Parallel()
	req := unmarshalChatRequest(t, `{
		"model": "gpt-test",
		"reasoning_effort": "high",
		"messages": [{"role": "user", "content": "think"}]
	}`)
	irReq := roundtripRequest(t, req)
	require.NotNil(t, irReq.Think)
	require.Equal(t, ir.ThinkEnabled, irReq.Think.Mode)
	require.Equal(t, "high", irReq.Think.Level)
}

func TestResponseRoundtripGoldenFixture(t *testing.T) {
	t.Parallel()
	resp := unmarshalChatResponse(t, `{
		"id": "chatcmpl-fixed",
		"object": "chat.completion",
		"created": 1700000000,
		"model": "gpt-test",
		"choices": [{
			"index": 0,
			"message": {
				"role": "assistant",
				"content": "The answer is 42.",
				"reasoning_content": "Deep thought.",
				"tool_calls": [{"id": "call_abc", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\":\"Paris\"}"}}]
			},
			"finish_reason": "tool_calls"
		}],
		"usage": {
			"prompt_tokens": 10,
			"completion_tokens": 5,
			"total_tokens": 15,
			"prompt_tokens_details": {"cached_tokens": 3},
			"completion_tokens_details": {"reasoning_tokens": 2}
		}
	}`)
	irResp := roundtripResponse(t, resp)
	require.Equal(t, ir.FinishTool, irResp.Finish)
	require.Equal(t, "Deep thought.", irResp.Blocks[0].Think.Text)
	require.Equal(t, "call_abc", irResp.Blocks[1].ToolUse.ID)
	require.Equal(t, "The answer is 42.", irResp.Blocks[2].Text.Text)
}

func roundtripRequest(t *testing.T, req *dto.GeneralOpenAIRequest) *ir.Request {
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

func roundtripResponse(t *testing.T, resp *dto.OpenAITextResponse) *ir.Response {
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

func unmarshalChatRequest(t *testing.T, raw string) *dto.GeneralOpenAIRequest {
	t.Helper()
	var req dto.GeneralOpenAIRequest
	require.NoError(t, json.Unmarshal([]byte(raw), &req))
	return &req
}

func unmarshalChatResponse(t *testing.T, raw string) *dto.OpenAITextResponse {
	t.Helper()
	var resp dto.OpenAITextResponse
	require.NoError(t, json.Unmarshal([]byte(raw), &resp))
	return &resp
}

func messageByRole(t *testing.T, req *ir.Request, role ir.Role) ir.Message {
	t.Helper()
	for _, message := range req.Messages {
		if message.Role == role {
			return message
		}
	}
	t.Fatalf("missing role %s", role)
	return ir.Message{}
}

func canon(t *testing.T, v any) any {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	var out any
	require.NoError(t, json.Unmarshal(raw, &out))
	return out
}

func TestToRequestDropsCacheControlAndFlattensText(t *testing.T) {
	t.Parallel()
	irReq := &ir.Request{
		Model: "gpt-test",
		Messages: []ir.Message{{
			Role: ir.RoleUser,
			Blocks: []ir.Block{{
				Kind: ir.BlockKindText,
				Text: &ir.TextBlock{
					Text:         "hello workspace",
					CacheControl: &ir.CacheControl{Type: "ephemeral", TTL: "1h"},
				},
			}},
		}},
	}
	out, err := ToRequest(irReq)
	require.NoError(t, err)
	require.Len(t, out.Messages, 1)
	content, ok := out.Messages[0].Content.(string)
	require.True(t, ok, "content=%T", out.Messages[0].Content)
	require.Equal(t, "hello workspace", content)
	raw, err := json.Marshal(out.Messages[0])
	require.NoError(t, err)
	require.NotContains(t, string(raw), "cache_control")
}
