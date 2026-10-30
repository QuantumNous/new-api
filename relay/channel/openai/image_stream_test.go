package openai

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
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

func TestImageExpressionUsesCompletedCountAndProtectsAbortedStreams(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	for _, tc := range []struct {
		name, body      string
		stream, abort   bool
		requested, want int
	}{
		{"JSON uses actual count", `{"data":[{"b64_json":"first"},{"b64_json":"second"}]}`, false, false, 3, 2},
		{"JSON wrapped as SSE uses actual count", `{"data":[{"b64_json":"first"}]}`, true, false, 3, 1},
		{"empty response retains request", `{"data":[]}`, false, false, 3, 3},
		{"JSON object data counts one image", `{"data":{"url":"https://example.com/a.png","b64_json":"first"}}`, false, false, 3, 1},
		{"JSON wrapped as SSE counts object data once", `{"data":{"b64_json":"first"}}`, true, false, 3, 1},
		{"completed stream refunds missing images", "data: {\"type\":\"image_generation.completed\",\"b64_json\":\"first\"}\n\ndata: [DONE]\n\n", true, false, 3, 1},
		{"client abort cannot reduce count", "data: {\"type\":\"image_generation.completed\",\"b64_json\":\"first\"}\n\n", true, true, 3, 3},
	} {
		t.Run(tc.name, func(t *testing.T) {
			contentType := "application/json"
			if strings.HasPrefix(tc.body, "data:") {
				contentType = "text/event-stream"
			}
			c, _, resp, info := newImageTestContext(t, tc.body, contentType, tc.stream)
			if tc.abort {
				c, _, resp, info = newDisconnectingImageStream(t, tc.body, "first")
			}
			info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{EstimatedImageCount: &tc.requested}
			if tc.stream {
				_, err := OpenaiImageStreamHandler(c, info, resp)
				require.Nil(t, err)
			} else {
				_, err := OpenaiImageHandler(c, info, resp)
				require.Nil(t, err)
			}
			count := info.RequestedImageCount()
			if info.BillingImageCount != nil {
				count = *info.BillingImageCount
			}
			assert.Equal(t, tc.want, count)
			assert.Empty(t, info.PriceData.OtherRatios(), "expression quantities must not add a legacy multiplier")
		})
	}
}

func TestImageCacheUsageAcrossResponseFormats(t *testing.T) {
	previousTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })
	// Contract fixture for compatible upstreams. Live OpenAI cache response
	// verification is a separate release check; this is not a captured response.
	const usageJSON = `{"input_tokens":1000,"output_tokens":100,"total_tokens":1100,"input_tokens_details":{"text_tokens":400,"image_tokens":600,"cached_tokens":300,"cached_tokens_details":{"text_tokens":100,"image_tokens":200}}}`
	for _, mode := range []string{"image_generation", "image_edit"} {
		for _, stream := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/stream=%t", mode, stream), func(t *testing.T) {
				body := `{"data":[{"b64_json":"image"}],"usage":` + usageJSON + `}`
				contentType := "application/json"
				if stream {
					body = "data: {\"type\":\"" + mode + ".completed\",\"usage\":" + usageJSON + "}\n\ndata: [DONE]\n\n"
					contentType = "text/event-stream"
				}
				ctx, recorder, response, info := newImageTestContext(t, body, contentType, stream)
				info.RelayMode = relayconstant.RelayModeImagesGenerations
				if mode == "image_edit" {
					info.RelayMode = relayconstant.RelayModeImagesEdits
					ctx.Request.URL.Path = "/v1/images/edits"
				}
				result, apiErr := (&Adaptor{}).DoResponse(ctx, response, info)
				require.Nil(t, apiErr)
				usage := result.(*dto.Usage)
				assert.Equal(t, 1000, usage.PromptTokens)
				assert.Equal(t, 300, usage.PromptTokensDetails.CachedTokens)
				require.NotNil(t, usage.PromptTokensDetails.CachedTokensDetails)
				assert.Equal(t, 200, *usage.PromptTokensDetails.CachedTokensDetails.ImageTokens)
				assert.Contains(t, recorder.Body.String(), `"cached_tokens_details":{"text_tokens":100,"image_tokens":200}`)
			})
		}
	}
}

