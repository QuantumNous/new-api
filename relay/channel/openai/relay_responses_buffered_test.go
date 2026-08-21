package openai

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type responsesTestContextConfig struct {
	accept      string
	contentType string
}

func newResponsesBufferedStreamTestContext(body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	return newResponsesBufferedStreamTestContextWithConfig(body, responsesTestContextConfig{contentType: "text/event-stream"})
}

func newResponsesBufferedStreamTestContextWithConfig(body string, config responsesTestContextConfig) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	if config.accept != "" {
		c.Request.Header.Set("Accept", config.accept)
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
		},
		OriginModelName: "gpt-test",
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{config.contentType}},
	}
	return c, w, resp, info
}

// Some upstreams (e.g. Codex) only support streaming. For a non-streaming
// client the gateway must buffer the SSE stream into one aggregated JSON
// response while preserving usage and per-call tool billing.
func TestOaiResponsesBufferedStreamHandlerReturnsAggregatedJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"buff"}`,
		`data: {"type":"response.output_text.delta","delta":"ered"}`,
		`data: {"type":"response.output_item.done","item":{"type":"web_search_call","id":"ws_1"}}`,
		`data: {"type":"response.completed","response":{"id":"resp_buf","model":"gpt-test","status":"completed","codex_extension":{"trace":"kept"},"output":[{"type":"web_search_call","id":"ws_1"},{"type":"message","role":"assistant","content":[{"type":"output_text","text":"buffered"}]}],"usage":{"input_tokens":4,"output_tokens":6,"total_tokens":10}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, w, resp, info := newResponsesBufferedStreamTestContext(body)

	usage, apiErr := OaiResponsesBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 4, usage.PromptTokens)
	assert.Equal(t, 6, usage.CompletionTokens)
	assert.Equal(t, 10, usage.TotalTokens)

	got := w.Body.String()
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
	assert.NotContains(t, got, "data:")
	assert.Contains(t, got, `"id":"resp_buf"`)
	assert.Contains(t, got, `"text":"buffered"`)
	assert.Contains(t, got, `"codex_extension":{"trace":"kept"}`)

	// Billing parity with OaiResponsesHandler: built-in tool calls in the final
	// response output must be counted.
	require.NotNil(t, info.ResponsesUsageInfo)
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolWebSearchPreview)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview].CallCount)
}

func TestOaiResponsesBufferedStreamHandlerReconstructsMissingTerminalOutput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"reconstructed"}`,
		`data: {"type":"response.completed","response":{"id":"resp_partial","model":"gpt-test","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, w, resp, info := newResponsesBufferedStreamTestContext(body)

	usage, apiErr := OaiResponsesBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Contains(t, w.Body.String(), `"text":"reconstructed"`)
}

func TestOaiResponsesBufferedStreamHandlerReconstructsBillableOutputs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := strings.Join([]string{
		`data: {"type":"response.output_item.done","output_index":0,"item":{"type":"web_search_call","id":"ws_1","status":"completed"}}`,
		`data: {"type":"response.output_item.done","output_index":1,"item":{"type":"file_search_call","id":"fs_1","status":"completed"}}`,
		`data: {"type":"response.output_item.done","output_index":2,"item":{"type":"image_generation_call","id":"img_1","status":"completed","result":"image-data"}}`,
		`data: {"type":"response.completed","response":{"id":"resp_tools","model":"gpt-test","status":"completed","output":[],"usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, w, resp, info := newResponsesBufferedStreamTestContext(body)

	usage, apiErr := OaiResponsesBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	got := w.Body.String()
	assert.Contains(t, got, `"type":"web_search_call"`)
	assert.Contains(t, got, `"type":"file_search_call"`)
	assert.Contains(t, got, `"type":"image_generation_call"`)

	require.NotNil(t, info.ResponsesUsageInfo)
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolWebSearchPreview)
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolFileSearch)
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolImageGeneration)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview].CallCount)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolFileSearch].CallCount)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolImageGeneration].CallCount)
}

func TestOaiResponsesBufferedStreamHandlerClaudeBufferedViaChat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"Claude buffered"}`,
		`data: {"type":"response.completed","response":{"id":"resp_claude_buffered","model":"gpt-test","status":"completed","output":[],"usage":{"input_tokens":3,"output_tokens":4,"total_tokens":7}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, w, resp, info := newResponsesBufferedStreamTestContextWithConfig(body, responsesTestContextConfig{
		accept:      "application/json",
		contentType: "text/event-stream",
	})
	info.RelayFormat = types.RelayFormatClaude

	usage, apiErr := OaiResponsesToChatBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
	assert.Contains(t, w.Body.String(), `"type":"message"`)
	assert.Contains(t, w.Body.String(), `"Claude buffered"`)
}

// A terminal failure event in the stream must surface as an error instead of
// an empty fabricated success response.
func TestOaiResponsesBufferedStreamHandlerReturnsErrorOnFailedEvent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		`data: {"type":"response.failed","response":{"id":"resp_fail","status":"failed","error":{"type":"server_error","message":"upstream boom"}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, _, resp, info := newResponsesBufferedStreamTestContext(body)

	usage, apiErr := OaiResponsesBufferedStreamHandler(c, info, resp)
	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "upstream boom")
	assert.Nil(t, usage)
}

func TestOaiResponsesBufferedStreamHandlerReturnsTopLevelStreamError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := strings.Join([]string{
		`data: {"type":"error","error":{"type":"server_error","code":"server_error","message":"top-level boom","param":null}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, _, resp, info := newResponsesBufferedStreamTestContext(body)

	usage, apiErr := OaiResponsesBufferedStreamHandler(c, info, resp)
	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "top-level boom")
	assert.Nil(t, usage)
}

func TestOaiResponsesBufferedStreamHandlerRejectsMissingTerminalEvent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, _, resp, info := newResponsesBufferedStreamTestContext(body)

	usage, apiErr := OaiResponsesBufferedStreamHandler(c, info, resp)
	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "terminal event")
	assert.Nil(t, usage)
}

func TestOaiResponsesBufferedStreamHandlerStopsOnClientCancellation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	reader, writer := io.Pipe()
	t.Cleanup(func() {
		_ = reader.Close()
		_ = writer.Close()
	})

	c, _, resp, info := newResponsesBufferedStreamTestContext("")
	resp.Body = reader
	requestCtx, cancel := context.WithCancel(context.Background())
	c.Request = c.Request.WithContext(requestCtx)

	result := make(chan *types.NewAPIError, 1)
	go func() {
		_, apiErr := OaiResponsesBufferedStreamHandler(c, info, resp)
		result <- apiErr
	}()
	cancel()

	select {
	case apiErr := <-result:
		require.NotNil(t, apiErr)
		assert.Contains(t, apiErr.Error(), context.Canceled.Error())
	case <-time.After(time.Second):
		t.Fatal("buffered response handler did not stop after client cancellation")
	}
}
