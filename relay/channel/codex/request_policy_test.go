package codex

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCodexHeaderAllowlistDropsIdentitySideChannels(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()

	var upstream http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := codexPolicyRelayInfo(server.URL, relayconstant.RelayModeResponses, fingerprintFull)
	info.IsStream = true
	info.ChannelMeta.HeadersOverride = codexMaliciousHeaderOverride()

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model: "gpt-5",
		Input: []byte(`"ping"`),
	})
	require.NoError(t, err)
	ids := fingerprintIDs(c, info)
	require.NotNil(t, ids)
	payload, err := common.Marshal(converted)
	require.NoError(t, err)

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(string(payload)))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()

	require.Equal(t, "Bearer trusted-token", upstream.Get("Authorization"))
	require.Equal(t, "trusted-account", upstream.Get("chatgpt-account-id"))
	require.Equal(t, "responses=experimental", upstream.Get("OpenAI-Beta"))
	require.Equal(t, "codex_cli_rs", upstream.Get("originator"))
	require.Equal(t, "application/json", upstream.Get("Content-Type"))
	require.Equal(t, "text/event-stream", upstream.Get("Accept"))
	require.Equal(t, ids.installationID, upstream.Get("x-codex-installation-id"))
	require.Equal(t, ids.sessionID, upstream.Get("session-id"))
	require.Equal(t, ids.sessionID, upstream.Get("session_id"))
	require.Equal(t, ids.threadID, upstream.Get("thread-id"))
	require.Equal(t, ids.threadID, upstream.Get("x-client-request-id"))
	require.Equal(t, ids.windowID, upstream.Get("x-codex-window-id"))
	for _, name := range []string{
		"Cookie",
		"traceparent",
		"tracestate",
		"baggage",
		"Accept-Language",
		"OpenAI-Locale",
		"OpenAI-Timeout-Ms",
		"X-Codex-Beta-Features",
		"X-Codex-Turn-State",
		"X-Codex-Attestation",
		"X-Codex-Unknown-Side",
	} {
		require.Empty(t, upstream.Get(name), "header %s must be dropped", name)
	}
	require.Equal(t, "transport-marker", upstream.Get("X-Request-Id"))
}

func TestCodexHeaderAllowlistReplacesClientVersionIdentityHeaders(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()

	var upstream http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := codexPolicyRelayInfo(server.URL, relayconstant.RelayModeResponses, fingerprintOff)
	info.ChannelMeta.HeadersOverride = map[string]any{
		"User-Agent":              "attacker-codex-cli/9.9.9",
		"OpenAI-Client":           "attacker-client",
		"OpenAI-Client-Version":   "9.9.9",
		"X-OpenAI-Client":         "attacker-x-client",
		"X-OpenAI-Client-Version": "9.9.9",
		"X-Codex-Client-Version":  "9.9.9",
		"X-Codex-CLI-Version":     "9.9.9",
		"X-Codex-Version":         "9.9.9",
		"Codex-Version":           "9.9.9",
		"X-Request-Id":            "transport-marker",
	}

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"model":"gpt-5"}`))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()

	require.Equal(t, "codex-cli/0.144.0", upstream.Get("User-Agent"))
	require.Equal(t, "0.144.0", upstream.Get("OpenAI-Client-Version"))
	for _, name := range []string{
		"OpenAI-Client",
		"X-OpenAI-Client",
		"X-OpenAI-Client-Version",
		"X-Codex-Client-Version",
		"X-Codex-CLI-Version",
		"X-Codex-Version",
		"Codex-Version",
	} {
		require.Empty(t, upstream.Get(name), "header %s must not forward override-controlled identity", name)
	}
	require.Equal(t, "transport-marker", upstream.Get("X-Request-Id"))
}

func TestInferenceIdentityIncludesVersion(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{
		"CodexClientVersion":   "0.145.7",
		"CodexClientUserAgent": "codex-cli/0.100.1 relay-suite",
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})

	var upstream http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := codexPolicyRelayInfo(server.URL, relayconstant.RelayModeResponses, fingerprintOff)
	info.ChannelMeta.HeadersOverride = map[string]any{
		"User-Agent":            "attacker-codex-cli/9.9.9",
		"originator":            "attacker-originator",
		"OpenAI-Client-Version": "9.9.9",
	}

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"model":"gpt-5"}`))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()

	require.Equal(t, "codex-cli/0.145.7 relay-suite", upstream.Get("User-Agent"))
	require.Equal(t, "codex_cli_rs", upstream.Get("originator"))
	require.Equal(t, "0.145.7", upstream.Get("OpenAI-Client-Version"))
}

