package codex

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCodexEgressZeroOriginalMatrix(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()

	const marker = "orig-marker-codex-egress"
	type capturedRequest struct {
		path   string
		header http.Header
		body   []byte
	}
	var captures []capturedRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		captures = append(captures, capturedRequest{path: r.URL.Path, header: r.Header.Clone(), body: body})
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	run := func(name, path string, relayMode int, passThrough bool, build func(*gin.Context, *relaycommon.RelayInfo) io.Reader) capturedRequest {
		t.Helper()
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, path, nil)
		c.Request.Header.Set("session-id", marker+"-inbound-session")
		c.Request.Header.Set("session_id", marker+"-inbound-session")
		info := codexPolicyRelayInfo(server.URL, relayMode, fingerprintFull)
		info.ChannelMeta.HeadersOverride = codexZeroOriginalHeaderOverride(marker)
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
		relayMode   int
		passThrough bool
		build       func(*gin.Context, *relaycommon.RelayInfo) io.Reader
	}{
		{
			name:      "responses typed",
			path:      "/v1/responses",
			relayMode: relayconstant.RelayModeResponses,
			build: func(c *gin.Context, info *relaycommon.RelayInfo) io.Reader {
				out, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
					Model:            "gpt-5",
					Input:            json.RawMessage(`"ping"`),
					ClientMetadata:   json.RawMessage(`{"session_id":"` + marker + `-metadata-session","cwd":"` + marker + `-cwd","trace":"` + marker + `-trace","mystery":"` + marker + `-unknown"}`),
					PromptCacheKey:   json.RawMessage(`"` + marker + `-metadata-session"`),
					Metadata:         json.RawMessage(`{"leak":"` + marker + `-metadata-root"}`),
					SafetyIdentifier: json.RawMessage(`"` + marker + `-safety"`),
				})
				require.NoError(t, err)
				payload, err := common.Marshal(out)
				require.NoError(t, err)
				return strings.NewReader(string(payload))
			},
		},
		{
			name:      "chat compatibility",
			path:      "/v1/chat/completions",
			relayMode: relayconstant.RelayModeChatCompletions,
			build: func(c *gin.Context, info *relaycommon.RelayInfo) io.Reader {
				out, err := (&Adaptor{}).ConvertOpenAIRequest(c, info, &dto.GeneralOpenAIRequest{
					Model:          "gpt-5",
					Messages:       []dto.Message{{Role: "user", Content: "ping"}},
					PromptCacheKey: marker + "-prompt-cache",
					Metadata:       json.RawMessage(`{"session_id":"` + marker + `-chat-session","cwd":"` + marker + `-chat-cwd"}`),
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
			relayMode:   relayconstant.RelayModeResponses,
			passThrough: true,
			build: func(*gin.Context, *relaycommon.RelayInfo) io.Reader {
				return strings.NewReader(`{"model":"gpt-5","prompt_cache_key":"` + marker + `-raw-session","client_metadata":{"session_id":"` + marker + `-raw-session","cwd":"` + marker + `-raw-cwd","workspace":"` + marker + `-raw-workspace","trace":"` + marker + `-raw-trace","mystery":"` + marker + `-raw-unknown"}}`)
			},
		},
		{
			name:      "compact typed",
			path:      "/v1/responses/compact",
			relayMode: relayconstant.RelayModeResponsesCompact,
			build: func(c *gin.Context, info *relaycommon.RelayInfo) io.Reader {
				out, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
					Model:          "gpt-5",
					Input:          json.RawMessage(`"ping"`),
					ClientMetadata: json.RawMessage(`{"session_id":"` + marker + `-compact-session","cwd":"` + marker + `-compact-cwd"}`),
					Metadata:       json.RawMessage(`{"leak":"` + marker + `-compact-metadata-root"}`),
				})
				require.NoError(t, err)
				payload, err := common.Marshal(out)
				require.NoError(t, err)
				return strings.NewReader(string(payload))
			},
		},
		{
			name:        "compact passthrough",
			path:        "/v1/responses/compact",
			relayMode:   relayconstant.RelayModeResponsesCompact,
			passThrough: true,
			build: func(*gin.Context, *relaycommon.RelayInfo) io.Reader {
				return strings.NewReader(`{"model":"gpt-5","client_metadata":{"session_id":"` + marker + `-compact-pass-session","cwd":"` + marker + `-compact-pass-cwd"},"metadata":{"leak":"` + marker + `-compact-pass-metadata"}}`)
			},
		},
		{
			name:      "image",
			path:      "/v1/images/generations",
			relayMode: relayconstant.RelayModeImagesGenerations,
			build: func(c *gin.Context, info *relaycommon.RelayInfo) io.Reader {
				out, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{
					Model:  "gpt-image-2",
					Prompt: "simple test image",
					User:   json.RawMessage(`"` + marker + `-image-user"`),
					Extra: map[string]json.RawMessage{
						"client_metadata": json.RawMessage(`{"session_id":"` + marker + `-image-session"}`),
					},
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
			got := run(tt.name, tt.path, tt.relayMode, tt.passThrough, tt.build)
			all := codexEgressHeaderString(got.header) + "\n" + string(got.body)
			switch tt.relayMode {
			case relayconstant.RelayModeResponsesCompact:
				require.Equal(t, "/backend-api/codex/responses/compact", got.path)
			default:
				require.Equal(t, "/backend-api/codex/responses", got.path)
			}
			require.NotContains(t, all, marker)
			require.Equal(t, "Bearer trusted-token", got.header.Get("Authorization"))
			require.Equal(t, "trusted-account", got.header.Get("chatgpt-account-id"))
			require.Equal(t, "codex_cli_rs", got.header.Get("originator"))
			require.NotEmpty(t, got.header.Get("x-codex-installation-id"))
			require.NotEmpty(t, got.header.Get("session-id"))
		})
	}
}

