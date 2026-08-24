package ollama

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOllamaChatHandlerNonStreamToolCalls(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		raw          string
		finishReason string
	}{
		{
			name:         "compact json per-line parse path",
			raw:          `{"model":"llama3.1","created_at":"2026-05-27T12:00:00Z","message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"get_weather","arguments":{"city":"Paris","days":0}}}]},"done":true,"done_reason":"stop","prompt_eval_count":5,"eval_count":7}`,
			finishReason: constant.FinishReasonToolCalls,
		},
		{
			name:         "pretty json fallback parse path",
			finishReason: constant.FinishReasonToolCalls,
			raw: `{
  "model": "llama3.1",
  "created_at": "2026-05-27T12:00:00Z",
  "message": {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "function": {
          "name": "get_weather",
          "arguments": {
            "city": "Paris",
            "days": 0
          }
        }
      }
    ]
  },
  "done": true,
  "done_reason": "stop",
  "prompt_eval_count": 5,
  "eval_count": 7
}`,
		},
		{
			name:         "preserves explicit length finish reason",
			raw:          `{"model":"llama3.1","created_at":"2026-05-27T12:00:00Z","message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"get_weather","arguments":{"city":"Paris","days":0}}}]},"done":true,"done_reason":"length","prompt_eval_count":5,"eval_count":7}`,
			finishReason: "length",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			resp := &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(tt.raw)),
			}

			usage, apiErr := ollamaChatHandler(c, &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "fallback-model"},
			}, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			assert.Equal(t, 12, usage.TotalTokens)

			var out dto.OpenAITextResponse
			require.NoError(t, common.Unmarshal(w.Body.Bytes(), &out))
			require.Len(t, out.Choices, 1)
			assert.Equal(t, tt.finishReason, out.Choices[0].FinishReason)

			var toolCalls []dto.ToolCallResponse
			require.NoError(t, common.Unmarshal(out.Choices[0].Message.ToolCalls, &toolCalls))
			require.Len(t, toolCalls, 1)
			assert.NotEmpty(t, toolCalls[0].ID)
			assert.Equal(t, "function", toolCalls[0].Type)
			assert.Equal(t, "get_weather", toolCalls[0].Function.Name)
			assert.Nil(t, toolCalls[0].Index)

			var args map[string]any
			require.NoError(t, common.Unmarshal([]byte(toolCalls[0].Function.Arguments), &args))
			assert.Equal(t, "Paris", args["city"])
			assert.Equal(t, float64(0), args["days"])
		})
	}
}

func TestOllamaToolCallArguments(t *testing.T) {
	tests := []struct {
		name      string
		arguments any
		want      string
	}{
		{name: "map", arguments: map[string]any{"city": "Paris", "days": 0}, want: `{"city":"Paris","days":0}`},
		{name: "valid JSON string", arguments: ` {"city":"Paris"} `, want: `{"city":"Paris"}`},
		{name: "plain string", arguments: "Paris", want: `"Paris"`},
		{name: "valid raw message", arguments: json.RawMessage(`{"city":"Paris"}`), want: `{"city":"Paris"}`},
		{name: "invalid raw message", arguments: json.RawMessage(`{"city":`), want: `{}`},
		{name: "nil", arguments: nil, want: `{}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.JSONEq(t, tt.want, string(ollamaToolCallArguments(tt.arguments)))
		})
	}
}

func TestOllamaStreamHandlerPreservesExplicitFinishReasonWithToolCalls(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body: io.NopCloser(strings.NewReader(
			`{"model":"llama3.1","created_at":"2026-05-27T12:00:00Z","message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"get_weather","arguments":"{\"city\":\"Paris\"}"}}]},"done":false}` + "\n" +
				`{"model":"llama3.1","created_at":"2026-05-27T12:00:01Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"content_filter","prompt_eval_count":5,"eval_count":7}` + "\n",
		)),
	}

	usage, apiErr := ollamaStreamHandler(c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "fallback-model"},
	}, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 12, usage.TotalTokens)

	var finishReason string
	var arguments string
	for _, line := range strings.Split(w.Body.String(), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") || line == "data: [DONE]" {
			continue
		}
		var chunk dto.ChatCompletionsStreamResponse
		require.NoError(t, common.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &chunk))
		if len(chunk.Choices) == 0 {
			continue
		}
		if chunk.Choices[0].FinishReason != nil {
			finishReason = *chunk.Choices[0].FinishReason
		}
		if len(chunk.Choices[0].Delta.ToolCalls) > 0 {
			arguments = chunk.Choices[0].Delta.ToolCalls[0].Function.Arguments
		}
	}

	assert.Equal(t, "content_filter", finishReason)
	assert.JSONEq(t, `{"city":"Paris"}`, arguments)
}
