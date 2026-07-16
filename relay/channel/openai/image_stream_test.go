package openai

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newImageTestContext(t *testing.T, body, contentType string, isStream bool) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{contentType}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
		IsStream:    isStream,
	}
	return c, recorder, resp, info
}

func TestOpenaiImageDoResponseUsesInfoIsStream(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"created":1710000000,"data":[{"b64_json":"image"}]}`

	t.Run("non-stream response stays JSON", func(t *testing.T) {
		c, recorder, resp, info := newImageTestContext(t, body, "application/json", false)
		info.RelayMode = relayconstant.RelayModeImagesGenerations

		usage, err := (&Adaptor{}).DoResponse(c, resp, info)

		require.Nil(t, err)
		require.NotNil(t, usage)
		require.Equal(t, body, recorder.Body.String())
	})

	t.Run("stream response converts JSON to SSE", func(t *testing.T) {
		c, recorder, resp, info := newImageTestContext(t, body, "application/json", true)
		info.RelayMode = relayconstant.RelayModeImagesGenerations

		usage, err := (&Adaptor{}).DoResponse(c, resp, info)

		require.Nil(t, err)
		require.NotNil(t, usage)
		require.Contains(t, recorder.Body.String(), `event: image_generation.completed`)
		require.Contains(t, recorder.Body.String(), `data: [DONE]`)
	})
}

// TestOpenaiImageStreamHandlerForwardsSSEAndUsage covers the core SSE path:
// chunks are forwarded with rebuilt event lines, usage is extracted and
// normalized (input_tokens -> prompt_tokens with details), and [DONE] is
// re-emitted to the client.
func TestOpenaiImageStreamHandlerForwardsSSEAndUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`event: image_generation.partial_image`,
		`data: {"type":"image_generation.partial_image","b64_json":"partial"}`,
		``,
		`data: {"usage":{"input_tokens":3,"output_tokens":4,"total_tokens":7,"input_tokens_details":{"image_tokens":2,"text_tokens":1}}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newImageTestContext(t, body, "text/event-stream", true)
	info.PriceData.UsePrice = true
	info.PriceData.AddOtherRatio("n", 3)

	usage, err := OpenaiImageStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.Equal(t, 3, usage.PromptTokens)
	require.Equal(t, 4, usage.CompletionTokens)
	require.Equal(t, 7, usage.TotalTokens)
	require.Equal(t, 2, usage.PromptTokensDetails.ImageTokens)
	require.Equal(t, 1, usage.PromptTokensDetails.TextTokens)
	require.Contains(t, recorder.Body.String(), `event: image_generation.partial_image`)
	require.Contains(t, recorder.Body.String(), `data: {"type":"image_generation.partial_image","b64_json":"partial"}`)
	require.Contains(t, recorder.Body.String(), `data: {"usage":{"input_tokens":3,"output_tokens":4,"total_tokens":7,"input_tokens_details":{"image_tokens":2,"text_tokens":1}}}`)
	require.Contains(t, recorder.Body.String(), `data: [DONE]`)
	require.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	require.Equal(t, 3.0, info.PriceData.OtherRatios()["n"], "streams without completed events keep the requested count")
}

func TestOpenaiImageStreamHandlerUsesCompletedEventCount(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"type":"image_generation.partial_image","partial_image_index":0,"b64_json":"partial"}`,
		``,
		`data: {"type":"image_generation.completed","b64_json":"first"}`,
		``,
		`data: {"type":"image_edit.completed","b64_json":"second","usage":{"input_tokens":3,"output_tokens":4,"total_tokens":7}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")

	c, _, resp, info := newImageTestContext(t, body, "text/event-stream", true)
	info.PriceData.UsePrice = true
	info.PriceData.AddOtherRatio("n", 3)

	usage, err := OpenaiImageStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.Equal(t, 7, usage.TotalTokens)
	require.Equal(t, 2.0, info.PriceData.OtherRatios()["n"])
}

// blockingBody serves one SSE chunk, then blocks until Close (the scanner's
// cleanup) and returns EOF — keeping the upstream "open" while the client-side
// disconnect is simulated elsewhere.
type blockingBody struct {
	mu     sync.Mutex
	sent   bool
	chunk  []byte
	closed chan struct{}
}

func (b *blockingBody) Read(p []byte) (int, error) {
	b.mu.Lock()
	if !b.sent {
		b.sent = true
		n := copy(p, b.chunk)
		b.mu.Unlock()
		return n, nil
	}
	b.mu.Unlock()
	<-b.closed
	return 0, io.EOF
}

func (b *blockingBody) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	select {
	case <-b.closed:
	default:
		close(b.closed)
	}
	return nil
}

// cancelAfterWriter cancels the request context right after the payload
// containing needle has been written to the client, simulating a client that
// disconnects after receiving that event. Cancelling from the write side (not
// the upstream read side) makes the abort deterministic: the handler has
// already processed and counted the event when the disconnect fires.
type cancelAfterWriter struct {
	gin.ResponseWriter
	needle string
	cancel context.CancelFunc
	once   sync.Once
}

