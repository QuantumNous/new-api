package codex

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/tidwall/gjson"
)

const maxErrorBodyPreview = 2048

func RelayErrorHandler(ctx context.Context, resp *http.Response) *types.NewAPIError {
	statusCode := http.StatusInternalServerError
	statusText := http.StatusText(statusCode)
	if resp != nil {
		statusCode = resp.StatusCode
		statusText = resp.Status
		if strings.TrimSpace(statusText) == "" {
			statusText = http.StatusText(statusCode)
		}
	}

	var responseBody []byte
	if resp != nil && resp.Body != nil {
		body, err := io.ReadAll(resp.Body)
		if err == nil {
			responseBody = body
		}
		service.CloseResponseBodyGracefully(resp)
	}

	message := extractCodexErrorMessage(responseBody)
	if message == "" {
		message = strings.TrimSpace(string(responseBody))
	}
	message = truncateErrorMessage(message)

	if message == "" {
		message = fmt.Sprintf("codex upstream error: status %d %s", statusCode, statusText)
	} else {
		message = fmt.Sprintf("codex upstream error: status %d %s: %s", statusCode, statusText, message)
	}

	return types.NewOpenAIError(fmt.Errorf("%s", message), types.ErrorCodeBadResponseStatusCode, statusCode)
}

func extractCodexErrorMessage(body []byte) string {
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" || (trimmed[0] != '{' && trimmed[0] != '[') {
		return ""
	}

	paths := []string{
		"error.message",
		"message",
		"msg",
		"err",
		"error_msg",
		"detail",
		"header.message",
		"response.error.message",
		"error",
	}
	for _, path := range paths {
		result := gjson.GetBytes(body, path)
		if !result.Exists() || result.Type == gjson.Null {
			continue
		}
		switch result.Type {
		case gjson.String, gjson.Number, gjson.True, gjson.False:
			if msg := strings.TrimSpace(result.String()); msg != "" {
				return msg
			}
		default:
			if msg := strings.TrimSpace(result.Raw); msg != "" {
				return msg
			}
		}
	}
	return ""
}

func truncateErrorMessage(message string) string {
	message = strings.TrimSpace(message)
	if len(message) <= maxErrorBodyPreview {
		return message
	}
	return message[:maxErrorBodyPreview] + "...(truncated)"
}
