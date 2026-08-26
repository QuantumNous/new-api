package claude

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
	_, err = ToRequest(nil)
	require.Error(t, err)
}

func TestRequestRoundtripGoldenFixture(t *testing.T) {
	t.Parallel()
	req := unmarshalClaudeRequest(t, `{
		"model": "claude-test",
		"max_tokens": 1024,
		"stream": true,
		"system": "You are a helpful assistant.",
		"messages": [
			{"role": "user", "content": [
				{"type": "text", "text": "What is in this image?"},
				{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "aGVsbG8="}}
			]},
			{"role": "assistant", "content": [
				{"type": "thinking", "thinking": "Let me look.", "signature": "sig"},
				{"type": "tool_use", "id": "toolu_abc", "name": "get_weather", "input": {"city": "Paris"}}
			]},
			{"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_abc", "content": "15 degrees"}]}
		],
		"tools": [{"name": "get_weather", "description": "Get weather by city", "input_schema": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}],
		"thinking": {"type": "enabled", "budget_tokens": 512}
	}`)

	irReq := roundtripRequest(t, req)
	require.Equal(t, "claude-test", irReq.Model)
	require.True(t, irReq.Stream)
	require.NotNil(t, irReq.Think)
	require.Equal(t, ir.ThinkEnabled, irReq.Think.Mode)
	require.Equal(t, 512, *irReq.Think.Budget)

	assistant := messageByRole(t, irReq, ir.RoleAssistant)
	require.Equal(t, ir.BlockKindThink, assistant.Blocks[0].Kind)
	require.Equal(t, "Let me look.", assistant.Blocks[0].Think.Text)
	require.Equal(t, "sig", assistant.Blocks[0].Think.Signature)
	require.Equal(t, "toolu_abc", assistant.Blocks[1].ToolUse.ID)
	require.Equal(t, "get_weather", assistant.Blocks[1].ToolUse.Name)
}

func TestRequestRoundtripThinkingSignatureAndRedacted(t *testing.T) {
	t.Parallel()
	req := unmarshalClaudeRequest(t, `{
		"model": "claude-test",
		"max_tokens": 64,
		"messages": [{
			"role": "assistant",
			"content": [
				{"type": "thinking", "thinking": "secret chain", "signature": "sig-1"},
				{"type": "redacted_thinking", "data": "opaque"},
				{"type": "text", "text": "hello"}
			]
		}]
	}`)
	irReq := roundtripRequest(t, req)
	msg := irReq.Messages[0]
	require.Equal(t, "sig-1", msg.Blocks[0].Think.Signature)
	require.True(t, msg.Blocks[1].Think.Redacted)
	require.Equal(t, "opaque", msg.Blocks[1].Think.RedactedData)
}

func TestRequestRoundtripCacheControl(t *testing.T) {
	t.Parallel()
	req := unmarshalClaudeRequest(t, `{
		"model": "claude-test",
		"max_tokens": 32,
		"system": [
			{"type": "text", "text": "cached", "cache_control": {"type": "ephemeral", "ttl": "1h"}}
		],
		"messages": [{
			"role": "user",
			"content": [
				{"type": "text", "text": "hi", "cache_control": {"type": "ephemeral"}}
			]
		}]
	}`)
	irReq := roundtripRequest(t, req)
	sys := messageByRole(t, irReq, ir.RoleSystem)
	require.Equal(t, "ephemeral", sys.Blocks[0].Text.CacheControl.Type)
	require.Equal(t, "1h", sys.Blocks[0].Text.CacheControl.TTL)
	user := messageByRole(t, irReq, ir.RoleUser)
	require.Equal(t, "ephemeral", user.Blocks[0].Text.CacheControl.Type)
}

func TestRequestRoundtripUnknownBlock(t *testing.T) {
	t.Parallel()
	req := unmarshalClaudeRequest(t, `{
		"model": "claude-test",
		"max_tokens": 16,
		"messages": [{
			"role": "assistant",
			"content": [
				{"type": "web_search_tool_result", "tool_use_id": "srv_1", "content": [{"type": "web_search_result", "url": "https://example.com"}]}
			]
		}]
	}`)
	irReq := roundtripRequest(t, req)
	block := irReq.Messages[0].Blocks[0]
	require.Equal(t, ir.BlockKindRaw, block.Kind)
	require.Equal(t, "web_search_tool_result", block.Raw.Type)
}

func TestRequestRoundtripWebSearchToolAndChoice(t *testing.T) {
	t.Parallel()
	req := unmarshalClaudeRequest(t, `{
		"model": "claude-test",
		"max_tokens": 16,
		"messages": [{"role": "user", "content": "search"}],
		"tools": [
			{"name": "lookup", "description": "x", "input_schema": {"type": "object"}},
			{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}
		],
		"tool_choice": {"type": "auto", "disable_parallel_tool_use": true}
	}`)
	irReq := roundtripRequest(t, req)
	require.Equal(t, ir.ToolFunction, irReq.Tools[0].Kind)
	require.Equal(t, ir.ToolWebSearch, irReq.Tools[1].Kind)
	require.Equal(t, ir.ToolChoiceAuto, irReq.ToolChoice.Mode)
	require.NotNil(t, irReq.ToolChoice.Parallel)
	require.False(t, *irReq.ToolChoice.Parallel)
}

