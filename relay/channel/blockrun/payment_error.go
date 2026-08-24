package blockrun

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

const (
	maxSignedPaymentErrorBodyBytes = 64 << 10
	maxSignedPaymentErrorFieldLen  = 1024
	maxSignedPaymentErrorDetailLen = 4096
	defaultSignedPaymentError      = "blockrun: payment signature rejected by upstream (status 402 after signing)"
)

var (
	paymentSignatureCredentialPattern = regexp.MustCompile(`(?i)(payment[-_ ]signature\s*[:=]?\s*)[A-Za-z0-9+/_=-]{16,}`)
	longOpaqueTokenPattern            = regexp.MustCompile(`[A-Za-z0-9+/_=-]{80,}`)
)

// signedPaymentRejectionError retains only structured upstream error fields.
// The full response body is never logged because an upstream may echo the
// signed payment payload. The current payload and generic credential-shaped
// values are removed before the detail leaves this trust boundary.
func signedPaymentRejectionError(resp *http.Response, paymentPayload string) error {
	if resp == nil || resp.Body == nil {
		return newSignedPaymentRejectionError(defaultSignedPaymentError)
	}
	body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxSignedPaymentErrorBodyBytes+1))
	_ = resp.Body.Close()
	if readErr != nil || len(body) == 0 || len(body) > maxSignedPaymentErrorBodyBytes {
		return newSignedPaymentRejectionError(defaultSignedPaymentError)
	}

	detail := extractSignedPaymentErrorDetail(body)
	if detail == "" {
		return newSignedPaymentRejectionError(defaultSignedPaymentError)
	}
	detail = sanitizeSignedPaymentErrorDetail(detail, paymentPayload)
	if detail == "" {
		return newSignedPaymentRejectionError(defaultSignedPaymentError)
	}
	return newSignedPaymentRejectionError(detail)
}

func newSignedPaymentRejectionError(message string) error {
	return types.NewOpenAIError(
		errors.New(message),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusPaymentRequired,
		types.ErrOptionWithSkipRetry(),
	)
}

func extractSignedPaymentErrorDetail(body []byte) string {
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return ""
	}

	parts := make([]string, 0, 6)
	if nested, ok := payload["error"].(map[string]any); ok {
		for _, key := range []string{"message", "code", "reason", "type", "details"} {
			appendSignedPaymentErrorField(&parts, key, nested[key])
		}
	} else {
		appendSignedPaymentErrorField(&parts, "error", payload["error"])
	}
	for _, key := range []string{"message", "code", "reason", "type", "details"} {
		appendSignedPaymentErrorField(&parts, key, payload[key])
	}
	return strings.Join(parts, "; ")
}

func appendSignedPaymentErrorField(parts *[]string, key string, value any) {
	var text string
	switch typed := value.(type) {
	case string:
		text = strings.TrimSpace(typed)
	case float64, bool:
		text = fmt.Sprint(typed)
	default:
		return
	}
	if text == "" {
		return
	}
	text = truncateSignedPaymentErrorText(text, maxSignedPaymentErrorFieldLen)
	*parts = append(*parts, key+"="+text)
}

func sanitizeSignedPaymentErrorDetail(detail, paymentPayload string) string {
	if paymentPayload != "" {
		detail = strings.ReplaceAll(detail, paymentPayload, "[REDACTED]")
	}
	detail = paymentSignatureCredentialPattern.ReplaceAllString(detail, "${1}[REDACTED]")
	detail = longOpaqueTokenPattern.ReplaceAllString(detail, "[REDACTED]")
	detail = common.MaskSensitiveInfo(detail)
	detail = strings.TrimSpace(detail)
	return truncateSignedPaymentErrorText(detail, maxSignedPaymentErrorDetailLen)
}

func truncateSignedPaymentErrorText(value string, limit int) string {
	runes := []rune(value)
	if len(runes) > limit {
		return string(runes[:limit])
	}
	return value
}
