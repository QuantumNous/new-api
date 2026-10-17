package channel

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewTaskAPIRequestInheritsClientCancellation(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	requestContext, cancel := context.WithCancel(context.Background())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil).WithContext(requestContext)

	upstream, err := newTaskAPIRequest(c, "https://provider.example/tasks", nil)
	require.NoError(t, err)
	cancel()

	require.ErrorIs(t, upstream.Context().Err(), context.Canceled)
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

// TestProcessHeaderOverride_ChannelTestUsesClientHeaderFallback resolves a
// fallback template in channel tests: the fallback is config-defined and needs
// no client, so upstreams that require the header stay testable. The test
// request's own header is ignored — the fallback is what clients without the
// header will get, so it is what the test must verify.
func TestProcessHeaderOverride_ChannelTestUsesClientHeaderFallback(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	// The test harness happens to carry the header; a real client without it
	// would only get the fallback, so the test must see the fallback too.
	ctx.Request.Header.Set("X-Opencode-Session", "sess-harness")

	info := &relaycommon.RelayInfo{
		IsChannelTest: true,
		RequestId:     "req-1",
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"X-Opencode-Session": "{client_header:x-opencode-session|{request_id}}",
				"X-Trace-Id":         "{client_header:X-Trace-Id}",
			},
		},
	}

	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	// The fallback wins over the harness header.
	require.Equal(t, "req-1", headers["x-opencode-session"])
	// A client-header template without fallback is still skipped in channel tests.
	require.NotContains(t, headers, "x-trace-id")
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
	applyHeaderOverrideToRequest(upstreamReq, headers)
	require.Equal(t, "Codex CLI", upstreamReq.Header.Get("Originator"))
	require.Equal(t, "sess-123", upstreamReq.Header.Get("Session_id"))
	require.Empty(t, upstreamReq.Header.Get("X-Codex-Beta-Features"))
}

// TestProcessHeaderOverride_ClientHeaderFallbackResolvesToRequestID checks the
// fallback applies only when the client omits the header, and that a
// {request_id} fallback omits the whole header when the request ID is unknown.
func TestProcessHeaderOverride_ClientHeaderFallbackResolvesToRequestID(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		RequestId: "req-42",
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"X-Opencode-Session": "{client_header:x-opencode-session|{request_id}}",
			},
		},
	}

	// The client did not send the header: the fallback (request ID) applies.
	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "req-42", headers["x-opencode-session"])

	// The client sent the header: its value is forwarded verbatim.
	ctx.Request.Header.Set("X-Opencode-Session", "sess-client-1")
	headers, err = processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "sess-client-1", headers["x-opencode-session"])

	// A whitespace-only header is treated as absent: the fallback (request ID) applies.
	ctx.Request.Header.Set("X-Opencode-Session", "   ")
	headers, err = processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "req-42", headers["x-opencode-session"])

	// No client header and no request ID: the {request_id} fallback omits the whole header.
	ctx.Request.Header.Del("X-Opencode-Session")
	info.RequestId = ""
	headers, err = processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.NotContains(t, headers, "x-opencode-session")
}

// TestProcessHeaderOverride_RequestIDPlaceholder expands {request_id} and omits
// the header when the request ID is unknown.
func TestProcessHeaderOverride_RequestIDPlaceholder(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	newInfo := func(requestID string) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			RequestId: requestID,
			ChannelMeta: &relaycommon.ChannelMeta{
				HeadersOverride: map[string]any{
					"X-Opencode-Session": "{request_id}",
					"X-Request-Tag":      "id-{request_id}",
				},
			},
		}
	}

	headers, err := processHeaderOverride(newInfo("r-7"), ctx)
	require.NoError(t, err)
	require.Equal(t, "r-7", headers["x-opencode-session"])
	require.Equal(t, "id-r-7", headers["x-request-tag"])

	// Unknown request ID: the header is omitted instead of being left empty.
	headers, err = processHeaderOverride(newInfo(""), ctx)
	require.NoError(t, err)
	require.NotContains(t, headers, "x-opencode-session")
	require.NotContains(t, headers, "x-request-tag")
}

// TestProcessHeaderOverride_ClientHeaderPlaceholderRejectsInvalidSyntax rejects
// malformed client_header templates at channel-test time.
func TestProcessHeaderOverride_ClientHeaderPlaceholderRejectsInvalidSyntax(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Trace-Id", "trace-123")

	for _, value := range []string{
		"{client_header:}",
		"{client_header:X-Trace-Id|}",
		"{client_header:{request_id}}",
		"{client_header:X-Trace-Id} suffix",
	} {
		info := &relaycommon.RelayInfo{
			ChannelMeta: &relaycommon.ChannelMeta{
				HeadersOverride: map[string]any{
					"X-Upstream-Trace": value,
				},
			},
		}
		_, err := processHeaderOverride(info, ctx)
		require.Error(t, err, value)
	}
}

