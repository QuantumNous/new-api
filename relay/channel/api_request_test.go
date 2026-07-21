package channel

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type wssHostTestAdaptor struct {
	Adaptor
	requestURL string
}

type blockingCloseReadCloser struct {
	unblock <-chan struct{}
}

func (blockingCloseReadCloser) Read([]byte) (int, error) {
	return 0, io.EOF
}

func (r blockingCloseReadCloser) Close() error {
	select {
	case <-r.unblock:
	case <-time.After(500 * time.Millisecond):
	}
	return nil
}

func (a wssHostTestAdaptor) GetRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.requestURL, nil
}

func (wssHostTestAdaptor) SetupRequestHeader(_ *gin.Context, _ *http.Header, _ *relaycommon.RelayInfo) error {
	return nil
}

func TestProcessHeaderOverride_ChannelTestSkipsPassthroughRules(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Trace-Id", "trace-123")

	info := &relaycommon.RelayInfo{
		IsChannelTest: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"*": "",
			},
		},
	}

	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Empty(t, headers)
}

func TestRecordAttemptUpstreamHostUsesResolvedRequestURL(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodPost, "https://Actual.Example:8443/v1/responses", nil)
	info := &relaycommon.RelayInfo{}
	recordAttemptUpstreamHost(req, info)
	require.Equal(t, "actual.example", info.AttemptUpstreamHost)
}

func TestGetRequestURLUsesConfiguredImageRouteSnapshot(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		ImageRoutingProtocol:     dto.ImageRoutingProtocolImagesGenerations,
		ImageRoutingUpstreamPath: "/custom/v1/images/generations",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://images.example.com/",
		},
	}

	requestURL, err := getRequestURL(wssHostTestAdaptor{requestURL: "https://wrong.example.com/v1/images/generations"}, info)
	require.NoError(t, err)
	require.Equal(t, "https://images.example.com/custom/v1/images/generations", requestURL)
}

func TestGetRequestURLPreservesAdaptorQueryAndExpandsImageModelPath(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		ImageRoutingProtocol:     dto.ImageRoutingProtocolGeminiGenerate,
		ImageRoutingUpstreamPath: "/v1beta/models/{model}:generateContent",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://generativelanguage.googleapis.com",
			UpstreamModelName: "gemini-3.1-flash-image-preview",
		},
	}

	requestURL, err := getRequestURL(wssHostTestAdaptor{
		requestURL: "https://generativelanguage.googleapis.com/v1beta/models/default:generateContent?key=secret",
	}, info)
	require.NoError(t, err)
	require.Equal(
		t,
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=secret",
		requestURL,
	)
}

func TestGetRequestURLPreservesVertexProviderPrefix(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		ImageRoutingProtocol:     dto.ImageRoutingProtocolGeminiGenerate,
		ImageRoutingUpstreamPath: "/v1beta/models/{model}:generateContent",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeVertexAi,
			UpstreamModelName: "gemini-3.1-flash-image-preview",
		},
	}

	requestURL, err := getRequestURL(wssHostTestAdaptor{
		requestURL: "https://aiplatform.googleapis.com/v1/projects/project-1/locations/global/publishers/google/models/default:generateContent?key=secret",
	}, info)
	require.NoError(t, err)
	require.Equal(
		t,
		"https://aiplatform.googleapis.com/v1/projects/project-1/locations/global/publishers/google/models/gemini-3.1-flash-image-preview:generateContent?key=secret",
		requestURL,
	)
}

func TestGetRequestURLPreservesAdvancedCustomAbsoluteTargetHost(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		ImageRoutingProtocol:     dto.ImageRoutingProtocolAdapter,
		ImageRoutingUpstreamPath: "/custom/images/generations",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeAdvancedCustom,
		},
	}

	requestURL, err := getRequestURL(wssHostTestAdaptor{
		requestURL: "https://provider.example/private/route?signature=secret",
	}, info)
	require.NoError(t, err)
	require.Equal(t, "https://provider.example/custom/images/generations?signature=secret", requestURL)
}

func TestRecordAttemptUpstreamURLSupportsWebSocketRoutes(t *testing.T) {
	t.Parallel()

	upstreamURL, err := url.Parse("wss://Realtime.Example:8443/v1/realtime")
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{}
	recordAttemptUpstreamURL(upstreamURL, info)
	require.Equal(t, "realtime.example", info.AttemptUpstreamHost)
}

func TestDoWssRequestRecordsResolvedHostBeforeDialFailure(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "websocket unavailable", http.StatusServiceUnavailable)
	}))
	t.Cleanup(server.Close)
	serverURL, err := url.Parse(server.URL)
	require.NoError(t, err)
	wssURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/v1/realtime"

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/realtime", nil)
	info := &relaycommon.RelayInfo{}

	conn, err := DoWssRequest(wssHostTestAdaptor{requestURL: wssURL}, c, info, io.Reader(nil))
	require.Error(t, err)
	require.Nil(t, conn)
	require.Equal(t, serverURL.Hostname(), info.AttemptUpstreamHost)
}

