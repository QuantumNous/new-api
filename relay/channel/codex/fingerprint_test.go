package codex

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestFingerprintModeDefaultsToOffUnlessExplicitlyEnabled(t *testing.T) {
	tests := []struct {
		name string
		info *relaycommon.RelayInfo
	}{
		{
			name: "missing channel metadata",
			info: &relaycommon.RelayInfo{},
		},
		{
			name: "empty mode",
			info: &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelSetting: dto.ChannelSettings{}}},
		},
		{
			name: "invalid mode",
			info: &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "shared"}}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, fingerprintOff, fingerprintMode(tt.info))
			if tt.info.ChannelMeta != nil {
				require.Nil(t, resolveFingerprintIDs(tt.info, "client-session"))
			}
		})
	}
}

func TestFingerprintSessionModeExplicitlyConvergesIDs(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 42, CodexFingerprintSeed: hardeningSeed, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "session"}}}
	a := resolveFingerprintIDs(info, "client-a")
	b := resolveFingerprintIDs(info, "client-b")

	require.NotNil(t, a)
	require.Equal(t, a.installationID, b.installationID)
	require.Equal(t, a.sessionID, b.sessionID)
	require.NotEqual(t, a.threadID, b.threadID)
}

func TestFingerprintModes(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 42, CodexFingerprintSeed: hardeningSeed, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "session"}}}
	a := resolveFingerprintIDs(info, "client-a")
	b := resolveFingerprintIDs(info, "client-b")
	require.NotNil(t, a)
	require.Equal(t, a.installationID, b.installationID)
	require.Equal(t, a.sessionID, b.sessionID)
	require.NotEqual(t, a.threadID, b.threadID)

	info.ChannelMeta.ChannelSetting.CodexFingerprintMode = "full"
	c := resolveFingerprintIDs(info, "client-a")
	require.Equal(t, c.sessionID, c.threadID)

	info.ChannelMeta.ChannelSetting.CodexFingerprintMode = "off"
	require.Nil(t, resolveFingerprintIDs(info, "client-a"))
}

func TestFingerprintIgnoresDownstreamUserAndToken(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	now := time.Unix(1700000000, 123000000)
	a := &relaycommon.RelayInfo{
		UserId:  101,
		TokenId: 201,
		ChannelMeta: &relaycommon.ChannelMeta{
			CodexFingerprintSeed: "018f89db-7792-7b5e-a360-7fd9279fd725",
			ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "session"},
		},
	}
	b := &relaycommon.RelayInfo{
		UserId:  102,
		TokenId: 202,
		ChannelMeta: &relaycommon.ChannelMeta{
			CodexFingerprintSeed: "018f89db-7792-7b5e-a360-7fd9279fd725",
			ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "session"},
		},
	}

	first, err := ResolveCodexFingerprint(a, "client-session", now)
	require.NoError(t, err)
	second, err := ResolveCodexFingerprint(b, "client-session", now)
	require.NoError(t, err)

	require.Equal(t, first.InstallationID, second.InstallationID)
	require.Equal(t, first.SessionID, second.SessionID)
	require.Equal(t, first.ThreadID, second.ThreadID)
	require.Equal(t, first.WindowID, second.WindowID)
}

func TestFingerprintNamespaceSeparatesDatabaseClones(t *testing.T) {
	now := time.Unix(1700000000, 123000000)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		CodexFingerprintSeed: "018f89db-7792-7b5e-a360-7fd9279fd725",
		ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "session"},
	}}

	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "prod-a")
	prodA, err := ResolveCodexFingerprint(info, "client-session", now)
	require.NoError(t, err)
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "prod-b")
	prodB, err := ResolveCodexFingerprint(info, "client-session", now)
	require.NoError(t, err)

	require.NotEqual(t, prodA.InstallationID, prodB.InstallationID)
	require.NotEqual(t, prodA.SessionID, prodB.SessionID)
	require.NotEqual(t, prodA.ThreadID, prodB.ThreadID)
	require.NotEqual(t, prodA.WindowID, prodB.WindowID)
}

func TestFingerprintTurnUsesUUIDv7AndOneTimestamp(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	now := time.Unix(1700000000, 123000000)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		CodexFingerprintSeed: "018f89db-7792-7b5e-a360-7fd9279fd725",
		ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "full"},
	}}

	fingerprint, err := ResolveCodexFingerprint(info, "ignored-client-session", now)
	require.NoError(t, err)
	turnID, err := uuid.Parse(fingerprint.TurnID)
	require.NoError(t, err)

	require.Equal(t, uuid.Version(7), turnID.Version())
	require.Equal(t, now.UnixMilli(), fingerprint.StartedAtMS)
	require.Equal(t, fingerprint.SessionID, fingerprint.ThreadID)
}