func TestCodexFinalizerRewritesOverriddenTurnMetadata(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()

	var upstream http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := codexPolicyRelayInfo(server.URL, relayconstant.RelayModeResponses, fingerprintFull)
	info.ChannelMeta.HeadersOverride = map[string]any{
		"X-Codex-Turn-Metadata": `{"installation_id":"attacker-install","session_id":"attacker-session","thread_id":"attacker-thread","turn_id":"attacker-turn","window_id":"attacker-window"}`,
	}
	out, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{Model: "gpt-5"})
	require.NoError(t, err)
	ids := fingerprintIDs(c, info)
	require.NotNil(t, ids)
	payload, err := common.Marshal(out)
	require.NoError(t, err)

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(string(payload)))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()

	turnMetadata := upstream.Get("X-Codex-Turn-Metadata")
	require.NotEmpty(t, turnMetadata)
	require.Contains(t, turnMetadata, ids.installationID)
	require.Contains(t, turnMetadata, ids.sessionID)
	require.Contains(t, turnMetadata, ids.threadID)
	require.Contains(t, turnMetadata, ids.turnID)
	require.Contains(t, turnMetadata, ids.windowID)
	require.NotContains(t, turnMetadata, "attacker-")
}

func TestCodexFinalizerDropsTurnMetadataWithoutFingerprintIDs(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()

	var upstream http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := codexPolicyRelayInfo(server.URL, relayconstant.RelayModeResponses, fingerprintOff)
	info.ChannelMeta.HeadersOverride = map[string]any{
		"X-Codex-Turn-Metadata": `{"installation_id":"attacker-install","session_id":"attacker-session","thread_id":"attacker-thread","turn_id":"attacker-turn","window_id":"attacker-window"}`,
	}

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"model":"gpt-5"}`))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()

	require.Empty(t, upstream.Get("X-Codex-Turn-Metadata"))
}

func TestFinalizeCodexRequestDropsTurnMetadataWithoutRelayInfo(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "https://chatgpt.example/backend-api/codex/responses", nil)
	req.Header.Set("Authorization", "Bearer attacker")
	req.Header.Set("chatgpt-account-id", "attacker-account")
	req.Header.Set("OpenAI-Beta", "attacker-beta")
	req.Header.Set("X-Codex-Turn-Metadata", `{"installation_id":"attacker-install"}`)

	require.ErrorContains(t, FinalizeCodexRequest(req, nil), "relay info is required")
	require.Empty(t, req.Header.Get("Authorization"))
	require.Empty(t, req.Header.Get("chatgpt-account-id"))
	require.Empty(t, req.Header.Get("OpenAI-Beta"))
	require.Empty(t, req.Header.Get("X-Codex-Turn-Metadata"))
}

func TestExistingCodexRouteSwitchRejectsSuffixSmuggling(t *testing.T) {
	adaptor := &Adaptor{}
	tests := []struct {
		name string
		info *relaycommon.RelayInfo
		want string
	}{
		{
			name: "responses ignores caller suffix",
			info: codexPolicyRelayInfo("https://chatgpt.example", relayconstant.RelayModeResponses, fingerprintOff),
			want: "https://chatgpt.example/backend-api/codex/responses",
		},
		{
			name: "compact ignores caller suffix",
			info: codexPolicyRelayInfo("https://chatgpt.example", relayconstant.RelayModeResponsesCompact, fingerprintOff),
			want: "https://chatgpt.example/backend-api/codex/responses/compact",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.info.RequestURLPath = "/v1/responses/compact/../../responses/client-controlled"
			got, err := adaptor.GetRequestURL(tt.info)
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
			require.NotContains(t, got, "client-controlled")
			require.NotContains(t, got, "../")
		})
	}

	_, err := adaptor.GetRequestURL(codexPolicyRelayInfo("https://chatgpt.example", relayconstant.RelayModeUnknown, fingerprintOff))
	require.Error(t, err)
}

func TestCodexPolicyCoversTypedRawCompactImageAndPassthrough(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()

	type capturedRequest struct {
		header http.Header
		body   []byte
	}
	var captures []capturedRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		captures = append(captures, capturedRequest{header: r.Header.Clone(), body: body})
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	run := func(name, path string, mode int, passThrough bool, build func(*gin.Context, *relaycommon.RelayInfo) io.Reader) capturedRequest {
		t.Helper()
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, path, nil)
		c.Request.Header.Set("session-id", "client-session")
		info := codexPolicyRelayInfo(server.URL, mode, fingerprintSession)
		info.IsStream = true
		info.ChannelMeta.HeadersOverride = codexMaliciousHeaderOverride()
		if passThrough {
			info.ChannelMeta.ChannelSetting.PassThroughBodyEnabled = true
		}
		before := len(captures)
		resp, err := (&Adaptor{}).DoRequest(c, info, build(c, info))
		require.NoError(t, err, name)
		require.NotNil(t, resp, name)
		_ = resp.(*http.Response).Body.Close()
		require.Len(t, captures, before+1, name)
		return captures[before]
	}

	cases := []struct {
		name        string
		path        string
		mode        int
		passThrough bool
		build       func(*gin.Context, *relaycommon.RelayInfo) io.Reader
	}{
		{
			name: "typed chat",
			path: "/v1/chat/completions",
			mode: relayconstant.RelayModeChatCompletions,
			build: func(c *gin.Context, info *relaycommon.RelayInfo) io.Reader {
				out, err := (&Adaptor{}).ConvertOpenAIRequest(c, info, &dto.GeneralOpenAIRequest{
					Model:    "gpt-5",
					Messages: []dto.Message{{Role: "user", Content: "ping"}},
				})
				require.NoError(t, err)
				payload, err := common.Marshal(out)
				require.NoError(t, err)
				return strings.NewReader(string(payload))
			},
		},
		{
			name:        "raw passthrough",
			path:        "/v1/responses",
			mode:        relayconstant.RelayModeResponses,
			passThrough: true,
			build: func(c *gin.Context, info *relaycommon.RelayInfo) io.Reader {
				return strings.NewReader(`{"model":"gpt-5","client_metadata":{"session_id":"client-side","x-codex-installation-id":"client-side"}}`)
			},
		},
		{
			name: "compact",
			path: "/v1/responses/compact",
			mode: relayconstant.RelayModeResponsesCompact,
			build: func(c *gin.Context, info *relaycommon.RelayInfo) io.Reader {
				out, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{Model: "gpt-5"})
				require.NoError(t, err)
				payload, err := common.Marshal(out)
				require.NoError(t, err)
				return strings.NewReader(string(payload))
			},
		},
		{
			name: "image",
			path: "/v1/images/generations",
			mode: relayconstant.RelayModeImagesGenerations,
			build: func(c *gin.Context, info *relaycommon.RelayInfo) io.Reader {
				out, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{
					Model:  "gpt-image-2",
					Prompt: "ping",
				})
				require.NoError(t, err)
				payload, err := common.Marshal(out)
				require.NoError(t, err)
				return strings.NewReader(string(payload))
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := run(tt.name, tt.path, tt.mode, tt.passThrough, tt.build)
			require.Equal(t, "Bearer trusted-token", got.header.Get("Authorization"))
			require.Equal(t, "trusted-account", got.header.Get("chatgpt-account-id"))
			require.Empty(t, got.header.Get("Cookie"))
			require.Empty(t, got.header.Get("X-Codex-Attestation"))
			require.Empty(t, got.header.Get("X-Codex-Unknown-Side"))
			require.NotContains(t, string(got.body), "client-side")
		})
	}
}

func TestRetryClearsPriorChannelFingerprint(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()

	var upstream http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Request.Header.Set("session-id", "client-session")
	channelA := codexPolicyRelayInfo(server.URL, relayconstant.RelayModeResponses, fingerprintSession)
	channelA.ChannelMeta.CodexFingerprintSeed = "018f89db-7792-7b5e-a360-7fd9279fd725"
	out, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, channelA, dto.OpenAIResponsesRequest{Model: "gpt-5"})
	require.NoError(t, err)
	_ = out
	aIDs := fingerprintIDs(c, channelA)
	require.NotNil(t, aIDs)

	channelB := codexPolicyRelayInfo(server.URL, relayconstant.RelayModeResponses, fingerprintSession)
	channelB.ChannelMeta.CodexFingerprintSeed = "018f89db-7792-7b5e-a360-7fd9279fd726"
	channelB.ChannelMeta.HeadersOverride = map[string]any{
		"x-codex-installation-id": aIDs.installationID,
		"session-id":              aIDs.sessionID,
		"session_id":              aIDs.sessionID,
		"thread-id":               aIDs.threadID,
		"x-client-request-id":     aIDs.threadID,
	}
	out, err = (&Adaptor{}).ConvertOpenAIResponsesRequest(c, channelB, dto.OpenAIResponsesRequest{Model: "gpt-5"})
	require.NoError(t, err)
	bIDs := fingerprintIDs(c, channelB)
	require.NotNil(t, bIDs)
	require.NotEqual(t, aIDs.installationID, bIDs.installationID)
	payload, err := common.Marshal(out)
	require.NoError(t, err)

	resp, err := (&Adaptor{}).DoRequest(c, channelB, strings.NewReader(string(payload)))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()

	require.Equal(t, bIDs.installationID, upstream.Get("x-codex-installation-id"))
	require.Equal(t, bIDs.sessionID, upstream.Get("session-id"))
	require.Equal(t, bIDs.threadID, upstream.Get("x-client-request-id"))
	require.NotEqual(t, aIDs.installationID, upstream.Get("x-codex-installation-id"))
	require.NotEqual(t, aIDs.sessionID, upstream.Get("session-id"))
	require.NotEqual(t, aIDs.threadID, upstream.Get("x-client-request-id"))
}

func codexPolicyRelayInfo(baseURL string, mode int, fingerprintMode string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode: mode,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:       baseURL,
			ApiKey:               `{"access_token":"trusted-token","account_id":"trusted-account"}`,
			CodexFingerprintSeed: hardeningSeed,
			ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: fingerprintMode},
		},
	}
}

func codexMaliciousHeaderOverride() map[string]any {
	return map[string]any{
		"Authorization":           "Bearer attacker",
		"chatgpt-account-id":      "attacker-account",
		"OpenAI-Beta":             "opaque=attacker",
		"originator":              "attacker-originator",
		"Content-Type":            "text/plain",
		"Accept":                  "application/xml",
		"Cookie":                  "client-cookie=1",
		"traceparent":             "00-attacker",
		"tracestate":              "attacker-state",
		"baggage":                 "attacker-baggage",
		"Accept-Language":         "zz-ZZ",
		"OpenAI-Locale":           "zz-ZZ",
		"OpenAI-Timeout-Ms":       "1",
		"X-Codex-Beta-Features":   "opaque-beta",
		"X-Codex-Turn-State":      "client-turn-state",
		"X-Codex-Attestation":     "client-attestation",
		"X-Codex-Unknown-Side":    "client-side",
		"X-Codex-Installation-Id": "client-installation",
		"X-Codex-Window-Id":       "client-window",
		"session-id":              "client-session-override",
		"session_id":              "client-session-override",
		"thread-id":               "client-thread",
		"x-client-request-id":     "client-thread",
		"X-Request-Id":            "transport-marker",
	}
}