func TestDoRequestDoesNotExposeSSEHeadersForRejectedStream(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"message":"rate limited"}}`))
	}))
	t.Cleanup(server.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{}"))
	req, err := http.NewRequest(http.MethodPost, server.URL+"/v1/responses", strings.NewReader("{}"))
	require.NoError(t, err)

	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	t.Cleanup(func() { _ = resp.Body.Close() })
	require.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	assert.Empty(t, recorder.Header().Get("Content-Type"))
	assert.Empty(t, recorder.Header().Get("Transfer-Encoding"))
	assert.False(t, c.Writer.Written())
}

func TestDoRequestDefersSSEHeadersUntilAcceptedBodyHandler(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{}"))
	req, err := http.NewRequest(http.MethodPost, server.URL+"/v1/responses", strings.NewReader("{}"))
	require.NoError(t, err)

	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{
		IsStream:    true,
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	t.Cleanup(func() { _ = resp.Body.Close() })
	require.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Empty(t, recorder.Header().Get("Content-Type"))
	assert.Empty(t, recorder.Header().Get("Transfer-Encoding"))
	assert.False(t, c.Writer.Written())
}

func TestDoRequestBoundsCapacityFallbackResponseHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
			return
		case <-time.After(500 * time.Millisecond):
			w.WriteHeader(http.StatusOK)
		}
	}))
	t.Cleanup(server.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{}"))
	req, err := http.NewRequest(http.MethodPost, server.URL+"/v1/responses", strings.NewReader("{}"))
	require.NoError(t, err)

	startedAt := time.Now()
	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{
		IsStream:                       true,
		ChannelMeta:                    &relaycommon.ChannelMeta{},
		CapacityFallbackHeaderDeadline: startedAt.Add(50 * time.Millisecond),
	})
	require.ErrorIs(t, err, ErrCapacityFallbackHeaderDeadline)
	require.Nil(t, resp)
	assert.Less(t, time.Since(startedAt), 300*time.Millisecond)
}

func TestDoRequestKeepsCapacityDeadlineUntilCompleteResponseHeaders(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	stopServer := make(chan struct{})
	serverDone := make(chan struct{})
	go func() {
		defer close(serverDone)
		conn, acceptErr := listener.Accept()
		if acceptErr != nil {
			return
		}
		defer conn.Close()
		requestBytes := make([]byte, 1024)
		_, _ = conn.Read(requestBytes)
		_, _ = io.WriteString(conn, "HTTP/1.1 200")
		select {
		case <-stopServer:
		case <-time.After(500 * time.Millisecond):
		}
	}()
	t.Cleanup(func() {
		close(stopServer)
		_ = listener.Close()
		<-serverDone
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{}"))
	req, err := http.NewRequest(http.MethodPost, "http://"+listener.Addr().String()+"/v1/responses", strings.NewReader("{}"))
	require.NoError(t, err)

	startedAt := time.Now()
	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{
		IsStream:                       true,
		ChannelMeta:                    &relaycommon.ChannelMeta{},
		CapacityFallbackHeaderDeadline: startedAt.Add(50 * time.Millisecond),
	})
	require.ErrorIs(t, err, ErrCapacityFallbackHeaderDeadline)
	require.Nil(t, resp)
	assert.Less(t, time.Since(startedAt), 300*time.Millisecond)
}

func TestDoRequestCapacityFallbackDeadlineStopsAtResponseHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		time.Sleep(100 * time.Millisecond)
		_, _ = w.Write([]byte("data: ok\n\n"))
	}))
	t.Cleanup(server.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{}"))
	req, err := http.NewRequest(http.MethodPost, server.URL+"/v1/responses", strings.NewReader("{}"))
	require.NoError(t, err)

	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{
		IsStream:                       true,
		ChannelMeta:                    &relaycommon.ChannelMeta{},
		CapacityFallbackHeaderDeadline: time.Now().Add(50 * time.Millisecond),
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	t.Cleanup(func() { _ = resp.Body.Close() })

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, "data: ok\n\n", string(body))
}

func TestDoRequestPreservesClientCancellationCause(t *testing.T) {
	requestStarted := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		close(requestStarted)
		select {
		case <-r.Context().Done():
		case <-time.After(500 * time.Millisecond):
		}
	}))
	t.Cleanup(server.Close)

	requestContext, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{}")).WithContext(requestContext)
	req, err := http.NewRequestWithContext(requestContext, http.MethodPost, server.URL+"/v1/responses", strings.NewReader("{}"))
	require.NoError(t, err)

	result := make(chan error, 1)
	go func() {
		_, requestErr := DoRequest(c, req, &relaycommon.RelayInfo{
			IsStream:                       true,
			ChannelMeta:                    &relaycommon.ChannelMeta{},
			CapacityFallbackHeaderDeadline: time.Now().Add(time.Second),
		})
		result <- requestErr
	}()

	<-requestStarted
	cancel()
	require.ErrorIs(t, <-result, context.Canceled)
}

func TestDoRequestPrefersClientCancellationOverExpiredFallbackDeadline(t *testing.T) {
	requestContext, cancel := context.WithCancel(context.Background())
	cancel()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader("{}")).WithContext(requestContext)
	req, err := http.NewRequestWithContext(requestContext, http.MethodPost, "http://127.0.0.1:1/v1/responses", strings.NewReader("{}"))
	require.NoError(t, err)

	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{
		IsStream:                       true,
		ChannelMeta:                    &relaycommon.ChannelMeta{},
		CapacityFallbackHeaderDeadline: time.Now().Add(-time.Second),
	})
	require.Nil(t, resp)
	require.ErrorIs(t, err, context.Canceled)
	assert.NotErrorIs(t, err, ErrCapacityFallbackHeaderDeadline)
}

func TestCancelOnDoneReadCloserCancelsBeforeUnderlyingClose(t *testing.T) {
	unblock := make(chan struct{})
	canceled := make(chan struct{})
	body := &cancelOnDoneReadCloser{
		ReadCloser: blockingCloseReadCloser{unblock: unblock},
		cancel: func() {
			close(canceled)
			close(unblock)
		},
	}

	closed := make(chan struct{})
	go func() {
		_ = body.Close()
		close(closed)
	}()

	select {
	case <-canceled:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("derived request context was not canceled before the underlying body close")
	}
	select {
	case <-closed:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("response body close remained blocked after context cancellation")
	}
}

func TestProcessHeaderOverride_ChannelTestSkipsClientHeaderPlaceholder(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Trace-Id", "trace-123")

	info := &relaycommon.RelayInfo{
		IsChannelTest: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"X-Upstream-Trace": "{client_header:X-Trace-Id}",
			},
		},
	}

	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	_, ok := headers["x-upstream-trace"]
	require.False(t, ok)
}

func TestProcessHeaderOverride_NonTestKeepsClientHeaderPlaceholder(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Trace-Id", "trace-123")

	info := &relaycommon.RelayInfo{
		IsChannelTest: false,
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"X-Upstream-Trace": "{client_header:X-Trace-Id}",
			},
		},
	}

	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "trace-123", headers["x-upstream-trace"])
}

func TestProcessHeaderOverride_RuntimeOverrideIsFinalHeaderMap(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		IsChannelTest:             false,
		UseRuntimeHeadersOverride: true,
		RuntimeHeadersOverride: map[string]any{
			"x-static":  "runtime-value",
			"x-runtime": "runtime-only",
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"X-Static": "legacy-value",
				"X-Legacy": "legacy-only",
			},
		},
	}

	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "runtime-value", headers["x-static"])
	require.Equal(t, "runtime-only", headers["x-runtime"])
	_, exists := headers["x-legacy"]
	require.False(t, exists)
}

func TestProcessHeaderOverride_PassthroughSkipsAcceptEncoding(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Trace-Id", "trace-123")
	ctx.Request.Header.Set("Accept-Encoding", "gzip")

	info := &relaycommon.RelayInfo{
		IsChannelTest: false,
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"*": "",
			},
		},
	}

	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "trace-123", headers["x-trace-id"])

	_, hasAcceptEncoding := headers["accept-encoding"]
	require.False(t, hasAcceptEncoding)
}

func TestProcessHeaderOverride_PassHeadersTemplateSetsRuntimeHeaders(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	ctx.Request.Header.Set("Originator", "Codex CLI")
	ctx.Request.Header.Set("Session_id", "sess-123")

	info := &relaycommon.RelayInfo{
		IsChannelTest: false,
		RequestHeaders: map[string]string{
			"Originator": "Codex CLI",
			"Session_id": "sess-123",
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ParamOverride: map[string]any{
				"operations": []any{
					map[string]any{
						"mode":  "pass_headers",
						"value": []any{"Originator", "Session_id", "X-Codex-Beta-Features"},
					},
				},
			},
			HeadersOverride: map[string]any{
				"X-Static": "legacy-value",
			},
		},
	}

	_, err := relaycommon.ApplyParamOverrideWithRelayInfo([]byte(`{"model":"gpt-4.1"}`), info)
	require.NoError(t, err)
	require.True(t, info.UseRuntimeHeadersOverride)
	require.Equal(t, "Codex CLI", info.RuntimeHeadersOverride["originator"])
	require.Equal(t, "sess-123", info.RuntimeHeadersOverride["session_id"])
	_, exists := info.RuntimeHeadersOverride["x-codex-beta-features"]
	require.False(t, exists)
	require.Equal(t, "legacy-value", info.RuntimeHeadersOverride["x-static"])

	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "Codex CLI", headers["originator"])
	require.Equal(t, "sess-123", headers["session_id"])
	_, exists = headers["x-codex-beta-features"]
	require.False(t, exists)

	upstreamReq := httptest.NewRequest(http.MethodPost, "https://example.com/v1/responses", nil)
	ApplyHeaderOverrideToRequest(upstreamReq, headers)
	require.Equal(t, "Codex CLI", upstreamReq.Header.Get("Originator"))
	require.Equal(t, "sess-123", upstreamReq.Header.Get("Session_id"))
	require.Empty(t, upstreamReq.Header.Get("X-Codex-Beta-Features"))
}
