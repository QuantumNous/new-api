package attemptlog

import (
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// Volatile fragments are stripped before hashing so that the same upstream
// failure clusters into one hash instead of one per occurrence.
var (
	hexIdPattern    = regexp.MustCompile(`\b[0-9a-fA-F]{8,}\b`)
	uuidPattern     = regexp.MustCompile(`\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b`)
	numberPattern   = regexp.MustCompile(`\d+`)
	quotedPattern   = regexp.MustCompile(`'[^']*'|"[^"]*"`)
	durationPattern = regexp.MustCompile(`\b\d+(\.\d+)?(ms|s|m|h)\b`)
	spacePattern    = regexp.MustCompile(`\s+`)
)

// ErrorHash returns a short stable fingerprint of an upstream error message,
// suitable for grouping. It returns "" for an empty message so that a
// successful attempt does not get a hash.
func ErrorHash(message string) string {
	normalized := normalizeErrorMessage(message)
	if normalized == "" {
		return ""
	}
	return common.Sha1([]byte(normalized))[:16]
}

func normalizeErrorMessage(message string) string {
	msg := strings.TrimSpace(strings.ToLower(message))
	if msg == "" {
		return ""
	}

	msg = uuidPattern.ReplaceAllString(msg, "<uuid>")
	msg = durationPattern.ReplaceAllString(msg, "<dur>")
	msg = quotedPattern.ReplaceAllString(msg, "<q>")
	msg = hexIdPattern.ReplaceAllString(msg, "<hex>")
	msg = numberPattern.ReplaceAllString(msg, "<n>")
	msg = spacePattern.ReplaceAllString(msg, " ")
	msg = strings.TrimSpace(msg)

	// Cap the input so a pathological upstream payload cannot dominate the
	// hash cost, while keeping enough prefix to stay discriminative.
	const maxLen = 512
	if len(msg) > maxLen {
		msg = msg[:maxLen]
	}
	return msg
}
