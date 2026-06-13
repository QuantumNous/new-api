package claude

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func claudeChatSmokeContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	originalStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = originalStreamingTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat:        types.RelayFormatOpenAI,
		OriginModelName:    "claude-haiku-4-5",
		IsStream:           true,
		ShouldIncludeUsage: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-haiku-4-5",
		},
	}
	info.SetEstimatePromptTokens(17)

	return c, recorder, info
}

func claudeHTTPResponse(body string, contentType string) *http.Response {
	if contentType == "" {
		contentType = "application/json"
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func claudeSSEDataPayloads(body string) []string {
	lines := strings.Split(body, "\n")
	payloads := make([]string, 0, len(lines))
	for _, line := range lines {
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payloads = append(payloads, strings.TrimPrefix(line, "data: "))
	}
	return payloads
}

func TestDR10ClaudeToOpenAIChatNonStreamSmoke(t *testing.T) {
	c, recorder, info := claudeChatSmokeContext(t)
	info.IsStream = false
	upstream := `{
	  "id": "msg_dr10_claude_nonstream",
	  "type": "message",
	  "role": "assistant",
	  "model": "claude-haiku-4-5",
	  "content": [{"type": "text", "text": "hello from claude haiku"}],
	  "stop_reason": "end_turn",
	  "usage": {
	    "input_tokens": 17,
	    "cache_read_input_tokens": 4,
	    "cache_creation_input_tokens": 3,
	    "output_tokens": 6
	  }
	}`

	usage, err := ClaudeHandler(c, claudeHTTPResponse(upstream, "application/json"), info)
	require.Nil(t, err)
	require.Equal(t, 17, usage.PromptTokens)
	require.Equal(t, 6, usage.CompletionTokens)
	require.Equal(t, 23, usage.TotalTokens)
	require.Equal(t, "anthropic", usage.UsageSemantic)
	require.Equal(t, 4, usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 3, usage.PromptTokensDetails.CachedCreationTokens)

	var chat dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &chat))
	require.Equal(t, "chat.completion", chat.Object)
	require.Equal(t, "msg_dr10_claude_nonstream", chat.Id)
	require.Len(t, chat.Choices, 1)
	require.Equal(t, "hello from claude haiku", chat.Choices[0].Message.StringContent())
	require.Equal(t, "stop", chat.Choices[0].FinishReason)
	require.Equal(t, 24, chat.Usage.PromptTokens)
	require.Equal(t, 6, chat.Usage.CompletionTokens)
	require.Equal(t, 30, chat.Usage.TotalTokens)
	require.Equal(t, "openai", chat.Usage.UsageSemantic)
	require.Equal(t, "anthropic", chat.Usage.UsageSource)
}

func TestDR10ClaudeToOpenAIChatStreamSmoke(t *testing.T) {
	c, recorder, info := claudeChatSmokeContext(t)
	upstream := strings.Join([]string{
		`data: {"type":"message_start","message":{"id":"msg_dr10_claude_stream","type":"message","role":"assistant","model":"claude-haiku-4-5","usage":{"input_tokens":17,"cache_read_input_tokens":4,"cache_creation_input_tokens":3,"output_tokens":1}}}`,
		`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"claude "}}`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"stream"}}`,
		`data: {"type":"content_block_stop","index":0}`,
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":6}}`,
		`data: {"type":"message_stop"}`,
		`data: [DONE]`,
		``,
	}, "\n")

	usage, err := ClaudeStreamHandler(c, claudeHTTPResponse(upstream, "text/event-stream"), info)
	require.Nil(t, err)
	require.Equal(t, 17, usage.PromptTokens)
	require.Equal(t, 6, usage.CompletionTokens)
	require.Equal(t, 23, usage.TotalTokens)
	require.Equal(t, "anthropic", usage.UsageSemantic)
	require.Equal(t, 4, usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 3, usage.PromptTokensDetails.CachedCreationTokens)

	payloads := claudeSSEDataPayloads(recorder.Body.String())
	require.NotEmpty(t, payloads)

	var deltas []string
	var sawStop bool
	var sawUsage bool
	for _, payload := range payloads {
		if payload == "[DONE]" {
			continue
		}
		var chunk dto.ChatCompletionsStreamResponse
		require.NoError(t, common.Unmarshal([]byte(payload), &chunk), "payload=%s", payload)
		if chunk.Usage != nil {
			sawUsage = true
			require.Equal(t, 24, chunk.Usage.PromptTokens)
			require.Equal(t, 6, chunk.Usage.CompletionTokens)
			require.Equal(t, 30, chunk.Usage.TotalTokens)
			require.Equal(t, "openai", chunk.Usage.UsageSemantic)
			require.Equal(t, "anthropic", chunk.Usage.UsageSource)
			continue
		}
		if len(chunk.Choices) == 0 {
			continue
		}
		choice := chunk.Choices[0]
		if choice.Delta.Content != nil {
			deltas = append(deltas, *choice.Delta.Content)
		}
		if choice.FinishReason != nil && *choice.FinishReason == "stop" {
			sawStop = true
		}
	}

	require.Equal(t, []string{"", "", "claude ", "stream"}, deltas)
	require.True(t, sawStop, "stream must include a stop chunk before [DONE]")
	require.True(t, sawUsage, "Anthropic stream must emit a final OpenAI-style usage chunk for billing visibility")
	require.True(t, strings.HasSuffix(strings.TrimSpace(recorder.Body.String()), "data: [DONE]"))
}