func (w *cancelAfterWriter) Write(p []byte) (int, error) {
	n, err := w.ResponseWriter.Write(p)
	if strings.Contains(string(p), w.needle) {
		w.once.Do(w.cancel)
	}
	return n, err
}

func (w *cancelAfterWriter) WriteString(s string) (int, error) {
	n, err := io.WriteString(w.ResponseWriter, s)
	if strings.Contains(s, w.needle) {
		w.once.Do(w.cancel)
	}
	return n, err
}

func newDisconnectingImageStream(t *testing.T, sseBody, disconnectAfter string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()
	c, recorder, resp, info := newImageTestContext(t, "", "text/event-stream", true)
	ctx, cancel := context.WithCancel(c.Request.Context())
	t.Cleanup(cancel)
	c.Request = c.Request.WithContext(ctx)
	c.Writer = &cancelAfterWriter{ResponseWriter: c.Writer, needle: disconnectAfter, cancel: cancel}
	resp.Body = &blockingBody{
		chunk:  []byte(sseBody),
		closed: make(chan struct{}),
	}
	return c, recorder, resp, info
}

// TestOpenaiImageStreamHandlerClientDisconnectKeepsRequestedCount guards the
// billing invariant: completed-event counting must not lower the charge when
// the client aborts the stream. Upstream already generated (and charged for)
// all requested images, so a disconnect after the first completed event keeps
// the requested n instead of dropping it to 1.
func TestOpenaiImageStreamHandlerClientDisconnectKeepsRequestedCount(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := "data: {\"type\":\"image_generation.completed\",\"b64_json\":\"first\"}\n\n"
	c, recorder, resp, info := newDisconnectingImageStream(t, body, "first")
	info.PriceData.UsePrice = true
	info.PriceData.AddOtherRatio("n", 3)

	usage, err := OpenaiImageStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, usage)
	require.NotNil(t, info.StreamStatus)
	// A client abort surfaces as client_gone (main-loop ctx watch) or
	// handler_stop (failed client write); both must be treated as untrusted.
	require.Contains(t,
		[]relaycommon.StreamEndReason{relaycommon.StreamEndReasonClientGone, relaycommon.StreamEndReasonHandlerStop},
		info.StreamStatus.EndReason)
	require.Contains(t, recorder.Body.String(), `"b64_json":"first"`)
	require.Equal(t, 3.0, info.PriceData.OtherRatios()["n"], "client abort must not reduce the billed image count")
}

// TestOpenaiImageStreamHandlerClientDisconnectRaisesCount covers the other
// direction of the abort guard: when completed events already exceed the
// recorded n, the higher actual count is billed even though the client aborted.
func TestOpenaiImageStreamHandlerClientDisconnectRaisesCount(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"type":"image_generation.completed","b64_json":"first"}`,
		``,
		`data: {"type":"image_generation.completed","b64_json":"second"}`,
		``,
		``,
	}, "\n")
	c, _, resp, info := newDisconnectingImageStream(t, body, "second")
	info.PriceData.UsePrice = true
	info.PriceData.AddOtherRatio("n", 1)

	usage, err := OpenaiImageStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, usage)
	require.NotNil(t, info.StreamStatus)
	require.Contains(t,
		[]relaycommon.StreamEndReason{relaycommon.StreamEndReasonClientGone, relaycommon.StreamEndReasonHandlerStop},
		info.StreamStatus.EndReason)
	require.Equal(t, 2.0, info.PriceData.OtherRatios()["n"], "completed events beyond the recorded n must raise the charge even on abort")
}

// TestOpenaiImageStreamHandlerWrapsJSONResponse covers the non-SSE fallback:
// a JSON upstream response is wrapped into pseudo-SSE completed events.
func TestOpenaiImageStreamHandlerWrapsJSONResponse(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"created":1710000000,"data":[{"b64_json":"first","revised_prompt":"draw a cat"},{"b64_json":"second"}],"usage":{"input_tokens":3,"output_tokens":4,"total_tokens":7,"input_tokens_details":{"image_tokens":2,"text_tokens":1}}}`

	c, recorder, resp, info := newImageTestContext(t, body, "application/json", true)
	info.PriceData.UsePrice = true
	info.PriceData.AddOtherRatio("n", 3)

	usage, err := OpenaiImageStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.Equal(t, 3, usage.PromptTokens)
	require.Equal(t, 4, usage.CompletionTokens)
	require.Equal(t, 7, usage.TotalTokens)
	require.Equal(t, 2, usage.PromptTokensDetails.ImageTokens)
	require.Equal(t, 1, usage.PromptTokensDetails.TextTokens)
	require.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	require.Empty(t, recorder.Header().Get("Content-Length"))
	require.Contains(t, recorder.Body.String(), `event: image_generation.completed`)
	require.Contains(t, recorder.Body.String(), `"type":"image_generation.completed"`)
	require.Contains(t, recorder.Body.String(), `"b64_json":"first"`)
	require.Contains(t, recorder.Body.String(), `"b64_json":"second"`)
	require.Contains(t, recorder.Body.String(), `"revised_prompt":"draw a cat"`)
	require.Contains(t, recorder.Body.String(), `data: [DONE]`)
	require.Equal(t, 2, strings.Count(recorder.Body.String(), `event: image_generation.completed`))
	require.Equal(t, 2.0, info.PriceData.OtherRatios()["n"])
}

