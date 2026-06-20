package openai

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

func openAIChatSmokeContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo) {
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
		OriginModelName:    "gpt-4o-mini",
		ShouldIncludeUsage: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o-mini",
		},
	}
	info.SetEstimatePromptTokens(11)

	return c, recorder, info
}

func openAIHTTPResponse(body string, contentType string) *http.Response {
	if contentType == "" {
		contentType = "application/json"
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func sseDataPayloads(body string) []string {
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

func TestDR10OpenAIResponsesToChatNonStreamSmoke(t *testing.T) {
	c, recorder, info := openAIChatSmokeContext(t)
	upstream := `{
	  "id": "resp_dr10_openai_nonstream",
	  "object": "response",
	  "created_at": 1710000000,
	  "model": "gpt-4o-mini",
	  "output": [{
	    "type": "message",
	    "id": "msg_dr10_openai_nonstream",
	    "status": "completed",
	    "role": "assistant",
	    "content": [{"type": "output_text", "text": "hello from gpt-4o-mini"}]
	  }],
	  "usage": {
	    "input_tokens": 11,
	    "output_tokens": 7,
	    "total_tokens": 18,
	    "input_tokens_details": {"cached_tokens": 3}
	  }
	}`

	usage, err := OaiResponsesToChatHandler(c, info, openAIHTTPResponse(upstream, "application/json"))
	require.Nil(t, err)
	require.Equal(t, 11, usage.PromptTokens)
	require.Equal(t, 7, usage.CompletionTokens)
	require.Equal(t, 18, usage.TotalTokens)
	require.Equal(t, 3, usage.PromptTokensDetails.CachedTokens)

	var chat dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &chat))
	require.Equal(t, "chat.completion", chat.Object)
	require.Equal(t, "gpt-4o-mini", chat.Model)
	require.Len(t, chat.Choices, 1)
	require.Equal(t, "hello from gpt-4o-mini", chat.Choices[0].Message.StringContent())
	require.Equal(t, 11, chat.Usage.PromptTokens)
	require.Equal(t, 7, chat.Usage.CompletionTokens)
}

func TestDR10OpenAIResponsesToChatStreamSmoke(t *testing.T) {
	c, recorder, info := openAIChatSmokeContext(t)
	upstream := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_dr10_openai_stream","created_at":1710000001,"model":"gpt-4o-mini"}}`,
		`data: {"type":"response.output_text.delta","delta":"openai "}`,
		`data: {"type":"response.output_text.delta","delta":"stream"}`,
		`data: {"type":"response.completed","response":{"id":"resp_dr10_openai_stream","created_at":1710000001,"model":"gpt-4o-mini","usage":{"input_tokens":13,"output_tokens":5,"total_tokens":18,"input_tokens_details":{"cached_tokens":2}}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	usage, err := OaiResponsesToChatStreamHandler(c, info, openAIHTTPResponse(upstream, "text/event-stream"))
	require.Nil(t, err)
	require.Equal(t, 13, usage.PromptTokens)
	require.Equal(t, 5, usage.CompletionTokens)
	require.Equal(t, 18, usage.TotalTokens)
	require.Equal(t, 2, usage.PromptTokensDetails.CachedTokens)

	payloads := sseDataPayloads(recorder.Body.String())
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
			require.Equal(t, 13, chunk.Usage.PromptTokens)
			require.Equal(t, 5, chunk.Usage.CompletionTokens)
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

	require.Equal(t, []string{"", "openai ", "stream"}, deltas)
	require.True(t, sawStop, "stream must include a stop chunk before [DONE]")
	require.True(t, sawUsage, "stream_options include_usage path must emit a final usage chunk")
	require.True(t, strings.HasSuffix(strings.TrimSpace(recorder.Body.String()), "data: [DONE]"))
}
