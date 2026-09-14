package openai

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type synchronizedResponseWriter struct {
	mu     sync.Mutex
	header http.Header
	body   strings.Builder
	status int
}

func newSynchronizedResponseWriter() *synchronizedResponseWriter {
	return &synchronizedResponseWriter{header: make(http.Header)}
}

func (w *synchronizedResponseWriter) Header() http.Header {
	return w.header
}

func (w *synchronizedResponseWriter) WriteHeader(status int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.status == 0 {
		w.status = status
	}
}

func (w *synchronizedResponseWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.body.Write(data)
}

func (w *synchronizedResponseWriter) Flush() {}

func (w *synchronizedResponseWriter) Len() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.body.Len()
}

func (w *synchronizedResponseWriter) HeaderValue(key string) string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.header.Get(key)
}

type countingPipeBody struct {
	*io.PipeReader
	closeCount atomic.Int32
}

func (b *countingPipeBody) Close() error {
	b.closeCount.Add(1)
	return b.PipeReader.Close()
}

type streamHandler func(*gin.Context, *relaycommon.RelayInfo, *http.Response) (*dto.Usage, *types.NewAPIError)

type streamHandlerResult struct {
	usage *dto.Usage
	err   *types.NewAPIError
}

func startOpenAIStreamHandler(t *testing.T, format types.RelayFormat, handler streamHandler) (*gin.Context, *synchronizedResponseWriter, context.CancelFunc, *io.PipeWriter, *countingPipeBody, *relaycommon.RelayInfo, <-chan streamHandlerResult) {
	t.Helper()
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	requestContext, cancelRequest := context.WithCancel(context.Background())
	writer := newSynchronizedResponseWriter()
	c, _ := gin.CreateTestContext(writer)
	c.Request = (&http.Request{Method: http.MethodPost, URL: mustParseURL(t, "/v1/responses"), Header: make(http.Header)}).WithContext(requestContext)
	c.Set(common.RequestIdKey, "openai-drain-regression")
	reader, pipeWriter := io.Pipe()
	body := &countingPipeBody{PipeReader: reader}
	resp := &http.Response{StatusCode: http.StatusOK, Body: body, Header: http.Header{"Content-Type": []string{"text/event-stream"}}}
	info := &relaycommon.RelayInfo{
		RelayFormat:        format,
		ShouldIncludeUsage: true,
		DisablePing:        true,
		OriginModelName:    "gpt-test",
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
	}
	results := make(chan streamHandlerResult, 1)
	go func() {
		usage, apiErr := handler(c, info, resp)
		results <- streamHandlerResult{usage: usage, err: apiErr}
	}()
	return c, writer, cancelRequest, pipeWriter, body, info, results
}

func mustParseURL(t *testing.T, path string) *url.URL {
	t.Helper()
	u, err := url.Parse(path)
	require.NoError(t, err)
	return u
}

func writeSSE(t *testing.T, writer *io.PipeWriter, data string) {
	t.Helper()
	_, err := io.WriteString(writer, "data: "+data+"\n\n")
	require.NoError(t, err)
}

func waitForOutput(t *testing.T, writer *synchronizedResponseWriter) int {
	t.Helper()
	require.Eventually(t, func() bool { return writer.Len() > 0 }, 2*time.Second, time.Millisecond)
	return writer.Len()
}

func requireDrainedSuccess(t *testing.T, info *relaycommon.RelayInfo, body *countingPipeBody) {
	t.Helper()
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonClientGone, info.StreamStatus.EndReason)
	upstreamResult, upstreamErr := info.StreamStatus.GetUpstreamResult()
	assert.Equal(t, relaycommon.StreamUpstreamResultTerminalSuccess, upstreamResult)
	assert.NoError(t, upstreamErr)
	assert.True(t, info.StreamStatus.IsUsageComplete())
	assert.Nil(t, helper.ValidateTextStreamCompletion(info))
	assert.Equal(t, int32(1), body.closeCount.Load())
}

