package channel

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	rootconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTaskRequestDefinitelyNotSentMarkerWrapsPreSendErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	_, err := DoTaskApiRequest(taskPreSendErrorAdaptor{urlErr: errors.New("bad url")}, ctx, info, nil)
	require.Error(t, err)
	require.True(t, IsDefinitelyNotSent(err), "BuildRequestURL error happens before request send")

	_, err = DoTaskApiRequest(taskPreSendErrorAdaptor{url: "https://example.invalid", headerErr: errors.New("no credential")}, ctx, info, nil)
	require.Error(t, err)
	require.True(t, IsDefinitelyNotSent(err), "BuildRequestHeader error happens before request send")
}

func TestTaskRequestDoRequestErrorsAreNotMarkedDefinitelyNotSent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	baseRequest := httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	requestContext, cancel := context.WithCancel(baseRequest.Context())
	cancel()
	ctx.Request = baseRequest.WithContext(requestContext)

	_, err := DoTaskApiRequest(taskPreSendErrorAdaptor{url: "https://example.invalid"}, ctx, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}, nil)
	require.Error(t, err)
	require.False(t, IsDefinitelyNotSent(err), "doRequest errors are ambiguous for POST replay")
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

func TestProcessHeaderOverride_PassthroughSkipsPaymentHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	protected := []string{"Payment-Signature", "X-Payment", "X-Blockrun-Facilitator", "X-Payer-Wallet"}
	for _, rule := range []string{"*", `regex:^(?i:payment-signature|x-payment|x-blockrun-facilitator|x-payer-wallet|x-trace-id)$`} {
		t.Run(rule, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			for _, name := range protected {
				ctx.Request.Header.Set(name, "client-controlled")
			}
			ctx.Request.Header.Set("X-Trace-Id", "trace-123")
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{HeadersOverride: map[string]any{rule: ""}}}

			headers, err := processHeaderOverride(info, ctx)
			require.NoError(t, err)
			require.Equal(t, "trace-123", headers["x-trace-id"])
			for _, name := range protected {
				require.NotContains(t, headers, strings.ToLower(name))
			}
		})
	}
}

func TestProcessHeaderOverride_ExplicitPaymentHeaderRemainsAvailableOutsideType100(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType:     rootconstant.ChannelTypeBlockRunSeedance,
		HeadersOverride: map[string]any{"X-Payer-Wallet": "operator-value"},
	}}
	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	require.Equal(t, "operator-value", headers["x-payer-wallet"])
}

func TestDoRequest_BlockRunRedirectPolicyIsRequestScoped(t *testing.T) {
	service.InitHttpClient()
	t.Cleanup(service.ResetProxyClientCache)

	var destinationHits atomic.Int32
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		destinationHits.Add(1)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer destination.Close()

	var sameOriginHits atomic.Int32
	var source *httptest.Server
	source = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/same-origin" {
			sameOriginHits.Add(1)
			w.WriteHeader(http.StatusNoContent)
			return
		}
		switch r.URL.Path {
		case "/redirect-same":
			status := http.StatusFound
			if raw := r.URL.Query().Get("status"); raw != "" {
				status, _ = strconv.Atoi(raw)
			}
			http.Redirect(w, r, source.URL+"/same-origin", status)
		case "/redirect-cross":
			http.Redirect(w, r, destination.URL, http.StatusFound)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer source.Close()

	request := func(path string, channelType int, signed bool) *http.Response {
		t.Helper()
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		req, err := http.NewRequest(http.MethodPost, source.URL+path, strings.NewReader("{}"))
		require.NoError(t, err)
		if signed {
			req.Header.Set("Payment-Signature", "signed-payload")
		}
		resp, err := doRequest(ctx, req, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channelType}})
		require.NoError(t, err)
		t.Cleanup(func() { _ = resp.Body.Close() })
		return resp
	}

	require.Equal(t, http.StatusFound, request("/redirect-cross", rootconstant.ChannelTypeBlockRun, false).StatusCode)
	require.EqualValues(t, 0, destinationHits.Load(), "unsigned Type 100 must not follow cross-origin redirects")
	for _, status := range []int{http.StatusMovedPermanently, http.StatusFound, http.StatusSeeOther, http.StatusTemporaryRedirect, http.StatusPermanentRedirect} {
		require.Equal(t, status, request("/redirect-same?status="+strconv.Itoa(status), rootconstant.ChannelTypeBlockRun, true).StatusCode)
	}
	require.EqualValues(t, 0, sameOriginHits.Load(), "signed Type 100 must not follow any redirect")
	baseClient := &http.Client{}
	nonBlockRunReq, err := http.NewRequest(http.MethodPost, source.URL+"/redirect-cross", nil)
	require.NoError(t, err)
	nonBlockRun := clientForRelayRequest(baseClient, nonBlockRunReq, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: rootconstant.ChannelTypeOpenAI}})
	require.Same(t, baseClient, nonBlockRun, "non-Type 100 must keep the shared client and redirect behavior")
}

