package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMaskSecretsForLogCoversCommonUpstreamKeyForms(t *testing.T) {
	text := strings.Join([]string{
		"Authorization: Bearer sk-test-secret123456",
		"api_key=raw-api-key",
		"x-api-key: x-header-secret",
		"plain sk-naked-secret123",
		"pair accessKey123|secretKey456",
		"url https://api.example.com/v1/chat?key=url-secret",
	}, " ")

	masked := MaskSecretsForLog(text)

	for _, secret := range []string{
		"sk-test-secret123456",
		"raw-api-key",
		"x-header-secret",
		"sk-naked-secret123",
		"accessKey123",
		"secretKey456",
		"url-secret",
		"api.example.com",
	} {
		require.NotContains(t, masked, secret)
	}
	require.Contains(t, masked, "Authorization:***")
	require.Contains(t, masked, "api_key=***")
	require.Contains(t, masked, "x-api-key:***")
	require.Contains(t, masked, "sk-***")
	require.Contains(t, masked, "***|***")
	require.Contains(t, masked, "https://***.com/***")
}

func TestMaskSecretsForLogMasksExplicitChannelKey(t *testing.T) {
	masked := MaskSecretsForLog("provider echoed channel key live-channel-secret", "live-channel-secret")

	require.NotContains(t, masked, "live-channel-secret")
	require.Contains(t, masked, "***")
}

func TestMaskSecretsForLogMasksAuthorizationBearerValue(t *testing.T) {
	masked := MaskSecretsForLog("Authorization: Bearer bearer-value-123456")

	require.Equal(t, "Authorization:***", masked)
	require.NotContains(t, masked, "bearer-value-123456")
}

func TestSanitizeUserVisibleErrorFallsBackForInternalFields(t *testing.T) {
	message := "status_code=502, upstream channel failed relay key_hint=abc Authorization: Bearer sk-test-secret123"

	safe := SanitizeUserVisibleError(message, 502, "bad_response")

	require.Equal(t, "status_code=502, error_code=bad_response", safe)
	require.NotContains(t, strings.ToLower(safe), "upstream")
	require.NotContains(t, strings.ToLower(safe), "channel")
	require.NotContains(t, strings.ToLower(safe), "relay")
	require.NotContains(t, safe, "sk-test-secret123")
}

func TestSanitizeUserVisibleErrorPreservesPlainProviderMessage(t *testing.T) {
	safe := SanitizeUserVisibleError("context length exceeded", 400, "context_length_exceeded")

	require.Equal(t, "context length exceeded", safe)
}

func TestSanitizeUserVisibleErrorCodeFallsBackForInternalCode(t *testing.T) {
	require.Equal(t, "request_error", SanitizeUserVisibleErrorCode("channel:no_available_key"))
	require.Equal(t, "request_error", SanitizeUserVisibleErrorCode("upstream_error"))
	require.Equal(t, "bad_request", SanitizeUserVisibleErrorCode("bad_request"))
}

func TestSanitizeUserVisibleErrorFallsBackForChineseInternalTerms(t *testing.T) {
	safe := SanitizeUserVisibleError("获取渠道密钥失败", 500, "get_channel_failed")

	require.Equal(t, "status_code=500, error_code=request_error", safe)
	require.NotContains(t, safe, "渠道")
	require.NotContains(t, safe, "密钥")
}
