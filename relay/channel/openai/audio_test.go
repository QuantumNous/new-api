package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOpenaiSTTHandlerStreamsEventStreamResponse(t *testing.T) {
	c, recorder := newAudioTestContext(t)
	info := &relaycommon.RelayInfo{IsStream: true}
	info.SetEstimatePromptTokens(7)
	resp := newAudioTestResponse("text/event-stream", ""+
		"data: {\"text\":\"hello\"}\n\n"+
		"data: [DONE]\n\n")

	err, usage := OpenaiSTTHandler(c, resp, info, "json")

	require.Nil(t, err)
	require.Equal(t, 7, usage.PromptTokens)
	require.Equal(t, 7, usage.TotalTokens)
	require.True(t, recorder.Flushed)
	require.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	require.Contains(t, recorder.Body.String(), "data: {\"text\":\"hello\"}\n\n")
}

func TestOpenaiSTTHandlerKeepsNonStreamJSONBehavior(t *testing.T) {
	c, recorder := newAudioTestContext(t)
	info := &relaycommon.RelayInfo{IsStream: true}
	info.SetEstimatePromptTokens(7)
	respBody := `{"text":"ok","usage":{"total_tokens":12,"input_tokens":5,"output_tokens":7}}`
	resp := newAudioTestResponse("application/json", respBody)

	err, usage := OpenaiSTTHandler(c, resp, info, "json")

	require.Nil(t, err)
	require.Equal(t, respBody, recorder.Body.String())
	require.Equal(t, strconv.Itoa(len(respBody)), recorder.Header().Get("Content-Length"))
	require.Equal(t, 5, usage.PromptTokens)
	require.Equal(t, 7, usage.CompletionTokens)
	require.Equal(t, 12, usage.TotalTokens)
}

func TestOpenaiSTTHandlerUsesStreamUsageChunk(t *testing.T) {
	c, recorder := newAudioTestContext(t)
	info := &relaycommon.RelayInfo{IsStream: true}
	info.SetEstimatePromptTokens(7)
	resp := newAudioTestResponse("text/event-stream; charset=utf-8", ""+
		"data: {\"text\":\"hello\"}\n\n"+
		"data: {\"usage\":{\"total_tokens\":9,\"input_tokens\":4,\"output_tokens\":5}}\n\n"+
		"data: [DONE]\n\n")

	err, usage := OpenaiSTTHandler(c, resp, info, "json")

	require.Nil(t, err)
	require.Equal(t, 4, usage.PromptTokens)
	require.Equal(t, 5, usage.CompletionTokens)
	require.Equal(t, 9, usage.TotalTokens)
	require.True(t, recorder.Flushed)
	require.Contains(t, recorder.Body.String(), "data: {\"usage\":{\"total_tokens\":9,\"input_tokens\":4,\"output_tokens\":5}}\n\n")
}

func newAudioTestContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", nil)
	return c, recorder
}

func newAudioTestResponse(contentType string, body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{contentType},
		},
		Body: io.NopCloser(strings.NewReader(body)),
	}
}