func TestOpenaiImageHandlerUsesPositiveActualCountForFixedPrice(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	longImage := strings.Repeat("a", 4096)

	tests := []struct {
		name      string
		body      string
		usePrice  bool
		wantCount float64
	}{
		{
			name:      "fixed price uses data length",
			body:      `{"data":[{"b64_json":"` + longImage + `"},{"b64_json":"second"}]}`,
			usePrice:  true,
			wantCount: 2,
		},
		{
			name:      "empty data keeps requested count",
			body:      `{"data":[]}`,
			usePrice:  true,
			wantCount: 3,
		},
		{
			name:      "ratio billing ignores data length",
			body:      `{"data":[{"b64_json":"first"},{"b64_json":"second"}]}`,
			usePrice:  false,
			wantCount: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, recorder, resp, info := newImageTestContext(t, tt.body, "application/json", false)
			info.PriceData.UsePrice = tt.usePrice
			info.PriceData.AddOtherRatio("n", 3)

			_, err := OpenaiImageHandler(c, info, resp)

			require.Nil(t, err)
			require.Equal(t, tt.wantCount, info.PriceData.OtherRatios()["n"])
			require.Equal(t, tt.body, recorder.Body.String())
		})
	}
}

// TestOpenaiImageHandlersReturnJSONError covers JSON error responses for both
// entry points: the non-streaming handler and the stream handler's non-SSE
// fallback. Neither must leak the error body to the client.
func TestOpenaiImageHandlersReturnJSONError(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"error":{"message":"content moderation failed","type":"upstream_error","code":"content_moderation_failed","status":502}}`

	t.Run("non-streaming handler", func(t *testing.T) {
		c, recorder, resp, info := newImageTestContext(t, body, "application/json", false)

		usage, err := OpenaiImageHandler(c, info, resp)
		require.Nil(t, usage)
		require.NotNil(t, err)
		require.Equal(t, http.StatusOK, err.StatusCode)
		oaiError := err.ToOpenAIError()
		require.Equal(t, "content moderation failed", oaiError.Message)
		require.Equal(t, "upstream_error", oaiError.Type)
		require.Equal(t, "content_moderation_failed", oaiError.Code)
		require.Empty(t, recorder.Body.String())
	})

	t.Run("stream handler JSON fallback", func(t *testing.T) {
		c, recorder, resp, info := newImageTestContext(t, body, "application/json", true)

		usage, err := OpenaiImageStreamHandler(c, info, resp)
		require.Nil(t, usage)
		require.NotNil(t, err)
		require.Equal(t, http.StatusOK, err.StatusCode)
		require.Equal(t, "content moderation failed", err.ToOpenAIError().Message)
		require.Empty(t, recorder.Body.String())
	})

	t.Run("stream handler non-2xx stays JSON error", func(t *testing.T) {
		c, recorder, resp, info := newImageTestContext(t, body, "application/json", true)
		resp.StatusCode = http.StatusBadGateway

		usage, err := OpenaiImageStreamHandler(c, info, resp)
		require.Nil(t, usage)
		require.NotNil(t, err)
		require.Equal(t, http.StatusBadGateway, err.StatusCode)
		require.Equal(t, "content moderation failed", err.ToOpenAIError().Message)
		require.Empty(t, recorder.Body.String())
		require.NotContains(t, recorder.Header().Get("Content-Type"), "text/event-stream")
	})
}

// TestOpenaiImageStreamHandlerRecordsUpstreamErrorEvent verifies that an error
// event inside the SSE stream is recorded as a soft error while the payload is
// still forwarded to the client.
func TestOpenaiImageStreamHandlerRecordsUpstreamErrorEvent(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`event: image_generation.partial_image`,
		`data: {"type":"image_generation.partial_image","b64_json":"partial"}`,
		``,
		`event: error`,
		`data: {"type":"upstream_error","error":{"message":"stream error: stream ID 77; INTERNAL_ERROR; received from peer"}}`,
		``,
	}, "\n")

	c, recorder, resp, info := newImageTestContext(t, body, "text/event-stream", true)

	usage, err := OpenaiImageStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonEOF, info.StreamStatus.EndReason)
	require.True(t, info.StreamStatus.HasErrors())
	require.Equal(t, 1, info.StreamStatus.TotalErrorCount())
	require.Contains(t, info.StreamStatus.Errors[0].Message, "INTERNAL_ERROR")
	// The scanner strips the upstream "event: error" line; the event name is
	// rebuilt from the JSON "type" field (upstream_error). The error message
	// is still forwarded in the data: payload (stream ID 77).
	require.Contains(t, recorder.Body.String(), `event: upstream_error`)
	require.Contains(t, recorder.Body.String(), `stream ID 77`)
}
