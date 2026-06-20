package generationdebug

import (
	"crypto/sha256"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
)

const longStringThreshold = 16 << 10

var (
	bearerPattern        = regexp.MustCompile(`(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+`)
	jsonSensitivePattern = regexp.MustCompile(`(?i)("(?:authorization|api[_-]?key|access[_-]?token|token|cookie|set-cookie|key)"\s*:\s*)"[^"]*"`)
)

func SanitizeJSON(data []byte) ([]byte, error) {
	var value any
	if err := common.Unmarshal(data, &value); err != nil {
		return nil, err
	}
	sanitized := sanitizeValue(value, "")
	return common.Marshal(sanitized)
}

func TruncateValue(value []byte, maxBytes int) ([]byte, bool) {
	if maxBytes <= 0 || len(value) <= maxBytes {
		return value, false
	}
	end := maxBytes
	for end > 0 && !utf8.Valid(value[:end]) {
		end--
	}
	return value[:end], true
}

func sanitizeValue(value any, key string) any {
	if isSensitiveKey(key) {
		return "[REDACTED]"
	}
	switch typed := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(typed))
		for childKey, childValue := range typed {
			result[childKey] = sanitizeValue(childValue, childKey)
		}
		return result
	case []any:
		result := make([]any, len(typed))
		for i, childValue := range typed {
			result[i] = sanitizeValue(childValue, key)
		}
		return result
	case string:
		return sanitizeString(typed)
	default:
		return value
	}
}

func isSensitiveKey(key string) bool {
	normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(key), "-", "_"), " ", "_"))
	switch normalized {
	case "authorization", "api_key", "apikey", "key", "token", "access_token",
		"refresh_token", "cookie", "set_cookie", "secret", "client_secret":
		return true
	default:
		return strings.HasSuffix(normalized, "_api_key") ||
			strings.HasSuffix(normalized, "_access_token") ||
			strings.HasSuffix(normalized, "_secret")
	}
}

func sanitizeString(value string) string {
	if bearerPattern.MatchString(value) {
		value = bearerPattern.ReplaceAllString(value, "Bearer [REDACTED]")
	}
	lower := strings.ToLower(value)
	if strings.HasPrefix(lower, "data:image/") ||
		strings.HasPrefix(lower, "data:audio/") ||
		strings.HasPrefix(lower, "data:video/") ||
		strings.HasPrefix(lower, "data:application/") {
		return omittedString("data_uri", value)
	}
	if len(value) >= 1024 && looksLikeBase64(value) {
		return omittedString("base64", value)
	}
	if len(value) > longStringThreshold {
		return omittedString("long_string", value)
	}
	return value
}

func looksLikeBase64(value string) bool {
	checked := 0
	for _, r := range value {
		if r == '\r' || r == '\n' || r == ' ' || r == '\t' {
			continue
		}
		checked++
		if !((r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') ||
			(r >= '0' && r <= '9') || r == '+' || r == '/' || r == '=' ||
			r == '-' || r == '_') {
			return false
		}
	}
	return checked >= 1024
}

func omittedString(kind, value string) string {
	sum := sha256.Sum256([]byte(value))
	return fmt.Sprintf("[OMITTED type=%s bytes=%d sha256=%x]", kind, len(value), sum[:8])
}

func sanitizeUnstructured(data []byte) string {
	lines := strings.Split(string(data), "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "data:") {
			payload := strings.TrimSpace(strings.TrimPrefix(trimmed, "data:"))
			if sanitized, err := SanitizeJSON([]byte(payload)); err == nil {
				prefix := line[:strings.Index(line, "data:")]
				lines[i] = prefix + "data: " + string(sanitized)
				continue
			}
		}
		lines[i] = sanitizeUnstructuredLine(line)
	}
	return strings.Join(lines, "\n")
}

func sanitizeUnstructuredLine(value string) string {
	value = bearerPattern.ReplaceAllString(value, "Bearer [REDACTED]")
	value = jsonSensitivePattern.ReplaceAllString(value, `${1}"[REDACTED]"`)
	return summarizeLongQuotedStrings(value)
}

func summarizeLongQuotedStrings(value string) string {
	var result strings.Builder
	for start := 0; start < len(value); {
		quote := strings.IndexByte(value[start:], '"')
		if quote < 0 {
			result.WriteString(value[start:])
			break
		}
		quote += start
		result.WriteString(value[start : quote+1])
		end := quote + 1
		escaped := false
		for end < len(value) {
			if value[end] == '\\' && !escaped {
				escaped = true
				end++
				continue
			}
			if value[end] == '"' && !escaped {
				break
			}
			escaped = false
			end++
		}
		content := value[quote+1 : end]
		lower := strings.ToLower(content)
		shouldOmit := len(content) > longStringThreshold ||
			(len(content) >= 1024 && looksLikeBase64(content)) ||
			strings.HasPrefix(lower, "data:image/") ||
			strings.HasPrefix(lower, "data:audio/") ||
			strings.HasPrefix(lower, "data:video/") ||
			strings.HasPrefix(lower, "data:application/")
		if shouldOmit {
			result.WriteString(omittedString("truncated_string", content))
		} else {
			result.WriteString(content)
		}
		if end < len(value) {
			result.WriteByte('"')
			end++
		}
		start = end
	}
	return result.String()
}