func TestFingerprintIDsUsesClearedStagingForNextAttempt(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Request.Header.Set("session-id", "client")
	onInfo := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7, CodexFingerprintSeed: hardeningSeed, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "session"}}}
	offInfo := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 8, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "off"}}}

	setFingerprintIDs(c, resolveFingerprintIDs(onInfo, clientSessionID(c)))
	require.NotNil(t, fingerprintIDs(c, onInfo))

	setFingerprintIDs(c, nil)
	require.Nil(t, fingerprintIDs(c, offInfo))
}

func TestFingerprintHeadersAndBodyShareIDs(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7, CodexFingerprintSeed: hardeningSeed, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "session"}}}
	ids := resolveFingerprintIDs(info, "client")
	h := http.Header{}
	h.Set("x-codex-turn-metadata", `{"installation_id":"old","session_id":"old","thread_id":"old","turn_id":"old"}`)
	applyFingerprintHeaders(h, ids)
	body := map[string]any{"client_metadata": map[string]any{"x-codex-turn-metadata": `{"turn_id":"old"}`}}
	require.True(t, applyFingerprintBody(body, ids))
	require.Contains(t, h.Get("x-codex-turn-metadata"), ids.turnID)
	metadata := body["client_metadata"].(map[string]any)
	require.Equal(t, ids.turnID, metadata["turn_id"])
}

func TestFingerprintBodyReplacesNonObjectMetadata(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7, CodexFingerprintSeed: hardeningSeed, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "device"}}}
	ids := resolveFingerprintIDs(info, "client")
	body := map[string]any{"client_metadata": "opaque"}
	require.True(t, applyFingerprintBody(body, ids))
	metadata := body["client_metadata"].(map[string]any)
	require.Equal(t, ids.installationID, metadata["x-codex-installation-id"])
}

func TestFingerprintDeviceRewritesTurnMetadata(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7, CodexFingerprintSeed: hardeningSeed, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "device"}}}
	ids := resolveFingerprintIDs(info, "client")
	body := map[string]any{"client_metadata": map[string]any{"x-codex-turn-metadata": `{"installation_id":"old"}`}}
	require.True(t, applyFingerprintBody(body, ids))
	metadata := body["client_metadata"].(map[string]any)
	require.Contains(t, metadata["x-codex-turn-metadata"], ids.installationID)
}

func TestFingerprintTurnMetadataNullAndNonObjectValuesRebuilt(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7, CodexFingerprintSeed: hardeningSeed, ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "device"}}}
	ids := resolveFingerprintIDs(info, "client")

	for _, raw := range []string{"null", "[]", "123"} {
		t.Run(raw, func(t *testing.T) {
			var rewritten string
			require.NotPanics(t, func() {
				rewritten = rewriteTurnMetadata(raw, ids)
			})
			parsed := gjson.Parse(rewritten)
			require.True(t, parsed.IsObject())
			require.Equal(t, ids.installationID, parsed.Get("installation_id").String())
		})
	}

	body := map[string]any{"client_metadata": map[string]any{"x-codex-turn-metadata": "null"}}
	require.NotPanics(t, func() {
		require.True(t, applyFingerprintBody(body, ids))
	})
	metadata := body["client_metadata"].(map[string]any)
	require.Equal(t, ids.installationID, gjson.Parse(metadata["x-codex-turn-metadata"].(string)).Get("installation_id").String())

	rawBody, changed, err := applyFingerprintBodyRaw([]byte(`{"client_metadata":{"x-codex-turn-metadata":"null"}}`), ids)
	require.NoError(t, err)
	require.True(t, changed)
	rewrittenTurnMetadata := gjson.GetBytes(rawBody, "client_metadata.x-codex-turn-metadata").String()
	require.Equal(t, ids.installationID, gjson.Parse(rewrittenTurnMetadata).Get("installation_id").String())
}