func TestNormalizeOpenAIUsageMapsOutputImageTokens(t *testing.T) {
	previousTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })

	const usageJSON = `{"input_tokens":15,"output_tokens":1352,"total_tokens":1367,"input_tokens_details":{"text_tokens":15,"image_tokens":0},"output_tokens_details":{"image_tokens":1120,"text_tokens":232}}`
	for _, stream := range []bool{false, true} {
		t.Run(fmt.Sprintf("stream=%t", stream), func(t *testing.T) {
			body := `{"data":[{"b64_json":"image"}],"usage":` + usageJSON + `}`
			contentType := "application/json"
			if stream {
				body = "data: {\"type\":\"image_generation.completed\",\"usage\":" + usageJSON + "}\n\ndata: [DONE]\n\n"
				contentType = "text/event-stream"
			}
			ctx, _, response, info := newImageTestContext(t, body, contentType, stream)
			info.RelayMode = relayconstant.RelayModeImagesGenerations
			result, apiErr := (&Adaptor{}).DoResponse(ctx, response, info)
			require.Nil(t, apiErr)
			usage := result.(*dto.Usage)
			assert.Equal(t, 15, usage.PromptTokens)
			assert.Equal(t, 1352, usage.CompletionTokens)
			assert.Equal(t, 1120, usage.CompletionTokenDetails.ImageTokens)
			assert.Equal(t, 232, usage.CompletionTokenDetails.TextTokens)
		})
	}
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
		{
			name:      "object data with url and b64_json counts one image",
			body:      `{"data":{"url":"https://example.com/a.png","b64_json":"` + longImage + `"}}`,
			usePrice:  true,
			wantCount: 1,
		},
		{
			name:      "url and b64_json split across entries count one image",
			body:      `{"data":[{"url":"https://example.com/a.png"},{"b64_json":"` + longImage + `"}]}`,
			usePrice:  true,
			wantCount: 1,
		},
		{
			name:      "entries without image payload keep requested count",
			body:      `{"data":[{"revised_prompt":"draw a cat"}]}`,
			usePrice:  true,
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

// TestOpenaiImageStreamHandlerWrapsNonStandardDataShapes covers the JSON-to-SSE
// fallback when upstream returns data as an object, splits one image across a
// url entry and a b64_json entry, or returns entries without any image payload.
// Forwarded events and the billed quantity must both follow the real images.
func TestOpenaiImageStreamHandlerWrapsNonStandardDataShapes(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	for _, tc := range []struct {
		name       string
		body       string
		wantEvents int
		wantCount  float64
		wantBody   []string
	}{
		{
			name:       "object data is forwarded as one completed event",
			body:       `{"data":{"url":"https://example.com/a.png","b64_json":"first"}}`,
			wantEvents: 1,
			wantCount:  1,
			wantBody:   []string{`"url":"https://example.com/a.png"`, `"b64_json":"first"`},
		},
		{
			name:       "split url and b64_json entries bill one image",
			body:       `{"data":[{"url":"https://example.com/a.png"},{"b64_json":"first"}]}`,
			wantEvents: 2,
			wantCount:  1,
			wantBody:   []string{`"url":"https://example.com/a.png"`, `"b64_json":"first"`},
		},
		{
			name:       "entries without image payload are dropped and keep requested count",
			body:       `{"data":[{"revised_prompt":"draw a cat"}]}`,
			wantEvents: 0,
			wantCount:  3,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, recorder, resp, info := newImageTestContext(t, tc.body, "application/json", true)
			info.PriceData.UsePrice = true
			info.PriceData.AddOtherRatio("n", 3)

			_, err := OpenaiImageStreamHandler(c, info, resp)
			require.Nil(t, err)
			out := recorder.Body.String()
			assert.Equal(t, tc.wantEvents, strings.Count(out, "event: image_generation.completed"))
			assert.Equal(t, tc.wantEvents, info.ReceivedResponseCount)
			for _, want := range tc.wantBody {
				assert.Contains(t, out, want)
			}
			assert.True(t, strings.HasSuffix(out, "data: [DONE]\n\n"))
			assert.Equal(t, tc.wantCount, info.PriceData.OtherRatios()["n"])
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

func TestImageURLProxyStreamReportsRewriteFailure(t *testing.T) {
	t.Setenv("CRYPTO_SECRET", common.CryptoSecret)
	oldAddress, oldPublicAddress := system_setting.ServerAddress, system_setting.TaskPublicAddress
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	system_setting.TaskPublicAddress = ""
	t.Cleanup(func() {
		system_setting.ServerAddress, system_setting.TaskPublicAddress = oldAddress, oldPublicAddress
		constant.StreamingTimeout = oldTimeout
	})
	for _, tc := range []struct {
		name, path, target, address, wantMessage string
		enabled, upstreamOpen                    bool
		requested                                int
	}{
		{"generation invalid target", "/v1/images/generations", "ftp://upstream.example/image.png?secret=upstream", "https://gateway.example", service.ErrImageProxyInvalid.Error(), true, true, 3},
		{"edit invalid target", "/v1/images/edits", "ftp://upstream.example/image.png?secret=upstream", "https://gateway.example", service.ErrImageProxyInvalid.Error(), true, true, 3},
		{"invalid gateway address", "/v1/images/generations", "https://upstream.example/image.png?secret=upstream", "invalid", "image proxy base URL is invalid", true, false, 1},
		{"disabled keeps stream", "/v1/images/generations", "ftp://upstream.example/image.png?secret=upstream", "invalid", "", false, false, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			system_setting.ServerAddress = tc.address
			eventType := "image_generation"
			if tc.path == "/v1/images/edits" {
				eventType = "image_edit"
			}
			partial := `{"type":"` + eventType + `.partial_image","b64_json":"partial"}`
			completed := `{"type":"` + eventType + `.completed","url":"` + tc.target + `","usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}}`
			body := "data: " + partial + "\n\ndata: " + completed + "\n\ndata: {\"type\":\"unexpected_tail\"}\n\n"
			if !tc.upstreamOpen {
				body += "data: [DONE]\n\n"
			}
			c, recorder, resp, info := newImageTestContext(t, body, "text/event-stream", true)
			if tc.upstreamOpen {
				resp.Body = &blockingBody{chunk: []byte(body), closed: make(chan struct{})}
			}
			c.Request.URL.Path = tc.path
			common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{ImageURLProxy: tc.enabled})
			common.SetContextKey(c, constant.ContextKeyChannelId, 42)
			info.ImageRequestCount = tc.requested
			info.PriceData.UsePrice = true
			info.PriceData.AddOtherRatio("n", float64(tc.requested))

			usage, apiErr := OpenaiImageStreamHandler(c, info, resp)

			require.Nil(t, apiErr, "a response rewrite failure must not trigger a generation retry or refund")
			require.NotNil(t, usage)
			assert.Equal(t, 10, usage.PromptTokens)
			assert.Equal(t, 20, usage.CompletionTokens)
			assert.Equal(t, 30, usage.TotalTokens)
			assert.Equal(t, float64(tc.requested), info.PriceData.OtherRatios()["n"])
			assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
			var chunks []string
			for line := range strings.SplitSeq(recorder.Body.String(), "\n") {
				if data, ok := strings.CutPrefix(line, "data: "); ok {
					chunks = append(chunks, data)
				}
			}
			require.NotNil(t, info.StreamStatus)
			if !tc.enabled {
				require.Len(t, chunks, 4)
				assert.JSONEq(t, completed, chunks[1])
				assert.False(t, info.StreamStatus.HasErrors())
			} else {
				require.Len(t, chunks, 3)
				assert.JSONEq(t, fmt.Sprintf(`{"error":{"message":%q,"type":"new_api_error","param":"","code":"bad_response_body"}}`, tc.wantMessage), chunks[1])
				assert.True(t, info.StreamStatus.ResponseFailed())
				assert.Equal(t, 1, info.StreamStatus.TotalErrorCount())
				assert.NotContains(t, recorder.Body.String(), "upstream.example")
			}
			assert.JSONEq(t, partial, chunks[0])
			assert.Equal(t, "[DONE]", chunks[len(chunks)-1])
		})
	}
}

func TestImageURLProxyJSONStreamPreservesUsageOnRewriteFailure(t *testing.T) {
	t.Setenv("CRYPTO_SECRET", common.CryptoSecret)
	oldAddress, oldPublicAddress := system_setting.ServerAddress, system_setting.TaskPublicAddress
	system_setting.ServerAddress, system_setting.TaskPublicAddress = "https://gateway.example", ""
	t.Cleanup(func() {
		system_setting.ServerAddress, system_setting.TaskPublicAddress = oldAddress, oldPublicAddress
	})
	const validImage = `{"url":"https://upstream.example/image.png?secret=upstream"}`
	const invalidImage = `{"url":"ftp://upstream.example/image.png?secret=upstream"}`
	for _, tc := range []struct {
		name, path, data      string
		enabled               bool
		wantEvents, wantCount int
	}{
		{"first image fails", "/v1/images/generations", `[` + invalidImage + `,` + validImage + `]`, true, 0, 2},
		{"later image fails", "/v1/images/generations", `[` + validImage + `,` + invalidImage + `]`, true, 1, 2},
		{"object edit fails", "/v1/images/edits", invalidImage, true, 0, 1},
		{"disabled keeps URLs", "/v1/images/generations", `[` + validImage + `,` + invalidImage + `]`, false, 2, 2},
	} {
		for _, mode := range []string{"fixed", "expression"} {
			t.Run(tc.name+"/"+mode, func(t *testing.T) {
				body := `{"created":1710000000,"data":` + tc.data + `,"usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}}`
				c, recorder, resp, info := newImageTestContext(t, body, "application/json", true)
				c.Request.URL.Path = tc.path
				common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{ImageURLProxy: tc.enabled})
				common.SetContextKey(c, constant.ContextKeyChannelId, 42)
				requested := 3
				info.ImageRequestCount = requested
				if mode == "expression" {
					info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{EstimatedImageCount: &requested}
				} else {
					info.PriceData.UsePrice = true
					info.PriceData.AddOtherRatio("n", float64(requested))
				}

				usage, apiErr := OpenaiImageStreamHandler(c, info, resp)

				require.Nil(t, apiErr, "completed upstream usage must reach settlement instead of the refund path")
				require.NotNil(t, usage)
				assert.Equal(t, 10, usage.PromptTokens)
				assert.Equal(t, 20, usage.CompletionTokens)
				assert.Equal(t, 30, usage.TotalTokens)
				if mode == "expression" {
					require.NotNil(t, info.BillingImageCount)
					assert.Equal(t, tc.wantCount, *info.BillingImageCount)
					assert.Empty(t, info.PriceData.OtherRatios())
				} else {
					assert.Equal(t, float64(tc.wantCount), info.PriceData.OtherRatios()["n"])
				}
				output := recorder.Body.String()
				assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
				assert.Equal(t, tc.wantEvents, strings.Count(output, "event: image_generation.completed"))
				assert.Equal(t, tc.wantEvents, info.ReceivedResponseCount)
				var chunks []string
				for line := range strings.SplitSeq(output, "\n") {
					if data, ok := strings.CutPrefix(line, "data: "); ok {
						chunks = append(chunks, data)
					}
				}
				require.NotNil(t, info.StreamStatus)
				if tc.enabled {
					require.Len(t, chunks, tc.wantEvents+2)
					assert.JSONEq(t, `{"error":{"message":"image proxy token is invalid","type":"new_api_error","param":"","code":"bad_response_body"}}`, chunks[len(chunks)-2])
					assert.True(t, info.StreamStatus.ResponseFailed())
					assert.Equal(t, relaycommon.StreamEndReasonHandlerStop, info.StreamStatus.EndReason)
					assert.Equal(t, 1, info.StreamStatus.TotalErrorCount())
					assert.NotContains(t, output, "upstream.example")
				} else {
					require.Len(t, chunks, tc.wantEvents+1)
					assert.Contains(t, output, `"url":"ftp://upstream.example/image.png?secret=upstream"`)
					assert.False(t, info.StreamStatus.HasErrors())
				}
				assert.Equal(t, "[DONE]", chunks[len(chunks)-1])
			})
		}
	}
}

func TestImageURLProxyPreservesImageBillingAndUsage(t *testing.T) {
	t.Setenv("CRYPTO_SECRET", common.CryptoSecret)
	oldAddress, oldPublicAddress := system_setting.ServerAddress, system_setting.TaskPublicAddress
	oldTimeout := constant.StreamingTimeout
	system_setting.ServerAddress, system_setting.TaskPublicAddress = "https://gateway.example", ""
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		system_setting.ServerAddress, system_setting.TaskPublicAddress = oldAddress, oldPublicAddress
		constant.StreamingTimeout = oldTimeout
	})
	const upstreamURL = "https://upstream.example/private/image.png?secret=upstream"
	const usage = `"usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}`
	for _, tc := range []struct {
		name, path, body     string
		stream, sse, enabled bool
		count                float64
	}{
		{"generation JSON", "/v1/images/generations", `{"data":[{"url":"` + upstreamURL + `","b64_json":"QUFB"}],` + usage + `}`, false, false, true, 1},
		{"edit JSON object", "/v1/images/edits", `{"data":{"url":"` + upstreamURL + `","b64_json":"QUFB"},` + usage + `}`, false, false, true, 1},
		{"split payload", "/v1/images/generations", `{"data":[{"url":"` + upstreamURL + `"},{"b64_json":"QUFB"}],` + usage + `}`, false, false, true, 1},
		{"JSON converted to SSE", "/v1/images/generations", `{"data":[{"url":"` + upstreamURL + `","b64_json":"QUFB"}],` + usage + `}`, true, false, true, 1},
		{"edit SSE", "/v1/images/edits", "data: {\"type\":\"image_edit.completed\",\"url\":\"" + upstreamURL + "\",\"b64_json\":\"QUFB\"," + usage + "}\n\ndata: [DONE]\n\n", true, true, true, 1},
		{"disabled keeps JSON", "/v1/images/generations", `{"data":[{"url":"` + upstreamURL + `","b64_json":"QUFB"}],` + usage + `}`, false, false, false, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			contentType := "application/json"
			if tc.sse {
				contentType = "text/event-stream"
			}
			c, recorder, resp, info := newImageTestContext(t, tc.body, contentType, tc.stream)
			c.Request.URL.Path = tc.path
			common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{ImageURLProxy: tc.enabled})
			common.SetContextKey(c, constant.ContextKeyChannelId, 42)
			resp.Header.Set("Location", upstreamURL)
			upstreamContentType := contentType + `; profile="https://upstream.example/schema"`
			resp.Header.Set("Content-Type", upstreamContentType)
			info.PriceData.UsePrice = true
			info.PriceData.AddOtherRatio("n", 3)
			if tc.stream {
				result, err := OpenaiImageStreamHandler(c, info, resp)
				require.Nil(t, err)
				assert.Equal(t, 30, result.TotalTokens)
			} else {
				result, err := OpenaiImageHandler(c, info, resp)
				require.Nil(t, err)
				assert.Equal(t, 30, result.TotalTokens)
			}
			assert.Equal(t, tc.count, info.PriceData.OtherRatios()["n"])
			assert.Contains(t, recorder.Body.String(), `"b64_json":"QUFB"`)
			if !tc.enabled {
				assert.Equal(t, tc.body, recorder.Body.String())
				assert.Equal(t, upstreamURL, recorder.Header().Get("Location"))
				assert.Equal(t, upstreamContentType, recorder.Header().Get("Content-Type"))
				return
			}
			assert.NotContains(t, recorder.Body.String(), "upstream.example")
			assert.Empty(t, recorder.Header().Get("Location"))
			assert.NotContains(t, fmt.Sprint(recorder.Header()), "upstream.example")
			output := recorder.Body.String()
			if tc.stream {
				for _, line := range strings.Split(output, "\n") {
					if strings.HasPrefix(line, "data:") && strings.Contains(line, `"url"`) {
						output = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
						break
					}
				}
			}
			link := gjson.Get(output, "data.0.url").String()
			if link == "" {
				link = gjson.Get(output, "data.url").String()
			}
			if link == "" {
				link = gjson.Get(output, "url").String()
			}
			parsed, err := url.Parse(link)
			require.NoError(t, err)
			assert.Equal(t, "gateway.example", parsed.Host)
			target, err := service.ReadImageProxyToken(parsed.Query().Get("token"))
			require.NoError(t, err)
			assert.Equal(t, upstreamURL, target.URL)
			assert.Equal(t, 42, target.ChannelID)
		})
	}
}
