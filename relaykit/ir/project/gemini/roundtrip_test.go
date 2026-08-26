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