func TestFingerprintPassThroughRawBodySharesHeaderIDsAndPreservesFields(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()
	var upstreamBody []byte
	var upstreamHeader http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamHeader = r.Header.Clone()
		var err error
		upstreamBody, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:            11,
			CodexFingerprintSeed: hardeningSeed,
			ChannelBaseUrl:       server.URL,
			ApiKey:               `{"access_token":"token","account_id":"account"}`,
			ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "session", PassThroughBodyEnabled: true},
		},
	}

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"model":"gpt-5","client_metadata":{"kept":"yes"},"unrelated":1}`))
	require.NoError(t, err)
	require.NotNil(t, resp)
	httpResp, ok := resp.(*http.Response)
	require.True(t, ok)
	_ = httpResp.Body.Close()

	var body map[string]any
	require.NoError(t, common.Unmarshal(upstreamBody, &body))
	require.Equal(t, float64(1), body["unrelated"])
	metadata := body["client_metadata"].(map[string]any)
	require.Equal(t, "yes", metadata["kept"])
	require.Equal(t, upstreamHeader.Get("session-id"), metadata["session_id"])
	require.Equal(t, upstreamHeader.Get("x-client-request-id"), metadata["thread_id"])
}

func TestFingerprintConvertedChatWithPassThroughReusesStagedIDs(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()
	var upstreamBody []byte
	var upstreamHeader http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamHeader = r.Header.Clone()
		var err error
		upstreamBody, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:            16,
			CodexFingerprintSeed: hardeningSeed,
			ChannelBaseUrl:       server.URL,
			ApiKey:               `{"access_token":"token","account_id":"account"}`,
			ChannelSetting: dto.ChannelSettings{
				CodexFingerprintMode:   "session",
				PassThroughBodyEnabled: true,
			},
		},
	}
	adaptor := &Adaptor{}
	converted, err := adaptor.ConvertOpenAIRequest(c, info, &dto.GeneralOpenAIRequest{
		Model:    "gpt-5",
		Messages: []dto.Message{{Role: "user", Content: "hello"}},
	})
	require.NoError(t, err)
	stagedBefore := fingerprintIDs(c, info)
	require.NotNil(t, stagedBefore)

	payload, err := common.Marshal(converted)
	require.NoError(t, err)
	resp, err := adaptor.DoRequest(c, info, strings.NewReader(string(payload)))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()

	require.True(t, gjson.GetBytes(upstreamBody, "input").Exists())
	require.False(t, gjson.GetBytes(upstreamBody, "messages").Exists())
	require.Same(t, stagedBefore, fingerprintIDs(c, info))
	require.Equal(t, stagedBefore.sessionID, gjson.GetBytes(upstreamBody, "client_metadata.session_id").String())
	require.Equal(t, stagedBefore.threadID, gjson.GetBytes(upstreamBody, "client_metadata.thread_id").String())
	require.Equal(t, stagedBefore.turnID, gjson.GetBytes(upstreamBody, "client_metadata.turn_id").String())
	require.Equal(t, stagedBefore.sessionID, upstreamHeader.Get("session-id"))
	require.Equal(t, stagedBefore.threadID, upstreamHeader.Get("x-client-request-id"))
}

func TestFingerprintPassThroughOffClearsStaleBodySize(t *testing.T) {
	service.InitHttpClient()
	var upstreamBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		upstreamBody, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{
		RelayMode:               relayconstant.RelayModeResponses,
		UpstreamRequestBodySize: 4096,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: server.URL,
			ApiKey:         `{"access_token":"token","account_id":"account"}`,
			ChannelSetting: dto.ChannelSettings{
				CodexFingerprintMode:   "off",
				PassThroughBodyEnabled: true,
			},
		},
	}
	rawBody := `{"model":"gpt-5","input":"unchanged"}`

	resp, err := (&Adaptor{}).DoRequest(c, info, common.ReaderOnly(strings.NewReader(rawBody)))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()
	require.Equal(t, rawBody, string(upstreamBody))
}

func TestFingerprintCompactStagesHeadersWithoutBodyConvergence(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponsesCompact,
		ChannelMeta: &relaycommon.ChannelMeta{
			CodexFingerprintSeed: hardeningSeed,
			ApiKey:               `{"access_token":"token","account_id":"account"}`,
			ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "session"},
		},
	}

	out, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{Model: "gpt-5"})
	require.NoError(t, err)
	body := out.(map[string]any)
	require.NotContains(t, body, "client_metadata")
	require.NotNil(t, fingerprintIDs(c, info))

	header := http.Header{}
	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &header, info))
	require.NotEmpty(t, header.Get("x-codex-installation-id"))
	require.NotEmpty(t, header.Get("session-id"))
	require.NotEmpty(t, header.Get("x-client-request-id"))
}

func TestFingerprintCompactPassThroughDropsOriginalMetadataAndKeepsHeaders(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()
	var upstreamBody []byte
	var upstreamHeader http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamHeader = r.Header.Clone()
		var err error
		upstreamBody, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponsesCompact,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:            14,
			CodexFingerprintSeed: hardeningSeed,
			ChannelBaseUrl:       server.URL,
			ApiKey:               `{"access_token":"token","account_id":"account"}`,
			ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "session", PassThroughBodyEnabled: true},
		},
	}
	rawBody := `{"model":"gpt-5","client_metadata":{"session_id":"client-value"}}`

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(rawBody))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()
	require.JSONEq(t, `{"model":"gpt-5"}`, string(upstreamBody))
	require.NotEmpty(t, upstreamHeader.Get("x-codex-installation-id"))
	require.NotEmpty(t, upstreamHeader.Get("session-id"))
	require.NotEmpty(t, upstreamHeader.Get("x-client-request-id"))
}

func TestFingerprintCompactPassThroughOffPreservesBody(t *testing.T) {
	service.InitHttpClient()
	var upstreamBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		upstreamBody, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
	info := &relaycommon.RelayInfo{
		RelayMode:               relayconstant.RelayModeResponsesCompact,
		UpstreamRequestBodySize: 4096,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: server.URL,
			ApiKey:         `{"access_token":"token","account_id":"account"}`,
			ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "off", PassThroughBodyEnabled: true},
		},
	}
	rawBody := `{"model":"gpt-5","client_metadata":{"session_id":"client-value"},"metadata":{"kept":true}}`

	resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(rawBody))
	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.(*http.Response).Body.Close()
	require.JSONEq(t, rawBody, string(upstreamBody))
}

func TestFingerprintCompactPassThroughFullRejectsInvalidBodies(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	service.InitHttpClient()
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	for _, rawBody := range []string{`not-json`, `"scalar"`, `[{"not":"object"}]`} {
		t.Run(rawBody, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
			info := &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeResponsesCompact,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:       server.URL,
					ApiKey:               `{"access_token":"token","account_id":"account"}`,
					CodexFingerprintSeed: hardeningSeed,
					ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "full", PassThroughBodyEnabled: true},
				},
			}

			resp, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(rawBody))
			require.Error(t, err)
			require.Nil(t, resp)
		})
	}
	require.Zero(t, requests)
}

func TestFingerprintRawBodyReplacesNonObjectMetadata(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelId:            12,
		CodexFingerprintSeed: hardeningSeed,
		ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "session"},
	}}
	ids := resolveFingerprintIDs(info, "client-session")
	require.NotNil(t, ids)

	rewritten, changed, err := applyFingerprintBodyRaw(
		[]byte(`{"client_metadata":"opaque","unrelated":"kept"}`),
		ids,
	)
	require.NoError(t, err)
	require.True(t, changed)

	var body map[string]any
	require.NoError(t, common.Unmarshal(rewritten, &body))
	require.Equal(t, "kept", body["unrelated"])
	metadata, ok := body["client_metadata"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, ids.sessionID, metadata["session_id"])
	require.Equal(t, ids.turnID, metadata["turn_id"])
}

func TestFingerprintRawBodyPreservesUnrelatedMetadataEncoding(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelId:            15,
		CodexFingerprintSeed: hardeningSeed,
		ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "session"},
	}}
	ids := resolveFingerprintIDs(info, "client-session")
	require.NotNil(t, ids)
	body := []byte(`{"client_metadata":{"large_integer":9007199254740993,"escaped":"\u0061","nested":{"kept":true}}}`)

	rewritten, changed, err := applyFingerprintBodyRaw(body, ids)
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, "9007199254740993", gjson.GetBytes(rewritten, "client_metadata.large_integer").Raw)
	require.Contains(t, string(rewritten), `"escaped":"\u0061"`)
	require.True(t, gjson.GetBytes(rewritten, "client_metadata.nested.kept").Bool())
}

func TestFingerprintRawBodyLeavesNonObjectRootsUntouched(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelId:            13,
		CodexFingerprintSeed: hardeningSeed,
		ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "device"},
	}}
	ids := resolveFingerprintIDs(info, "client-session")
	require.NotNil(t, ids)

	for _, body := range [][]byte{nil, []byte(`[1,2,3]`), []byte(`"plain"`), []byte(`not-json`)} {
		rewritten, changed, err := applyFingerprintBodyRaw(body, ids)
		require.NoError(t, err)
		require.False(t, changed)
		require.Equal(t, body, rewritten)
	}
}
