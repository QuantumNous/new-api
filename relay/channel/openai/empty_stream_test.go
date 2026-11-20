package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsMeaningfulOpenAIStreamData(t *testing.T) {
	tests := []struct {
		name string
		data string
		want bool
	}{
		{name: "role only", data: `{"choices":[{"index":0,"delta":{"role":"assistant"}}]}`, want: false},
		{name: "usage only", data: `{"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":0,"total_tokens":10}}`, want: false},
		{name: "reasoning only", data: `{"choices":[{"index":0,"delta":{"reasoning_content":"thinking"}}]}`, want: false},
		{name: "content", data: `{"choices":[{"index":0,"delta":{"content":"answer"}}]}`, want: true},
		{name: "tool call", data: `{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":"exec_command"}}]}}]}`, want: true},
		{name: "finish reason", data: `{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`, want: true},
		{name: "invalid json", data: `not-json`, want: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, isMeaningfulOpenAIStreamData(test.data))
		})
	}
}

func TestOaiStreamHandlerRejectsMetadataOnlyEOFBeforeWriting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() {
		constant.StreamingTimeout = previousStreamingTimeout
	})
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		IsStream:        true,
		DisablePing:     true,
		OriginModelName: "deepseek/deepseek-v4.1-flash",
		RelayFormat:     types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "deepseek/deepseek-v4.1-flash",
		},
	}
	body := strings.Join([]string{
		`data: {"id":"chatcmpl_empty","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_empty","object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":481801,"completion_tokens":0,"total_tokens":481801}}`,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	usage, apiErr := OaiStreamHandler(c, info, resp)

	assert.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
	assert.Empty(t, recorder.Body.String(), "metadata-only frames must not be committed before retry")
}

func TestOaiStreamHandlerFlushesBufferedMetadataAfterContent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() {
		constant.StreamingTimeout = previousStreamingTimeout
	})
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		IsStream:        true,
		DisablePing:     true,
		OriginModelName: "deepseek/deepseek-v4.1-flash",
		RelayFormat:     types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "deepseek/deepseek-v4.1-flash",
		},
	}
	body := strings.Join([]string{
		`data: {"id":"chatcmpl_ok","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_ok","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"answer"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_ok","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	_, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	assert.Contains(t, recorder.Body.String(), `"content":"answer"`)
}