func TestRequestRoundtripDocumentAndFileSource(t *testing.T) {
	t.Parallel()
	req := unmarshalClaudeRequest(t, `{
		"model": "claude-test",
		"max_tokens": 16,
		"messages": [{
			"role": "user",
			"content": [
				{"type": "document", "source": {"type": "url", "url": "https://example.com/a.pdf", "media_type": "application/pdf"}},
				{"type": "image", "source": {"type": "file", "file_id": "file_123", "media_type": "image/png"}}
			]
		}]
	}`)
	irReq := roundtripRequest(t, req)
	blocks := irReq.Messages[0].Blocks
	require.Equal(t, ir.MediaFile, blocks[0].Media.Kind)
	require.Equal(t, ir.MediaSourceURL, blocks[0].Media.Source)
	require.Equal(t, "https://example.com/a.pdf", blocks[0].Media.URL)
	require.Equal(t, ir.MediaSourceID, blocks[1].Media.Source)
	require.Equal(t, "file_123", blocks[1].Media.FileID)
}

func TestRequestRoundtripServerToolUseAndErrorResult(t *testing.T) {
	t.Parallel()
	req := unmarshalClaudeRequest(t, `{
		"model": "claude-test",
		"max_tokens": 16,
		"messages": [
			{"role": "assistant", "content": [
				{"type": "server_tool_use", "id": "srv_1", "name": "web_search", "input": {"query": "go"}}
			]},
			{"role": "user", "content": [
				{"type": "tool_result", "tool_use_id": "toolu_1", "is_error": true, "content": "boom"}
			]}
		]
	}`)
	irReq := roundtripRequest(t, req)
	require.True(t, irReq.Messages[0].Blocks[0].ToolUse.Server)
	require.Equal(t, "srv_1", irReq.Messages[0].Blocks[0].ToolUse.ID)
	require.True(t, irReq.Messages[1].Blocks[0].ToolResult.IsError)
}

func TestRequestRoundtripPrivateExtensions(t *testing.T) {
	t.Parallel()
	req := unmarshalClaudeRequest(t, `{
		"model": "claude-test",
		"max_tokens": 16,
		"inference_geo": "us",
		"service_tier": "auto",
		"metadata": {"user_id": "u1"},
		"mcp_servers": [{"name": "files"}],
		"messages": [{"role": "user", "content": "hi"}]
	}`)
	irReq := roundtripRequest(t, req)
	require.NotNil(t, irReq.Extensions.Claude)
	require.Equal(t, "us", irReq.Extensions.Claude.InferenceGeo)
	require.Equal(t, "auto", irReq.Extensions.Claude.ServiceTier)
}

func TestResponseRoundtripGoldenFixture(t *testing.T) {
	t.Parallel()
	resp := unmarshalClaudeResponse(t, `{
		"id": "msg_fixed",
		"type": "message",
		"role": "assistant",
		"model": "claude-test",
		"content": [
			{"type": "text", "text": "The answer is 42."},
			{"type": "tool_use", "id": "toolu_abc", "name": "get_weather", "input": {"city": "Paris"}}
		],
		"stop_reason": "tool_use",
		"usage": {"input_tokens": 10, "output_tokens": 5, "cache_read_input_tokens": 3, "cache_creation_input_tokens": 2}
	}`)
	irResp := roundtripResponse(t, resp)
	require.Equal(t, "msg_fixed", irResp.ID)
	require.Equal(t, ir.FinishTool, irResp.Finish)
	require.Equal(t, "tool_use", irResp.ProviderFinish)
	require.Equal(t, 10, irResp.Usage.Input)
	require.Equal(t, 5, irResp.Usage.Output)
	require.Equal(t, 3, irResp.Usage.CacheRead)
	require.Equal(t, 2, irResp.Usage.CacheWrite)
	require.Equal(t, "The answer is 42.", irResp.Blocks[0].Text.Text)
	require.Equal(t, "toolu_abc", irResp.Blocks[1].ToolUse.ID)
}

func TestFinishFromClaude(t *testing.T) {
	t.Parallel()
	require.Equal(t, ir.FinishStop, ir.FinishFromClaude("end_turn"))
	require.Equal(t, ir.FinishLength, ir.FinishFromClaude("max_tokens"))
	require.Equal(t, ir.FinishTool, ir.FinishFromClaude("tool_use"))
	require.Equal(t, ir.FinishFilter, ir.FinishFromClaude("refusal"))
	require.Equal(t, "tool_use", ir.FinishTool.ToClaudeStopReason())
	require.Equal(t, "end_turn", ir.FinishStop.ToClaudeStopReason())
}

func roundtripRequest(t *testing.T, req *dto.ClaudeRequest) *ir.Request {
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

func roundtripResponse(t *testing.T, resp *dto.ClaudeResponse) *ir.Response {
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

func unmarshalClaudeRequest(t *testing.T, raw string) *dto.ClaudeRequest {
	t.Helper()
	var req dto.ClaudeRequest
	require.NoError(t, json.Unmarshal([]byte(raw), &req))
	return &req
}

func unmarshalClaudeResponse(t *testing.T, raw string) *dto.ClaudeResponse {
	t.Helper()
	var resp dto.ClaudeResponse
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
