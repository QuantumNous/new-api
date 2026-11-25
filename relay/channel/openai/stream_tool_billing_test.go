package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestObserveStreamChoicesDedupesFunctionCallNames(t *testing.T) {
	info := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	seen := make(map[string]struct{})
	var names []string

	chunks := []string{
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"c2","type":"function","function":{"name":"get_time","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{}"}}]}}]}`,
	}
	for _, chunk := range chunks {
		observeStreamChoices(info, chunk, seen, &names)
	}

	require.Len(t, names, 2)
	assert.Equal(t, []string{"get_weather", "get_time"}, names)
	assert.Empty(t, info.StreamStatus.ResponseOutcome(), "tool call deltas carry no finish reason")

	observeStreamChoices(info, `{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`, seen, &names)
	assert.Equal(t, "completed", info.StreamStatus.ResponseOutcome())
	assert.False(t, info.PerformanceBusinessRejection)

	filtered := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	observeStreamChoices(filtered, `{"choices":[{"index":0,"delta":{},"finish_reason":"content_filter"}]}`, map[string]struct{}{}, &names)
	assert.True(t, filtered.PerformanceBusinessRejection)
}

// Exercise the host HTTP handlers, including their final accounting hand-off.
// Converter-only tests cannot catch replacing retained usage with the last frame.
func TestMessagesThinkingUsageHTTPHandlers(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	for _, tc := range []struct {
		name   string
		stream bool
		body   string
		want   int
	}{
		{"JSON", false, `{"id":"test","model":"gpt-4o","choices":[{"message":{"role":"assistant","content":"answer"},"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":80,"total_tokens":180,"completion_tokens_details":{"reasoning_tokens":66}}}`, 66},
		{"JSON prompt fallback", false, `{"id":"test","model":"gpt-4o","choices":[{"message":{"role":"assistant","content":"answer"},"finish_reason":"stop"}],"usage":{"completion_tokens":80,"completion_tokens_details":{"reasoning_tokens":66}}}`, 66},
		{"SSE late usage and omitted details", true, "data: {\"id\":\"test\",\"choices\":[{\"delta\":{\"content\":\"answer\"}}],\"usage\":{\"prompt_tokens\":100,\"completion_tokens\":80,\"total_tokens\":180,\"completion_tokens_details\":{\"reasoning_tokens\":66}}}\n\ndata: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: {\"choices\":[],\"usage\":{\"prompt_tokens\":100,\"completion_tokens\":80,\"total_tokens\":180}}\n\ndata: [DONE]\n\n", 66},
		{"SSE explicit zero", true, "data: {\"id\":\"test\",\"choices\":[{\"delta\":{\"content\":\"answer\"}}],\"usage\":{\"prompt_tokens\":100,\"completion_tokens\":80,\"total_tokens\":180,\"completion_tokens_details\":{\"reasoning_tokens\":66}}}\n\ndata: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: {\"choices\":[],\"usage\":{\"prompt_tokens\":100,\"completion_tokens\":80,\"total_tokens\":180,\"completion_tokens_details\":{\"reasoning_tokens\":0}}}\n\ndata: [DONE]\n\n", 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
			info := &relaycommon.RelayInfo{
				ChannelMeta:  &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI, UpstreamModelName: "gpt-4o"},
				RelayFormat:  types.RelayFormatClaude,
				RelayMode:    relayconstant.RelayModeChatCompletions,
				StreamStatus: relaycommon.NewStreamStatus(),
				IsStream:     tc.stream,
				StartTime:    time.Now(),
			}
			info.SetEstimatePromptTokens(10)
			resp := &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(tc.body))}
			var accounting *dto.Usage
			if tc.stream {
				resp.Header.Set("Content-Type", "text/event-stream")
				usage, err := OaiStreamHandler(c, info, resp)
				require.Nil(t, err)
				accounting = usage
			} else {
				resp.Header.Set("Content-Type", "application/json")
				usage, err := OpenaiHandler(c, info, resp)
				require.Nil(t, err)
				accounting = usage
			}
			assert.Equal(t, 80, accounting.CompletionTokens, "thinking is already in the output total")
			var visible dto.ClaudeUsage
			if tc.stream {
				stops := 0
				for line := range strings.SplitSeq(recorder.Body.String(), "\n") {
					if !strings.HasPrefix(line, "data: ") {
						continue
					}
					var event dto.ClaudeResponse
					require.NoError(t, common.UnmarshalJsonStr(strings.TrimPrefix(line, "data: "), &event))
					if event.Type == "message_delta" {
						require.NotNil(t, event.Usage)
						visible = *event.Usage
					}
					if event.Type == "message_stop" {
						stops++
					}
				}
				assert.Equal(t, 1, stops)
			} else {
				var response dto.ClaudeResponse
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
				require.NotNil(t, response.Usage)
				visible = *response.Usage
			}
			assert.Equal(t, 80, visible.OutputTokens)
			require.NotNil(t, visible.OutputTokensDetails)
			assert.Equal(t, tc.want, visible.OutputTokensDetails.ThinkingTokens)
		})
	}
}
