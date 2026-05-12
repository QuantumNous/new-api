package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestSafeErrorLogSnippetMasksSecretsAndTruncates(t *testing.T) {
	message := `Authorization: Bearer sk-secret123456789 api_key:abc123456789 token=secret-token ` + strings.Repeat("x", 900)

	snippet, truncated := SafeErrorLogSnippet(message, 120)

	require.True(t, truncated)
	require.NotContains(t, snippet, "sk-secret123456789")
	require.NotContains(t, snippet, "abc123456789")
	require.NotContains(t, strings.ToLower(snippet), "secret-token")
	require.Contains(t, snippet, "Authorization:***")
	require.Contains(t, snippet, "api_key:***")
	require.LessOrEqual(t, len([]rune(snippet)), 123)
}

func TestSafeErrorLogSnippetRedactsJSONSecretsAndPayloads(t *testing.T) {
	body := `{
		"error": {
			"message": "provider rejected request",
			"api_key": "abc123456789",
			"Authorization": "Bearer sk-secret123456789",
			"details": "prompt=raw embedded prompt; token=embedded-secret",
			"messages": [{"role": "user", "content": "raw prompt should not be logged"}],
			"image_url": "https://example.com/private-image.png",
			"file_data": "base64-file-content"
		}
	}`

	snippet, truncated := SafeErrorLogSnippet(body, 800)

	require.False(t, truncated)
	require.Contains(t, snippet, "provider rejected request")
	require.NotContains(t, snippet, "abc123456789")
	require.NotContains(t, snippet, "sk-secret123456789")
	require.NotContains(t, snippet, "raw prompt should not be logged")
	require.NotContains(t, snippet, "raw embedded prompt")
	require.NotContains(t, snippet, "embedded-secret")
	require.NotContains(t, snippet, "private-image")
	require.NotContains(t, snippet, "base64-file-content")
	require.Contains(t, snippet, `"api_key":"***"`)
	require.Contains(t, snippet, `"Authorization":"***"`)
	require.Contains(t, snippet, `"messages":"[redacted]"`)
	require.Contains(t, snippet, `"image_url":"[redacted]"`)
	require.Contains(t, snippet, `"file_data":"[redacted]"`)
}

func TestSafeErrorLogSnippetRedactsTextPayloadFields(t *testing.T) {
	message := "upstream rejected prompt=write a long private story; content: raw user content with spaces, image_url=https://example.com/private.png"

	snippet, truncated := SafeErrorLogSnippet(message, 800)

	require.False(t, truncated)
	require.Contains(t, snippet, "upstream rejected")
	require.NotContains(t, snippet, "write a long private story")
	require.NotContains(t, snippet, "raw user content with spaces")
	require.NotContains(t, snippet, "private.png")
	require.Contains(t, snippet, "prompt=[redacted]")
	require.Contains(t, snippet, "content:[redacted]")
	require.Contains(t, snippet, "image_url=[redacted]")
}

func TestBuildErrorLogSummaryUsesStructuredOpenAIError(t *testing.T) {
	err := types.WithOpenAIError(types.OpenAIError{
		Message: "upstream rejected request Authorization: Bearer sk-secret123456789",
		Type:    "invalid_request_error",
		Code:    "context_length_exceeded",
	}, 400)

	summary := BuildErrorLogSummary(err)

	require.Equal(t, 400, summary["status_code"])
	require.Equal(t, "invalid_request_error", summary["type"])
	require.Equal(t, "context_length_exceeded", summary["code"])
	require.Equal(t, "upstream", summary["source"])
	require.NotContains(t, summary["message"], "sk-secret123456789")
	require.Contains(t, summary["message"], "Authorization:***")
}

func TestBuildErrorLogSummaryUsesMaskedFallback(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		errors.New("bad gateway from https://api.example.com/v1/chat?api_key=secret"),
		types.ErrorCodeBadResponseStatusCode,
		502,
	)

	summary := BuildErrorLogSummary(err)

	require.Equal(t, "upstream", summary["source"])
	require.NotContains(t, summary["message"], "api.example.com")
	require.NotContains(t, summary["message"], "secret")
	require.Contains(t, summary["message"], "https://***.com/***")
}