func TestResponsesToChatStreamDrainsWithoutWritingAfterClientGone(t *testing.T) {
	for _, format := range []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude, types.RelayFormatGemini} {
		t.Run(string(format), func(t *testing.T) {
			_, downstream, cancel, upstream, body, info, results := startOpenAIStreamHandler(t, format, OaiResponsesToChatStreamHandler)
			writeSSE(t, upstream, `{"type":"response.created","response":{"id":"resp_1","model":"gpt-test","created_at":1710000000}}`)
			writeSSE(t, upstream, `{"type":"response.output_text.delta","delta":"before"}`)
			writtenBeforeCancel := waitForOutput(t, downstream)
			cancel()
			select {
			case <-results:
				t.Fatal("handler returned before the upstream terminal")
			case <-time.After(50 * time.Millisecond):
			}
			writeSSE(t, upstream, `{"type":"response.output_text.delta","delta":"after"}`)
			writeSSE(t, upstream, `{"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}`)

			select {
			case result := <-results:
				require.Nil(t, result.err)
				require.NotNil(t, result.usage)
				assert.Equal(t, 5, result.usage.TotalTokens)
			case <-time.After(2 * time.Second):
				t.Fatal("handler did not finish after terminal response")
			}
			assert.Equal(t, writtenBeforeCancel, downstream.Len())
			requireDrainedSuccess(t, info, body)
		})
	}
}

func TestResponsesToChatBufferedStreamDrainsWithoutHeadersOrOutput(t *testing.T) {
	_, downstream, cancel, upstream, body, info, results := startOpenAIStreamHandler(t, types.RelayFormatOpenAI, OaiResponsesToChatBufferedStreamHandler)
	writeSSE(t, upstream, `{"type":"response.output_text.delta","delta":"before"}`)
	cancel()
	select {
	case <-results:
		t.Fatal("handler returned before the upstream terminal")
	case <-time.After(50 * time.Millisecond):
	}
	writeSSE(t, upstream, `{"type":"response.output_text.delta","delta":"after"}`)
	writeSSE(t, upstream, `{"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}`)

	select {
	case result := <-results:
		require.Nil(t, result.err)
		require.NotNil(t, result.usage)
		assert.Equal(t, 5, result.usage.TotalTokens)
	case <-time.After(2 * time.Second):
		t.Fatal("buffered handler did not finish after terminal response")
	}
	assert.Zero(t, downstream.Len())
	assert.Empty(t, downstream.HeaderValue("Content-Type"))
	assert.True(t, info.DisablePing)
	requireDrainedSuccess(t, info, body)
}

func TestResponsesStreamDrainsAndSettlesImageAndToolUsageAfterClientGone(t *testing.T) {
	_, downstream, cancel, upstream, body, info, results := startOpenAIStreamHandler(t, types.RelayFormatOpenAIResponses, OaiResponsesStreamHandler)
	writeSSE(t, upstream, `{"type":"response.output_text.delta","delta":"before"}`)
	writtenBeforeCancel := waitForOutput(t, downstream)
	cancel()
	select {
	case <-results:
		t.Fatal("handler returned before the upstream terminal")
	case <-time.After(50 * time.Millisecond):
	}
	writeSSE(t, upstream, `{"type":"response.output_item.done","output_index":0,"item":{"type":"web_search_call","id":"web_1","status":"completed"}}`)
	writeSSE(t, upstream, `{"type":"response.output_item.done","output_index":1,"item":{"type":"image_generation_call","id":"img_1","status":"completed","result":"base64-a"}}`)
	writeSSE(t, upstream, `{"type":"response.completed","response":{"status":"completed","output":[{"type":"image_generation_call","id":"img_1","status":"completed","result":"base64-a"}],"usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}`)

	select {
	case result := <-results:
		require.Nil(t, result.err)
		require.NotNil(t, result.usage)
		assert.Equal(t, 5, result.usage.TotalTokens)
	case <-time.After(2 * time.Second):
		t.Fatal("responses handler did not finish after terminal response")
	}
	assert.Equal(t, writtenBeforeCancel, downstream.Len())
	require.NotNil(t, info.ResponsesUsageInfo)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview].CallCount)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolImageGeneration].CallCount)
	requireDrainedSuccess(t, info, body)
}

func TestChatToResponsesStreamDrainsWithoutWritingAfterClientGone(t *testing.T) {
	_, downstream, cancel, upstream, body, info, results := startOpenAIStreamHandler(t, types.RelayFormatOpenAIResponses, OaiChatToResponsesStreamHandler)
	writeSSE(t, upstream, `{"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"before"},"finish_reason":null}]}`)
	writtenBeforeCancel := waitForOutput(t, downstream)
	cancel()
	select {
	case <-results:
		t.Fatal("handler returned before the upstream terminal")
	case <-time.After(50 * time.Millisecond):
	}
	writeSSE(t, upstream, `{"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"after"},"finish_reason":"stop"}]}`)
	writeSSE(t, upstream, `{"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`)
	writeSSE(t, upstream, `[DONE]`)

	select {
	case result := <-results:
		require.Nil(t, result.err)
		require.NotNil(t, result.usage)
		assert.Equal(t, 5, result.usage.TotalTokens)
	case <-time.After(2 * time.Second):
		t.Fatal("chat-to-responses handler did not finish after terminal response")
	}
	assert.Equal(t, writtenBeforeCancel, downstream.Len())
	requireDrainedSuccess(t, info, body)
}

