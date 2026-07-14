package zhipu

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newZhipuStreamTest creates the downstream and upstream fixtures required to
// exercise the complete Zhipu stream translation path.
func newZhipuStreamTest(t *testing.T, body io.ReadCloser) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       body,
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "chatglm"},
		IsStream:    true,
		DisablePing: true,
	}
	return c, recorder, resp, info
}

// TestZhipuStreamHandlerCompletesOnTerminalMeta verifies that a terminal meta
// frame wins over the immediately following EOF and supplies authoritative usage.
func TestZhipuStreamHandlerCompletesOnTerminalMeta(t *testing.T) {
	body := strings.Join([]string{
		"data: hello",
		`meta:{"request_id":"req-1","task_id":"task-1","task_status":"SUCCESS","usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
		"",
	}, "\n")
	c, recorder, resp, info := newZhipuStreamTest(t, io.NopCloser(strings.NewReader(body)))

	usage, apiErr := zhipuStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 2, usage.PromptTokens)
	assert.Equal(t, 3, usage.CompletionTokens)
	assert.Equal(t, 5, usage.TotalTokens)
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	assert.False(t, info.StreamStatus.HasErrors())
	assert.Contains(t, recorder.Body.String(), `"content":"hello"`)
	assert.Contains(t, recorder.Body.String(), `"id":"req-1"`)
	assert.Contains(t, recorder.Body.String(), `"finish_reason":"stop"`)
	assert.Contains(t, recorder.Body.String(), "data: [DONE]")
	assert.NotContains(t, recorder.Body.String(), `"error"`)
}

// TestZhipuStreamHandlerRejectsMalformedMetaBeforeOutput keeps malformed
// terminal metadata retryable when no model output has reached the client.
func TestZhipuStreamHandlerRejectsMalformedMetaBeforeOutput(t *testing.T) {
	c, recorder, resp, info := newZhipuStreamTest(t, io.NopCloser(strings.NewReader("meta:{invalid\n")))

	usage, apiErr := zhipuStreamHandler(c, info, resp)

	assert.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeBadResponse, apiErr.GetErrorCode())
	assert.Empty(t, recorder.Body.String())
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonHandlerStop, info.StreamStatus.EndReason)
	assert.True(t, info.StreamStatus.HasErrors())
}

// TestZhipuStreamHandlerEmitsErrorOnPrematureEOF ensures an incomplete stream
// cannot be reported as successful after a partial response was already sent.
func TestZhipuStreamHandlerEmitsErrorOnPrematureEOF(t *testing.T) {
	c, recorder, resp, info := newZhipuStreamTest(t, io.NopCloser(strings.NewReader("data: partial\n")))

	usage, apiErr := zhipuStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonEOF, info.StreamStatus.EndReason)
	assert.Contains(t, recorder.Body.String(), `"content":"partial"`)
	assert.Contains(t, recorder.Body.String(), `"error"`)
	assert.NotContains(t, recorder.Body.String(), "data: [DONE]")
}

// TestZhipuStreamHandlerStopsOnClientCancellation verifies that the shared
// scanner closes a blocked upstream body as soon as the downstream disconnects.
func TestZhipuStreamHandlerStopsOnClientCancellation(t *testing.T) {
	reader, writer := io.Pipe()
	t.Cleanup(func() { _ = writer.Close() })
	c, recorder, resp, info := newZhipuStreamTest(t, reader)
	ctx, cancel := context.WithCancel(c.Request.Context())
	c.Request = c.Request.WithContext(ctx)
	cancel()

	type result struct {
		usageErr *types.NewAPIError
		usageNil bool
	}
	resultChan := make(chan result, 1)
	go func() {
		usage, apiErr := zhipuStreamHandler(c, info, resp)
		resultChan <- result{usageErr: apiErr, usageNil: usage == nil}
	}()

	select {
	case got := <-resultChan:
		assert.True(t, got.usageNil)
		require.NotNil(t, got.usageErr)
		assert.Equal(t, http.StatusBadGateway, got.usageErr.StatusCode)
	case <-time.After(2 * time.Second):
		t.Fatal("zhipu stream handler did not stop after client cancellation")
	}
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonClientGone, info.StreamStatus.EndReason)
	assert.Empty(t, recorder.Body.String())
}
