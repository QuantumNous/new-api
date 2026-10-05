package common_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func httpAuditFixture(t *testing.T) (*gin.Engine, *bytes.Buffer) {
	t.Helper()
	previousEnabled, previousWriter := common.HTTPAuditEnabled, gin.DefaultWriter
	t.Setenv("HTTP_AUDIT_ENABLED", "true")
	t.Setenv("HTTP_AUDIT_HMAC_KEY", "test-only-independent-audit-key-32-bytes")
	require.NoError(t, common.InitHTTPAudit())
	output := &bytes.Buffer{}
	gin.DefaultWriter = output
	t.Cleanup(func() {
		common.HTTPAuditEnabled, gin.DefaultWriter = previousEnabled, previousWriter
	})
	router := gin.New()
	router.Use(middleware.RequestId(), common.HTTPAuditMiddleware(), gin.Recovery())
	return router, output
}

func httpAuditEvents(t *testing.T, output *bytes.Buffer) []map[string]any {
	t.Helper()
	var events []map[string]any
	for line := range strings.SplitSeq(strings.TrimSpace(output.String()), "\n") {
		if !strings.HasPrefix(line, "{") {
			continue
		}
		assert.LessOrEqual(t, len(line), 16*1024)
		var event map[string]any
		require.NoError(t, common.Unmarshal([]byte(line), &event))
		events = append(events, event)
	}
	return events
}

type httpAuditRoundTripFunc func(*http.Request) (*http.Response, error)

func (function httpAuditRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return function(req)
}

func TestHTTPAuditInboundParametersPrivacyAndUnchangedResponse(t *testing.T) {
	router, output := httpAuditFixture(t)
	requestBody := `{"model":"demo","stream":false,"temperature":0,"max_tokens":42,"messages":[{"content":"private prompt"}],"image":"private image","unknown":"private extra"}`
	responseBody := `{"choices":[{"message":{"content":"private generation"}}],"usage":{"total_tokens":8}}`
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		storage, err := common.GetBodyStorage(c)
		require.NoError(t, err)
		defer storage.Close()
		body, err := storage.Bytes()
		require.NoError(t, err)
		assert.Equal(t, requestBody, string(body))
		c.Header("Set-Cookie", "private-session")
		c.Data(200, "application/json", []byte(responseBody))
	})
	req := httptest.NewRequest("POST", "/v1/chat/completions?key=query-secret&prompt=query-prompt", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer client-secret")
	req.Header.Set("Cookie", "session=private-cookie")
	req.Header.Set("X-New-API-Origin-Verify", "origin-secret")
	req.Header.Set("X-Request-ID", "edge-123")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	assert.Equal(t, responseBody, recorder.Body.String())
	assert.Equal(t, "private-session", recorder.Header().Get("Set-Cookie"))
	events := httpAuditEvents(t, output)
	require.Len(t, events, 1)
	event := events[0]
	assert.Equal(t, "success", event["outcome"])
	assert.Equal(t, "edge-123", event["edge_request_id"])
	assert.Equal(t, recorder.Header().Get(common.RequestIdKey), event["request_id"])
	assert.Equal(t, common.GenerateHMACWithKey([]byte("test-only-independent-audit-key-32-bytes"), "client-secret"), event["token_hash"])
	assert.Equal(t, map[string]any{"model": "demo", "stream": false, "temperature": float64(0), "max_tokens": float64(42)}, event["parameters"])
	assert.Equal(t, map[string]any{"total_tokens": float64(8)}, event["usage"])
	for _, secret := range []string{"private prompt", "private image", "private extra", "private generation", "private-session", "client-secret", "query-secret", "query-prompt", "private-cookie", "origin-secret"} {
		assert.NotContains(t, output.String(), secret)
	}
}

func TestHTTPAuditCachedBodyParametersPreserveReplay(t *testing.T) {
	for _, key := range []string{common.KeyBodyStorage, common.KeyRequestBody} {
		t.Run(key, func(t *testing.T) {
			router, output := httpAuditFixture(t)
			body := []byte(`{"model":"demo","messages":[{"content":"private cached prompt"}]}`)
			router.POST("/v1/chat/completions", func(c *gin.Context) {
				if key == common.KeyBodyStorage {
					storage, err := common.CreateBodyStorage(body)
					require.NoError(t, err)
					c.Set(key, storage)
				} else {
					c.Set(key, body)
				}
				defer common.CleanupBodyStorage(c)
				for range 2 {
					storage, err := common.GetBodyStorage(c)
					require.NoError(t, err)
					replayed, err := io.ReadAll(storage)
					require.NoError(t, err)
					assert.Equal(t, body, replayed)
				}
				c.JSON(200, gin.H{"success": true})
			})
			req := httptest.NewRequest("POST", "/v1/chat/completions", nil)
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(httptest.NewRecorder(), req)
			events := httpAuditEvents(t, output)
			require.Len(t, events, 1)
			assert.Equal(t, map[string]any{"model": "demo"}, events[0]["parameters"])
			assert.NotContains(t, output.String(), "private cached prompt")
		})
	}
}

