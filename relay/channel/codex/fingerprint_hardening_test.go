package codex

import (
	"bytes"
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
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
		{name: "duplicate metadata keys", raw: []byte(`{"model":"gpt-5","client_metadata":{"session_id":"small"},"client_metadata":{"padding":"` + strings.Repeat("x", maxCodexMetadataBytes) + `"}}`)},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			rewritten, err := SanitizeCodexRequestBody(tt.raw, fingerprint, fingerprintFull)
			require.Error(t, err)
			require.Nil(t, rewritten)
		})
	}
}

func TestResolveCodexFingerprintRejectsNonCanonicalSeeds(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	for _, seed := range []string{
		uuid.Nil.String(),
		strings.ToUpper(hardeningSeed),
		strings.ReplaceAll(hardeningSeed, "-", ""),
	} {
		info := hardeningInfo(fingerprintFull)
		info.ChannelMeta.CodexFingerprintSeed = seed
		_, err := ResolveCodexFingerprint(info, "client", time.Unix(1700000000, 0))
		require.Error(t, err, seed)
	}
}

func TestFullMetadataBoundsRunBeforeWholeBodyUnmarshal(t *testing.T) {
	fingerprint := hardeningFingerprint(t, fingerprintFull, "original-session")
	oversized := []byte(`{"client_metadata":{"padding":"` + strings.Repeat("x", maxCodexMetadataBytes) + `"},"broken":`)

	rewritten, err := SanitizeCodexRequestBody(oversized, fingerprint, fingerprintFull)

	require.ErrorContains(t, err, "client_metadata is too large")
	require.Nil(t, rewritten)
}

func TestCompactFullMetadataBoundsRunBeforeWholeBodyUnmarshal(t *testing.T) {
	oversized := []byte(`{"client_metadata":{"padding":"` + strings.Repeat("x", maxCodexMetadataBytes) + `"},"broken":`)

	err := validateCompactPassThroughFullBody(oversized)

	require.ErrorContains(t, err, "client_metadata is too large")
}

func TestFullMetadataBoundsIgnoreLargeAndNestedNonMetadataFields(t *testing.T) {
	fingerprint := hardeningFingerprint(t, fingerprintFull, "original-session")
	raw := []byte(`{
		"model":"gpt-5",
		"input":"` + strings.Repeat("x", maxCodexMetadataBytes) + `",
		"tools":[{"type":"function","schema":{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":{"j":{"k":"valid-tool-schema"}}}}}}}}}}}}],
		"client_metadata":{"session_id":"original-session"}
	}`)

	rewritten, err := SanitizeCodexRequestBody(raw, fingerprint, fingerprintFull)
	require.NoError(t, err)
	require.Equal(t, strings.Repeat("x", maxCodexMetadataBytes), gjson.GetBytes(rewritten, "input").String())
	require.Equal(t, "valid-tool-schema", gjson.GetBytes(rewritten, "tools.0.schema.a.b.c.d.e.f.g.h.i.j.k").String())
	require.Equal(t, fingerprint.SessionID, gjson.GetBytes(rewritten, "client_metadata.session_id").String())
}

func TestFullFingerprintRejectsExcessiveNonMetadataNesting(t *testing.T) {
	fingerprint := hardeningFingerprint(t, fingerprintFull, "original-session")
	depth := 128
	nested := strings.Repeat("[", depth) + "null" + strings.Repeat("]", depth)
	raw := []byte(`{"model":"gpt-5","deep":` + nested + `,"client_metadata":{"session_id":"original-session"}}`)

	err := rejectDuplicateJSONKeys(raw, maxCodexRequestJSONDepth)
	require.ErrorContains(t, err, "json nesting exceeds maximum depth")

	rewritten, err := SanitizeCodexRequestBody(raw, fingerprint, fingerprintFull)

	require.Error(t, err)
	require.Nil(t, rewritten)
}

func TestOAuthKeyIgnoresOpenAIDeviceID(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	buildHeader := func(deviceID string) http.Header {
		t.Helper()
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
		c.Request.Header.Set("session-id", "client-session")
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
			CodexFingerprintSeed: hardeningSeed,
			ApiKey: `{
				"access_token":"token",
				"account_id":"account",
				"openai_device_id":"` + deviceID + `"
			}`,
			ChannelSetting: dto.ChannelSettings{CodexFingerprintMode: "full"},
		}}
		header := http.Header{}

		err := (&Adaptor{}).SetupRequestHeader(c, &header, info)
		require.NoError(t, err)
		return header
	}

	first := buildHeader("018f89db-7792-7b5e-a360-openai-device-a")
	second := buildHeader("018f89db-7792-7b5e-a360-openai-device-b")
	require.NotEmpty(t, first.Get("x-codex-installation-id"))
	require.Equal(t, first.Get("x-codex-installation-id"), second.Get("x-codex-installation-id"))
	require.Equal(t, first.Get("session-id"), second.Get("session-id"))
	require.Equal(t, first.Get("x-client-request-id"), second.Get("x-client-request-id"))
	require.Equal(t, first.Get("x-codex-window-id"), second.Get("x-codex-window-id"))
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

func TestCodexImageFailureLogDoesNotEchoOAuthOrMetadataMarkers(t *testing.T) {
	t.Setenv("CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE", "local")
	accessMarker := "codex-log-access-marker"
	refreshMarker := "codex-log-refresh-marker"
	metadataMarker := "codex-log-metadata-marker"
	logs := captureCodexSysError(t)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := hardeningInfo(fingerprintFull)
	info.ApiKey = `{"access_token":"` + accessMarker + `","refresh_token":"` + refreshMarker + `","account_id":"account"}`
	info.RelayMode = relayconstant.RelayModeImagesGenerations
	info.Request = &dto.ImageRequest{Model: "gpt-image-1", Prompt: "test"}
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body: io.NopCloser(strings.NewReader(`{
			"error":{
				"message":"upstream failure ` + accessMarker + ` ` + refreshMarker + ` ` + metadataMarker + `"
			}
		}`)),
		Header: http.Header{},
	}

	sanitizeCodexImageErrorResponse(c, resp)

	output := logs.String()
	require.NotContains(t, output, accessMarker)
	require.NotContains(t, output, refreshMarker)
	require.NotContains(t, output, metadataMarker)
}

func captureCodexSysError(t *testing.T) *bytes.Buffer {
	t.Helper()
	var logs bytes.Buffer
	common.LogWriterMu.Lock()
	previous := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logs
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = previous
		common.LogWriterMu.Unlock()
	})
	return &logs
}