func TestResponsesSettlementGateRejectsNonAuthoritativeTerminalsAfterClientGone(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantResult relaycommon.StreamUpstreamResult
	}{
		{
			name:       "usage and done without completed",
			body:       "data: {\"type\":\"response.output_text.delta\",\"delta\":\"\",\"response\":{\"usage\":{\"input_tokens\":1,\"output_tokens\":1,\"total_tokens\":2}}}\n\ndata: [DONE]\n\n",
			wantResult: relaycommon.StreamUpstreamResultNone,
		},
		{
			name:       "completed without raw usage",
			body:       "data: {\"type\":\"response.output_text.delta\",\"delta\":\"\"}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\"}}\n\n",
			wantResult: relaycommon.StreamUpstreamResultTerminalSuccess,
		},
		{
			name:       "failed terminal",
			body:       "data: {\"type\":\"response.failed\",\"response\":{\"status\":\"failed\",\"usage\":{}}}\n\n",
			wantResult: relaycommon.StreamUpstreamResultProtocolFailure,
		},
		{
			name:       "incomplete eof",
			body:       "data: {\"type\":\"response.output_text.delta\",\"delta\":\"\"}\n\n",
			wantResult: relaycommon.StreamUpstreamResultIncompleteEOF,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestContext, cancel := context.WithCancel(context.Background())
			cancel()
			writer := newSynchronizedResponseWriter()
			c, _ := gin.CreateTestContext(writer)
			c.Request = (&http.Request{Method: http.MethodPost, URL: mustParseURL(t, "/v1/responses")}).WithContext(requestContext)
			info := &relaycommon.RelayInfo{DisablePing: true, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"}}
			resp := &http.Response{Body: io.NopCloser(strings.NewReader(test.body)), Header: make(http.Header)}

			_, _ = OaiResponsesStreamHandler(c, info, resp)

			require.NotNil(t, info.StreamStatus)
			result, _ := info.StreamStatus.GetUpstreamResult()
			assert.Equal(t, test.wantResult, result)
			require.Error(t, helper.ValidateTextStreamCompletion(info))
		})
	}
}

func TestResponsesBufferedOnlineIncompleteRemainsCompatible(t *testing.T) {
	body := "data: {\"type\":\"response.output_text.delta\",\"delta\":\"partial\"}\n\ndata: {\"type\":\"response.incomplete\",\"response\":{\"status\":\"incomplete\",\"usage\":{\"input_tokens\":1,\"output_tokens\":1,\"total_tokens\":2}}}\n\n"
	c, recorder, resp, info := newResponsesChatTestContext(t, body, false)

	usage, apiErr := OaiResponsesToChatBufferedStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Contains(t, recorder.Body.String(), "partial")
	assert.NotEqual(t, relaycommon.StreamUpstreamResultProtocolFailure, func() relaycommon.StreamUpstreamResult {
		result, _ := info.StreamStatus.GetUpstreamResult()
		return result
	}())
	assert.Nil(t, helper.ValidateTextStreamCompletion(info))
}

type errorReadCloser struct {
	closeCount atomic.Int32
}

func (*errorReadCloser) Read([]byte) (int, error) { return 0, errors.New("scanner failed") }
func (b *errorReadCloser) Close() error {
	b.closeCount.Add(1)
	return nil
}

func TestResponsesBufferedScannerErrorDoesNotCreateCompletedFallback(t *testing.T) {
	writer := newSynchronizedResponseWriter()
	c, _ := gin.CreateTestContext(writer)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	body := &errorReadCloser{}
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI, DisablePing: true, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"}}

	usage, apiErr := OaiResponsesToChatBufferedStreamHandler(c, info, &http.Response{Body: body, Header: make(http.Header)})

	assert.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Zero(t, writer.Len())
	assert.Equal(t, int32(1), body.closeCount.Load())
}

func TestResponsesToChatStateInitializationFailureClosesBodyOnce(t *testing.T) {
	body := &errorReadCloser{}
	c, _ := gin.CreateTestContext(newSynchronizedResponseWriter())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormat("unsupported"),
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
	}

	usage, apiErr := OaiResponsesToChatStreamHandler(c, info, &http.Response{Body: body, Header: make(http.Header)})

	assert.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Equal(t, int32(1), body.closeCount.Load())
}