func TestHTTPAuditRejectedRequestsWithoutReadingBody(t *testing.T) {
	for _, status := range []int{401, 413} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			router, output := httpAuditFixture(t)
			router.POST("/v1/chat/completions", func(c *gin.Context) { c.AbortWithStatus(status) })
			req := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"prompt":"private"}`))
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)
			events := httpAuditEvents(t, output)
			require.Len(t, events, 1)
			assert.Equal(t, float64(status), events[0]["status"])
			assert.Equal(t, "error", events[0]["outcome"])
			assert.Equal(t, true, events[0]["request_parameters_incomplete"])
			assert.Equal(t, float64(0), events[0]["upstream_attempts"])
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			assert.Equal(t, `{"prompt":"private"}`, string(body))
		})
	}
}

func TestHTTPAuditRetriesCorrelateAndPreserveReplay(t *testing.T) {
	router, output := httpAuditFixture(t)
	requestBody := `{"model":"demo","messages":[{"content":"private prompt"}]}`
	providerBodies := []string{`{"error":{"code":"busy","message":"retry later"}}`, `{"choices":[{"message":{"content":"private answer"}}]}`}
	call := 0
	client := &http.Client{Transport: common.WrapHTTPAuditTransport(httpAuditRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		assert.Equal(t, requestBody, string(body))
		replay, err := req.GetBody()
		require.NoError(t, err)
		defer replay.Close()
		replayed, err := io.ReadAll(replay)
		require.NoError(t, err)
		assert.Equal(t, requestBody, string(replayed))
		assert.Equal(t, "Bearer provider-secret", req.Header.Get("Authorization"))
		assert.Equal(t, "query-secret", req.URL.Query().Get("key"))
		status := 503
		if call == 1 {
			status = 200
		}
		response := &http.Response{StatusCode: status, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(providerBodies[call]))}
		call++
		return response, nil
	}))}
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		for channel := 1; channel <= 2; channel++ {
			req, err := http.NewRequestWithContext(common.WithHTTPAuditContext(ctx, c.Request.Context(), channel, 1), "POST", "https://user:url-secret@provider.invalid/chat?key=query-secret", strings.NewReader(requestBody))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer provider-secret")
			response, err := client.Do(req)
			require.NoError(t, err)
			body, err := io.ReadAll(response.Body)
			require.NoError(t, err)
			require.NoError(t, response.Body.Close())
			assert.Equal(t, providerBodies[channel-1], string(body))
			if response.StatusCode == 200 {
				c.Data(200, "application/json", body)
			}
		}
	})
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("POST", "/v1/chat/completions", nil))
	events := httpAuditEvents(t, output)
	require.Len(t, events, 3)
	assert.Equal(t, "error", events[0]["outcome"])
	assert.Equal(t, "success", events[1]["outcome"])
	assert.Equal(t, "success", events[2]["outcome"])
	assert.Equal(t, events[0]["request_id"], events[1]["request_id"])
	assert.Equal(t, events[1]["request_id"], events[2]["request_id"])
	assert.Equal(t, float64(1), events[0]["attempt_id"])
	assert.Equal(t, float64(2), events[1]["attempt_id"])
	assert.Equal(t, float64(2), events[2]["upstream_attempts"])
	assert.Equal(t, float64(2), events[1]["channel_id"])
	for _, value := range []string{"private prompt", "private answer", "provider-secret", "query-secret", "url-secret"} {
		assert.NotContains(t, output.String(), value)
	}
	assert.Contains(t, output.String(), "retry later")
}

func TestHTTPAuditProviderDiagnosticsAreBoundedWithoutLosingSmallSiblings(t *testing.T) {
	_, output := httpAuditFixture(t)
	message := strings.Repeat("large diagnostic", 3000)
	diagnostic, err := common.Marshal(map[string]any{"error": map[string]any{"code": "bad_request", "message": "helpful diagnostic", "details": message}})
	require.NoError(t, err)
	transport := common.WrapHTTPAuditTransport(httpAuditRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 400, Header: make(http.Header), Body: io.NopCloser(bytes.NewReader(diagnostic))}, nil
	}))
	req := httptest.NewRequest("POST", "https://provider.invalid/v1/chat", nil)
	response, err := transport.RoundTrip(req)
	require.NoError(t, err)
	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
	assert.Equal(t, diagnostic, body)
	events := httpAuditEvents(t, output)
	require.Len(t, events, 1)
	assert.Equal(t, true, events[0]["log_truncated"])
	assert.Equal(t, map[string]any{"error": map[string]any{"code": "bad_request", "message": "helpful diagnostic"}}, events[0]["diagnostic"])
	assert.Contains(t, events[0]["dropped_fields"], "/diagnostic/error/details")
}

func TestHTTPAuditSSEOutcomesAndContentPrivacy(t *testing.T) {
	for _, test := range []struct{ name, body, outcome string }{
		{"completed", "data: {\"choices\":[{\"delta\":{\"content\":\"private generation\"}}]}\n\ndata: [DONE]\n\n", "success"},
		{"error-in-200", "data: {\"error\":{\"code\":\"upstream_failed\",\"message\":\"diagnostic\"}}\n\ndata: [DONE]\n\n", "error"},
		{"no-terminal", "data: {\"choices\":[{\"delta\":{\"content\":\"private generation\"}}]}\n\n", "unknown"},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, output := httpAuditFixture(t)
			transport := common.WrapHTTPAuditTransport(httpAuditRoundTripFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(test.body))}, nil
			}))
			response, err := transport.RoundTrip(httptest.NewRequest("POST", "https://provider.invalid/v1/chat", nil))
			require.NoError(t, err)
			body, err := io.ReadAll(response.Body)
			require.NoError(t, err)
			require.NoError(t, response.Body.Close())
			assert.Equal(t, test.body, string(body))
			events := httpAuditEvents(t, output)
			require.Len(t, events, 1)
			assert.Equal(t, test.outcome, events[0]["outcome"])
			assert.NotContains(t, output.String(), "private generation")
		})
	}
}

func TestHTTPAuditStreamParserOverridesEOFAndOnlyLogsOnce(t *testing.T) {
	_, output := httpAuditFixture(t)
	transport := common.WrapHTTPAuditTransport(httpAuditRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"text/event-stream"}}, Body: io.NopCloser(strings.NewReader("data: [DONE]\n\n"))}, nil
	}))
	response, err := transport.RoundTrip(httptest.NewRequest("POST", "https://provider.invalid/v1/chat", nil))
	require.NoError(t, err)
	common.BeginHTTPAuditStream(response)
	_, err = io.ReadAll(response.Body)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
	assert.Empty(t, httpAuditEvents(t, output))
	status := relaycommon.NewStreamStatus()
	status.SetEndReason(relaycommon.StreamEndReasonTimeout, nil)
	common.FinishHTTPAuditStream(response, helper.HTTPAuditStreamResult(status))
	common.FinishHTTPAuditStream(response, helper.HTTPAuditStreamResult(status))
	events := httpAuditEvents(t, output)
	require.Len(t, events, 1)
	assert.Equal(t, "error", events[0]["outcome"])
	assert.Equal(t, "timeout", events[0]["stream_end"])
}

func TestHTTPAuditNetworkErrorHasNoInventedStatusOrRawURL(t *testing.T) {
	_, output := httpAuditFixture(t)
	transport := common.WrapHTTPAuditTransport(httpAuditRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		return nil, errors.New("dial https://user:private-key@provider.invalid/chat?secret=private-key: failed")
	}))
	response, err := transport.RoundTrip(httptest.NewRequest("POST", "https://provider.invalid/chat", nil))
	assert.Nil(t, response)
	require.Error(t, err)
	events := httpAuditEvents(t, output)
	require.Len(t, events, 1)
	assert.NotContains(t, events[0], "status")
	assert.Equal(t, "transport_error", events[0]["error_type"])
	assert.NotContains(t, output.String(), "private-key")
}

func TestHTTPAuditDisabledAndConfigValidation(t *testing.T) {
	previous := common.HTTPAuditEnabled
	t.Cleanup(func() { common.HTTPAuditEnabled = previous })
	t.Setenv("HTTP_AUDIT_ENABLED", "false")
	t.Setenv("HTTP_AUDIT_HMAC_KEY", "")
	require.NoError(t, common.InitHTTPAudit())
	transport := httpAuditRoundTripFunc(func(*http.Request) (*http.Response, error) { return nil, nil })
	assert.IsType(t, transport, common.WrapHTTPAuditTransport(transport))
	t.Setenv("HTTP_AUDIT_ENABLED", "true")
	require.Error(t, common.InitHTTPAudit())
	assert.False(t, common.HTTPAuditEnabled)
	t.Setenv("HTTP_AUDIT_HMAC_KEY", strings.Repeat("a", 32))
	require.NoError(t, common.InitHTTPAudit())
	t.Setenv("HTTP_AUDIT_ENABLED", "invalid")
	require.Error(t, common.InitHTTPAudit())
}

func TestHTTPAuditIncompleteSuccessBodyNeverBecomesDiagnostic(t *testing.T) {
	_, output := httpAuditFixture(t)
	transport := common.WrapHTTPAuditTransport(httpAuditRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(&httpAuditBrokenBody{})}, nil
	}))
	response, err := transport.RoundTrip(httptest.NewRequest("GET", "https://provider.invalid/generation", nil))
	require.NoError(t, err)
	_, err = io.ReadAll(response.Body)
	require.ErrorIs(t, err, io.ErrUnexpectedEOF)
	require.NoError(t, response.Body.Close())
	events := httpAuditEvents(t, output)
	require.Len(t, events, 1)
	assert.Equal(t, "error", events[0]["outcome"])
	assert.NotContains(t, events[0], "diagnostic")
	assert.NotContains(t, output.String(), "private generation")
}

type httpAuditBrokenBody struct{ read bool }

func (body *httpAuditBrokenBody) Read(data []byte) (int, error) {
	if body.read {
		return 0, io.ErrUnexpectedEOF
	}
	body.read = true
	return copy(data, `{"choices":[{"message":{"content":"private generation"}}]}`), nil
}

func TestHTTPAuditCopiesCorrelationWithoutChangingCancellation(t *testing.T) {
	router, _ := httpAuditFixture(t)
	router.GET("/v1/models", func(c *gin.Context) {
		original := context.WithValue(context.Background(), "preserved-test-value", "present")
		ctx, cancel := context.WithCancel(c.Request.Context())
		cancel()
		copied := common.WithHTTPAuditContext(original, ctx, 42, 1)
		assert.NoError(t, copied.Err())
		assert.Equal(t, "present", copied.Value("preserved-test-value"))
		_, hasDeadline := copied.Deadline()
		assert.False(t, hasDeadline)
		c.JSON(200, gin.H{"success": true})
	})
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/v1/models", nil))
}

func TestHTTPAuditRecoveryRecordsActual500(t *testing.T) {
	router, output := httpAuditFixture(t)
	router.GET("/panic", func(c *gin.Context) { panic("test panic") })
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest("GET", "/panic", nil))
	assert.Equal(t, 500, recorder.Code)
	events := httpAuditEvents(t, output)
	require.Len(t, events, 1)
	assert.Equal(t, float64(500), events[0]["status"])
	assert.Equal(t, "error", events[0]["outcome"])
}

func TestHTTPAuditLargeRequestMarksMissingParametersWithoutChangingPayload(t *testing.T) {
	router, output := httpAuditFixture(t)
	body := `{"model":"demo","prompt":"` + strings.Repeat("p", 1024*1024+1) + `","temperature":0.5}`
	router.POST("/v1/images/generations", func(c *gin.Context) {
		storage, err := common.GetBodyStorage(c)
		require.NoError(t, err)
		defer storage.Close()
		actual, err := storage.Bytes()
		require.NoError(t, err)
		assert.Equal(t, body, string(actual))
		c.JSON(200, gin.H{"success": true})
	})
	req := httptest.NewRequest("POST", "/v1/images/generations", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), req)
	events := httpAuditEvents(t, output)
	require.Len(t, events, 1)
	assert.Equal(t, true, events[0]["request_parameters_incomplete"])
	assert.Equal(t, map[string]any{"model": "demo"}, events[0]["parameters"])
	assert.NotContains(t, output.String(), "prompt")
}

func TestHTTPAuditRelayClientFactoriesUseAuditWithUnchangedResponses(t *testing.T) {
	_, output := httpAuditFixture(t)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, req *http.Request) {
		assert.Equal(t, "Bearer provider-secret", req.Header.Get("Authorization"))
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"choices":[],"usage":{"total_tokens":0}}`)
	}))
	defer server.Close()
	service.InitHttpClient()
	defer service.ResetProxyClientCache()
	for _, settings := range []dto.ChannelSettings{{}, {HTTPProtocol: dto.HTTPProtocolHTTP1}, {HTTP2ConnectionShards: 2}} {
		client, err := service.GetHttpClientWithProxySettings("", settings)
		require.NoError(t, err)
		req, err := http.NewRequest("GET", server.URL, nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer provider-secret")
		response, err := client.Do(req)
		require.NoError(t, err)
		body, err := io.ReadAll(response.Body)
		require.NoError(t, err)
		require.NoError(t, response.Body.Close())
		assert.Equal(t, `{"choices":[],"usage":{"total_tokens":0}}`, string(body))
	}
	events := httpAuditEvents(t, output)
	require.Len(t, events, 3)
	for _, event := range events {
		assert.Equal(t, "outbound", event["direction"])
		assert.Equal(t, float64(200), event["status"])
		assert.NotEmpty(t, event["request_id"])
	}
	assert.NotContains(t, output.String(), "provider-secret")
}