func TestClientForRelayRequest_BlockRunPreservesRedirectPolicy(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "https://blockrun.example/v1/chat/completions", nil)
	require.NoError(t, err)
	next, err := http.NewRequest(http.MethodGet, "https://blockrun.example/redirected", nil)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: rootconstant.ChannelTypeBlockRun}}

	var hookCalls atomic.Int32
	wantErr := errors.New("custom redirect rejected")
	client := &http.Client{CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
		hookCalls.Add(1)
		return wantErr
	}}
	redirectClient := clientForRelayRequest(client, req, info)
	require.ErrorIs(t, redirectClient.CheckRedirect(next, []*http.Request{req}), wantErr)
	require.EqualValues(t, 1, hookCalls.Load())

	defaultClient := clientForRelayRequest(&http.Client{}, req, info)
	require.NoError(t, defaultClient.CheckRedirect(next, []*http.Request{req}))
	via := make([]*http.Request, 10)
	require.EqualError(t, defaultClient.CheckRedirect(next, via), "stopped after 10 redirects")
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

func TestDoApiRequestUsesGinRequestContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	requestReachedUpstream := make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestReachedUpstream <- struct{}{}
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	baseRequest := httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	requestContext, cancel := context.WithCancel(baseRequest.Context())
	cancel()
	ctx.Request = baseRequest.WithContext(requestContext)

	resp, err := DoApiRequest(
		requestContextAdaptor{url: server.URL},
		ctx,
		&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}},
		strings.NewReader(`{"model":"gpt-5"}`),
	)
	if resp != nil && resp.Body != nil {
		_ = resp.Body.Close()
	}

	require.Error(t, err)
	select {
	case <-requestReachedUpstream:
		t.Fatal("upstream request should inherit the cancelled gin request context")
	default:
	}
}