func TestCodexIdentityKillSwitchPreservesLegacyInferenceIdentity(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{
		"CodexClientVersion":         "0.145.7",
		"CodexEnforceClientIdentity": "false",
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})

	var captured capturedCodexEgressRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		captured = capturedCodexEgressRequest{header: r.Header.Clone(), body: body}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := codexPolicyRelayInfo(server.URL, relayconstant.RelayModeResponses, fingerprintFull)
	info.ChannelMeta.HeadersOverride = map[string]any{
		"User-Agent":            "legacy-codex-client/1.2.3",
		"originator":            "legacy-originator",
		"OpenAI-Client-Version": "legacy-version",
	}
	out, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model:          "gpt-5",
		Input:          json.RawMessage(`"ping"`),
		ClientMetadata: json.RawMessage(`{"session_id":"client-session","cwd":"/tmp"}`),
	})
	require.NoError(t, err)
	payload, err := common.Marshal(out)
	require.NoError(t, err)

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(string(payload)))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()

	require.Equal(t, "legacy-codex-client/1.2.3", captured.header.Get("User-Agent"))
	require.Equal(t, "legacy-originator", captured.header.Get("originator"))
	require.Equal(t, "legacy-version", captured.header.Get("OpenAI-Client-Version"))
	require.NotEqual(t, "codex-cli/0.145.7", captured.header.Get("User-Agent"))
	require.NotEqual(t, "codex_cli_rs", captured.header.Get("originator"))
	require.NotEqual(t, "0.145.7", captured.header.Get("OpenAI-Client-Version"))
	require.NotContains(t, string(captured.body), "client-session")
	require.NotContains(t, string(captured.body), "/tmp")
	require.NotEmpty(t, captured.header.Get("x-codex-installation-id"))
	require.NotEmpty(t, captured.header.Get("session-id"))
}

func TestCodexIdentityStableAcrossRestartAndReplicaButRotatesAcrossCloneNamespace(t *testing.T) {
	now := time.Unix(1787236800, 123000000)
	info := func() *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			UserId:  101,
			TokenId: 201,
			ChannelMeta: &relaycommon.ChannelMeta{
				CodexFingerprintSeed: hardeningSeed,
				ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: fingerprintFull},
			},
		}
	}

	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "prod-a")
	first, err := ResolveCodexFingerprint(info(), "client-session-a", now)
	require.NoError(t, err)
	restarted, err := ResolveCodexFingerprint(info(), "client-session-b", now)
	require.NoError(t, err)
	require.Equal(t, first.InstallationID, restarted.InstallationID)
	require.Equal(t, first.SessionID, restarted.SessionID)
	require.Equal(t, first.ThreadID, restarted.ThreadID)
	require.Equal(t, first.WindowID, restarted.WindowID)

	const replicas = 8
	var wg sync.WaitGroup
	results := make(chan *CodexFingerprint, replicas)
	errs := make(chan error, replicas)
	for i := 0; i < replicas; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			replicaInfo := info()
			replicaInfo.UserId += i
			replicaInfo.TokenId += i
			got, err := ResolveCodexFingerprint(replicaInfo, "client-session-replica", now)
			if err != nil {
				errs <- err
				return
			}
			results <- got
		}(i)
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	for got := range results {
		require.Equal(t, first.InstallationID, got.InstallationID)
		require.Equal(t, first.SessionID, got.SessionID)
		require.Equal(t, first.ThreadID, got.ThreadID)
		require.Equal(t, first.WindowID, got.WindowID)
	}

	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "prod-b")
	clone, err := ResolveCodexFingerprint(info(), "client-session-a", now)
	require.NoError(t, err)
	require.NotEqual(t, first.InstallationID, clone.InstallationID)
	require.NotEqual(t, first.SessionID, clone.SessionID)
	require.NotEqual(t, first.ThreadID, clone.ThreadID)
	require.NotEqual(t, first.WindowID, clone.WindowID)
}

type capturedCodexEgressRequest struct {
	header http.Header
	body   []byte
}

func codexEgressHeaderString(header http.Header) string {
	var b strings.Builder
	for name, values := range header {
		b.WriteString(name)
		b.WriteString(":")
		b.WriteString(strings.Join(values, ","))
		b.WriteString("\n")
	}
	return b.String()
}

func codexZeroOriginalHeaderOverride(marker string) map[string]any {
	override := codexMaliciousHeaderOverride()
	override["Cookie"] = marker + "-cookie=1"
	override["traceparent"] = marker + "-traceparent"
	override["tracestate"] = marker + "-tracestate"
	override["baggage"] = marker + "-baggage"
	override["Accept-Language"] = marker + "-locale"
	override["OpenAI-Locale"] = marker + "-openai-locale"
	override["OpenAI-Timeout-Ms"] = marker + "-timeout"
	override["X-Codex-Beta-Features"] = marker + "-beta"
	override["X-Codex-Turn-State"] = marker + "-turn-state"
	override["X-Codex-Attestation"] = marker + "-attestation"
	override["X-Codex-Unknown-Side"] = marker + "-unknown-header"
	override["X-Codex-Turn-Metadata"] = `{"installation_id":"` + marker + `-turn-installation","session_id":"` + marker + `-turn-session","thread_id":"` + marker + `-turn-thread","turn_id":"` + marker + `-turn","window_id":"` + marker + `-turn-window"}`
	override["session-id"] = marker + "-override-session"
	override["session_id"] = marker + "-override-session"
	override["thread-id"] = marker + "-override-thread"
	override["x-client-request-id"] = marker + "-override-thread"
	override["X-Request-Id"] = "transport-request-id"
	return override
}