// TestProcessHeaderOverride_SetHeaderKeepsClientSessionAndFillsRequestID keeps the
// client session header and fills {request_id} only when it is missing.
func TestProcessHeaderOverride_SetHeaderKeepsClientSessionAndFillsRequestID(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Opencode-Session", "sess-client-1")

	info := func(clientSession string) *relaycommon.RelayInfo {
		requestHeaders := map[string]string{}
		if clientSession != "" {
			requestHeaders["X-Opencode-Session"] = clientSession
		}
		return &relaycommon.RelayInfo{
			RequestId:      "req-42",
			RequestHeaders: requestHeaders,
			ChannelMeta: &relaycommon.ChannelMeta{
				ParamOverride: map[string]any{
					"operations": []any{
						map[string]any{
							"mode":  "pass_headers",
							"value": []any{"X-Opencode-Session"},
						},
						map[string]any{
							"mode":        "set_header",
							"path":        "X-Opencode-Session",
							"value":       "{request_id}",
							"keep_origin": true,
						},
					},
				},
			},
		}
	}

	// The client sent a session header: the original value is kept.
	withSession := info("sess-client-1")
	_, err := relaycommon.ApplyParamOverrideWithRelayInfo([]byte(`{"model":"gpt-4.1"}`), withSession)
	require.NoError(t, err)
	headers, err := processHeaderOverride(withSession, ctx)
	require.NoError(t, err)
	require.Equal(t, "sess-client-1", headers["x-opencode-session"])

	// No client session header: the request ID fills it in.
	ctx.Request.Header.Del("X-Opencode-Session")
	withoutSession := info("")
	_, err = relaycommon.ApplyParamOverrideWithRelayInfo([]byte(`{"model":"gpt-4.1"}`), withoutSession)
	require.NoError(t, err)
	headers, err = processHeaderOverride(withoutSession, ctx)
	require.NoError(t, err)
	require.Equal(t, "req-42", headers["x-opencode-session"])
}

// TestProcessHeaderOverride_RequestDerivedValuesAreNotInterpolated locks the rule
// that client-supplied header content is forwarded verbatim while channel config
// text still expands its placeholders.
func TestProcessHeaderOverride_RequestDerivedValuesAreNotInterpolated(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Custom", "{api_key}")
	ctx.Request.Header.Set("X-Trace", "{request_id}")

	info := &relaycommon.RelayInfo{
		RequestId: "req-42",
		RequestHeaders: map[string]string{
			"X-Custom": "{api_key}",
			"X-Trace":  "{request_id}",
			"X-Beta":   "{api_key}",
			"X-Gamma":  "alpha",
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey: "sk-secret-key",
			ParamOverride: map[string]any{
				"operations": []any{
					map[string]any{
						"mode":  "pass_headers",
						"value": []any{"X-Custom"},
					},
					map[string]any{
						"mode": "copy_header",
						"from": "X-Trace",
						"to":   "X-Trace-Backup",
					},
					map[string]any{
						"mode": "sync_fields",
						"from": "json:trace",
						"to":   "header:X-Synced",
					},
					map[string]any{
						"mode":  "set_header",
						"path":  "X-Config-Tag",
						"value": "id-{request_id}",
					},
					map[string]any{
						"mode": "set_header",
						"path": "X-Beta",
						"value": map[string]any{
							"known": "known",
						},
					},
					map[string]any{
						"mode": "set_header",
						"path": "X-Gamma",
						"value": map[string]any{
							"$append": "{request_id}",
						},
					},
					map[string]any{
						"mode":  "set_header",
						"path":  "X-Cfg",
						"value": "{request_id}",
					},
					map[string]any{
						"mode": "sync_fields",
						"from": "header:X-Cfg",
						"to":   "header:X-Cfg-Copy",
					},
				},
			},
		},
	}

	_, err := relaycommon.ApplyParamOverrideWithRelayInfo([]byte(`{"model":"gpt-4.1","trace":"{api_key}"}`), info)
	require.NoError(t, err)
	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)

	// Request-derived content is forwarded verbatim: no {api_key} / {request_id} interpolation.
	require.Equal(t, "{api_key}", headers["x-custom"])
	require.Equal(t, "{request_id}", headers["x-trace-backup"])
	require.Equal(t, "{api_key}", headers["x-synced"])
	// A request token containing braces makes the whole value verbatim.
	require.Equal(t, "{api_key}", headers["x-beta"])
	// Values declared by channel config still interpolate.
	require.Equal(t, "id-req-42", headers["x-config-tag"])
	// In a mixed value the config-side placeholder still expands.
	require.Equal(t, "alpha,req-42", headers["x-gamma"])
	// sync_fields inherits the source provenance: both sides expand.
	require.Equal(t, "req-42", headers["x-cfg"])
	require.Equal(t, "req-42", headers["x-cfg-copy"])
}

// TestProcessHeaderOverride_ClientHeaderNameUsesPipeAsSeparator locks the change
// that "|" separates NAME from FALLBACK even when it appears in a header name.
func TestProcessHeaderOverride_ClientHeaderNameUsesPipeAsSeparator(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	// A "|" in the header name is still the separator: this parses as header name
	// X-Foo with fallback Bar, not as the request header named "X-Foo|Bar".
	ctx.Request.Header.Set("X-Foo|Bar", "legacy-name")
	ctx.Request.Header.Set("X-Foo", "new-name")

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"X-Upstream": "{client_header:X-Foo|Bar}",
			},
		},
	}
	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "new-name", headers["x-upstream"])
}

func TestToWebSocketURL(t *testing.T) {
	for input, want := range map[string]string{
		"https://api.openai.com/v1/responses":             "wss://api.openai.com/v1/responses",
		"http://127.0.0.1:3000/v1/responses":              "ws://127.0.0.1:3000/v1/responses",
		"wss://chatgpt.com/backend-api/codex/responses":   "wss://chatgpt.com/backend-api/codex/responses",
		"ws://127.0.0.1:3000/backend-api/codex/responses": "ws://127.0.0.1:3000/backend-api/codex/responses",
	} {
		assert.Equal(t, want, toWebSocketURL(input), input)
	}
}