func TestGrokSubscriptionHeaderOverrideDisabledForTextAndMedia(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	for _, tc := range []struct {
		name      string
		relayMode int
		wantAuth  string
	}{
		{name: "text", relayMode: relayconstant.RelayModeResponses, wantAuth: "Bearer text-oauth-token"},
		{name: "media", relayMode: relayconstant.RelayModeImagesGenerations, wantAuth: "Bearer media-oauth-token"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var gotHeader http.Header
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotHeader = r.Header.Clone()
				w.WriteHeader(http.StatusOK)
			}))
			t.Cleanup(upstream.Close)

			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{}`))
			ctx.Request.Header.Set("Content-Type", "application/json")
			ctx.Request.Header.Set("Originator", "Codex CLI")

			info := &relaycommon.RelayInfo{
				RelayMode: tc.relayMode,
				ChannelMeta: &relaycommon.ChannelMeta{
					ApiType: rootconstant.APITypeGrokSubscription,
					ApiKey:  `{"access_token":"credential-json-token","refresh_token":"refresh","expires_at":4102444800}`,
					HeadersOverride: map[string]any{
						"Authorization":       "Bearer override",
						"X-Injected":          "{api_key}",
						"Originator":          "{client_header:Originator}",
						"X-Grok-Client-Id":    "override-client",
						"X-XAI-Token-Auth":    "override-cli-auth",
						"X-Request-Id":        "override-request",
						"X-Upstream-Custom":   "custom",
						"X-Codex-Cli-Header":  "codex",
						"X-Grok-Cli-Identity": "cli",
					},
				},
			}

			resp, err := DoApiRequest(grokHeaderIsolationAdaptor{url: upstream.URL, auth: tc.wantAuth}, ctx, info, strings.NewReader(`{}`))
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, tc.wantAuth, gotHeader.Get("Authorization"))
			for _, forbidden := range []string{
				"Originator",
				"X-Injected",
				"X-Grok-Client-Id",
				"X-XAI-Token-Auth",
				"X-Request-Id",
				"X-Upstream-Custom",
				"X-Codex-Cli-Header",
				"X-Grok-Cli-Identity",
			} {
				require.Empty(t, gotHeader.Get(forbidden), forbidden)
			}
		})
	}
}

type grokHeaderIsolationAdaptor struct {
	requestContextAdaptor
	url  string
	auth string
}

func (a grokHeaderIsolationAdaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return a.url, nil
}

func (a grokHeaderIsolationAdaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	req.Set("Authorization", a.auth)
	if info != nil && info.RelayMode == relayconstant.RelayModeImagesGenerations {
		req.Set("Accept", "application/json")
		req.Set("Content-Type", "application/json")
	}
	return nil
}

func TestFinalizeRequestRunsAfterHeaderOverride(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	var upstreamHeader http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamHeader = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			HeadersOverride: map[string]any{
				"User-Agent":           "override-ua",
				"Authorization":        "Bearer override",
				"Cookie":               "client-cookie=1",
				"X-Codex-Attestation":  "client-attestation",
				"X-Codex-Unknown-Side": "client-side",
			},
		},
	}

	resp, err := DoApiRequest(finalizingRequestAdaptor{requestContextAdaptor: requestContextAdaptor{url: server.URL}}, ctx, info, strings.NewReader(`{}`))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.Body.Close()

	require.Equal(t, "trusted-ua", upstreamHeader.Get("User-Agent"))
	require.Equal(t, "Bearer trusted", upstreamHeader.Get("Authorization"))
	require.Empty(t, upstreamHeader.Get("Cookie"))
	require.Empty(t, upstreamHeader.Get("X-Codex-Attestation"))
	require.Empty(t, upstreamHeader.Get("X-Codex-Unknown-Side"))
}

type finalizingRequestAdaptor struct {
	requestContextAdaptor
}

func (a finalizingRequestAdaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	req.Set("User-Agent", "setup-ua")
	req.Set("Authorization", "Bearer setup")
	return nil
}

func (a finalizingRequestAdaptor) FinalizeRequest(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("User-Agent", "trusted-ua")
	req.Header.Set("Authorization", "Bearer trusted")
	req.Header.Del("Cookie")
	req.Header.Del("X-Codex-Attestation")
	req.Header.Del("X-Codex-Unknown-Side")
	return nil
}

type requestContextAdaptor struct {
	url string
}

func (a requestContextAdaptor) Init(info *relaycommon.RelayInfo) {}

func (a requestContextAdaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return a.url, nil
}

func (a requestContextAdaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	return nil
}

func (a requestContextAdaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, nil
}

func (a requestContextAdaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a requestContextAdaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, nil
}

func (a requestContextAdaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, nil
}

func (a requestContextAdaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, nil
}

func (a requestContextAdaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, nil
}

func (a requestContextAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return nil, nil
}

func (a requestContextAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	return nil, nil
}

func (a requestContextAdaptor) GetModelList() []string {
	return nil
}

func (a requestContextAdaptor) GetChannelName() string {
	return "request-context-test"
}

func (a requestContextAdaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, nil
}

func (a requestContextAdaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, nil
}

type taskPreSendErrorAdaptor struct {
	url       string
	urlErr    error
	headerErr error
}

func (a taskPreSendErrorAdaptor) Init(info *relaycommon.RelayInfo) {}
func (a taskPreSendErrorAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return nil
}
func (a taskPreSendErrorAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	return nil
}
func (a taskPreSendErrorAdaptor) AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64 {
	return nil
}
func (a taskPreSendErrorAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	return 0
}
func (a taskPreSendErrorAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if a.urlErr != nil {
		return "", a.urlErr
	}
	return a.url, nil
}
func (a taskPreSendErrorAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	return a.headerErr
}
func (a taskPreSendErrorAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	return nil, nil
}
func (a taskPreSendErrorAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return DoTaskApiRequest(a, c, info, requestBody)
}
func (a taskPreSendErrorAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *dto.TaskError) {
	return "", nil, nil
}
func (a taskPreSendErrorAdaptor) GetModelList() []string { return nil }
func (a taskPreSendErrorAdaptor) GetChannelName() string { return "task-pre-send-error" }
func (a taskPreSendErrorAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	return nil, nil
}
func (a taskPreSendErrorAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	return nil, nil
}
