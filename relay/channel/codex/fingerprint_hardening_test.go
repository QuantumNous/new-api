package codex

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

const hardeningSeed = "018f89db-7792-7b5e-a360-7fd9279fd725"

func hardeningInfo(mode string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		CodexFingerprintSeed: hardeningSeed,
		ApiKey:               `{"access_token":"token","account_id":"account"}`,
		ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: mode},
	}}
}

func hardeningFingerprint(t *testing.T, mode, originalSession string) *CodexFingerprint {
	t.Helper()
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	fingerprint, err := ResolveCodexFingerprint(
		hardeningInfo(mode),
		originalSession,
		time.Unix(1700000000, 123000000),
	)
	require.NoError(t, err)
	return fingerprint
}

func TestFullMetadataDropsKnownAndUnknownOriginalFields(t *testing.T) {
	fingerprint := hardeningFingerprint(t, fingerprintFull, "original-session")
	raw := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"original-session",
		"client_metadata":{
			"session_id":"original-session",
			"cwd":"/tmp/project",
			"workspace":"/tmp",
			"git":{"branch":"main"},
			"os":"linux",
			"arch":"amd64",
			"terminal":"xterm",
			"plugin":"plugin-marker",
			"skill":"skill-marker",
			"mcp":"mcp-marker",
			"trace":"trace-marker",
			"mystery":"unknown-marker"
		}
	}`)

	rewritten, err := SanitizeCodexRequestBody(raw, fingerprint, fingerprintFull)
	require.NoError(t, err)

	metadata := gjson.GetBytes(rewritten, "client_metadata")
	require.True(t, metadata.IsObject())
	require.Equal(t, fingerprint.InstallationID, metadata.Get("x-codex-installation-id").String())
	require.Equal(t, fingerprint.SessionID, metadata.Get("session_id").String())
	require.Equal(t, fingerprint.ThreadID, metadata.Get("thread_id").String())
	require.Equal(t, fingerprint.TurnID, metadata.Get("turn_id").String())
	require.Equal(t, fingerprint.WindowID, metadata.Get("x-codex-window-id").String())
	require.Equal(t, fingerprint.StartedAtMS, metadata.Get("turn_started_at_unix_ms").Int())
	for _, field := range []string{"cwd", "workspace", "git", "os", "arch", "terminal", "plugin", "skill", "mcp", "trace", "mystery"} {
		require.False(t, metadata.Get(field).Exists(), "field %q should be dropped", field)
	}
}

func TestPromptCacheKeyOnlyRewritesSessionDefault(t *testing.T) {
	fingerprint := hardeningFingerprint(t, fingerprintFull, "original-session")

	defaultKey, err := SanitizeCodexRequestBody(
		[]byte(`{"model":"gpt-5","prompt_cache_key":"original-session","client_metadata":{"session_id":"original-session"}}`),
		fingerprint,
		fingerprintFull,
	)
	require.NoError(t, err)
	require.Equal(t, fingerprint.SessionID, gjson.GetBytes(defaultKey, "prompt_cache_key").String())

	customKey, err := SanitizeCodexRequestBody(
		[]byte(`{"model":"gpt-5","prompt_cache_key":"custom-cache","client_metadata":{"session_id":"original-session"}}`),
		fingerprint,
		fingerprintFull,
	)
	require.NoError(t, err)
	require.Equal(t, "custom-cache", gjson.GetBytes(customKey, "prompt_cache_key").String())
}

func TestInvalidFullMetadataFailsClosed(t *testing.T) {
	fingerprint := hardeningFingerprint(t, fingerprintFull, "original-session")
	tooDeep := `{"model":"gpt-5","client_metadata":{"session_id":"original-session","a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":{"j":{"k":"too-deep"}}}}}}}}}}}}`
	cases := []struct {
		name string
		raw  []byte
	}{
		{name: "malformed json", raw: []byte(`{"model":"gpt-5","client_metadata":`)},
		{name: "scalar metadata", raw: []byte(`{"model":"gpt-5","client_metadata":"opaque"}`)},
		{name: "excessive nesting", raw: []byte(tooDeep)},
		{name: "excessive size", raw: []byte(`{"model":"gpt-5","client_metadata":{"session_id":"original-session","padding":"` + strings.Repeat("x", maxCodexMetadataBytes) + `"}}`)},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			rewritten, err := SanitizeCodexRequestBody(tt.raw, fingerprint, fingerprintFull)
			require.Error(t, err)
			require.Nil(t, rewritten)
		})
	}
}

func TestOAuthKeyIgnoresOpenAIDeviceID(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ApiKey: `{
			"access_token":"token",
			"account_id":"account",
			"openai_device_id":"018f89db-7792-7b5e-a360-openai-device"
		}`,
		ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "full"},
	}}
	header := http.Header{}

	err := (&Adaptor{}).SetupRequestHeader(c, &header, info)
	require.Error(t, err)
	require.Empty(t, header.Get("x-codex-installation-id"))
}

func TestFullSanitizeRawAndTypedMatch(t *testing.T) {
	fingerprint := hardeningFingerprint(t, fingerprintFull, "original-session")
	raw := []byte(`{"model":"gpt-5","prompt_cache_key":"original-session","client_metadata":{"session_id":"original-session","cwd":"/tmp"}}`)

	rewrittenRaw, err := SanitizeCodexRequestBody(raw, fingerprint, fingerprintFull)
	require.NoError(t, err)

	var typed map[string]any
	require.NoError(t, common.Unmarshal(raw, &typed))
	require.True(t, applyFingerprintBody(typed, codexFingerprintFromPublic(fingerprintFull, fingerprint)))
	rewrittenTyped, err := common.Marshal(typed)
	require.NoError(t, err)

	require.JSONEq(t, string(rewrittenRaw), string(rewrittenTyped))
}

func TestCompactStagesConvergedHeadersWithoutBodyMetadata(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := hardeningInfo(fingerprintSession)
	info.RelayMode = relayconstant.RelayModeResponsesCompact

	out, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{Model: "gpt-5"})
	require.NoError(t, err)
	body := out.(map[string]any)
	require.NotContains(t, body, "client_metadata")

	header := http.Header{}
	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &header, info))
	require.NotEmpty(t, header.Get("x-codex-installation-id"))
	require.NotEmpty(t, header.Get("session-id"))
	require.NotEmpty(t, header.Get("x-client-request-id"))
}

func TestImageStagesConvergedHeadersWithoutBodyMetadata(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Request.Header.Set("session-id", "client-session")
	info := hardeningInfo(fingerprintSession)
	info.RelayMode = relayconstant.RelayModeImagesGenerations

	out, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "test",
	})
	require.NoError(t, err)
	body := out.(map[string]any)
	require.NotContains(t, body, "client_metadata")

	header := http.Header{}
	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &header, info))
	require.NotEmpty(t, header.Get("x-codex-installation-id"))
	require.NotEmpty(t, header.Get("session-id"))
	require.NotEmpty(t, header.Get("x-client-request-id"))
}

func TestFingerprintErrorMessagesDoNotEchoIdentityMarkers(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	marker := "identity-marker-access-refresh-seed"
	_, err := ResolveCodexFingerprint(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		CodexFingerprintSeed: marker,
		ChannelSetting:       dto.ChannelSettings{CodexFingerprintMode: "full"},
	}}, marker, time.Unix(1700000000, 123000000))
	require.Error(t, err)
	require.NotContains(t, err.Error(), marker)

	fingerprint := hardeningFingerprint(t, fingerprintFull, marker)
	_, err = SanitizeCodexRequestBody(
		[]byte(`{"model":"gpt-5","client_metadata":"identity-marker-access-refresh-seed"}`),
		fingerprint,
		fingerprintFull,
	)
	require.Error(t, err)
	require.NotContains(t, err.Error(), marker)
	require.False(t, strings.Contains(err.Error(), hardeningSeed))
}
