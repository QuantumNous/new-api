package service

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

const upstreamErrorSummaryMaxRunes = 800

var (
	secretAssignmentPattern   = regexp.MustCompile(`(?i)(["']?\b(?:authorization|api[-_ ]?key|x-api-key|access[-_ ]?token|refresh[-_ ]?token|bearer[-_ ]?token|secret|token)\b["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}\]]+)`)
	bearerTokenPattern        = regexp.MustCompile(`(?i)\bbearer\s+([a-z0-9._~+/=-]{8,})`)
	skTokenPattern            = regexp.MustCompile(`(?i)\bsk-[a-z0-9_-]{6,}`)
	payloadFieldPrefixPattern = regexp.MustCompile(`(?i)(["']?\b(?:prompt|messages|input|content|image[-_ ]?url|image|images|file[-_ ]?data|file|files|audio)\b["']?\s*[:=]\s*)`)
)

type UpstreamErrorLogSummary struct {
	StatusCode int    `json:"status_code,omitempty"`
	Type       string `json:"type,omitempty"`
	Code       string `json:"code,omitempty"`
	Message    string `json:"message,omitempty"`
	Source     string `json:"source,omitempty"`
	Truncated  bool   `json:"truncated,omitempty"`
}

func BuildErrorLogSummary(err *types.NewAPIError, secrets ...string) map[string]interface{} {
	if err == nil {
		return nil
	}

	summary := UpstreamErrorLogSummary{
		StatusCode: err.StatusCode,
		Type:       string(err.GetErrorType()),
		Code:       string(err.GetErrorCode()),
		Source:     ErrorSourceForLog(err),
	}

	switch relayErr := err.RelayError.(type) {
	case types.OpenAIError:
		if relayErr.Type != "" {
			summary.Type = relayErr.Type
		}
		if relayErr.Code != nil {
			summary.Code = fmt.Sprintf("%v", relayErr.Code)
		}
		summary.Message, summary.Truncated = SafeErrorLogSnippet(relayErr.Message, upstreamErrorSummaryMaxRunes, secrets...)
	case types.ClaudeError:
		if relayErr.Type != "" {
			summary.Type = relayErr.Type
		}
		summary.Code = relayErr.Type
		summary.Message, summary.Truncated = SafeErrorLogSnippet(relayErr.Message, upstreamErrorSummaryMaxRunes, secrets...)
	default:
		summary.Message, summary.Truncated = SafeErrorLogSnippet(err.MaskSensitiveError(), upstreamErrorSummaryMaxRunes, secrets...)
	}

	if summary.Message == "" {
		summary.Message, summary.Truncated = SafeErrorLogSnippet(err.MaskSensitiveError(), upstreamErrorSummaryMaxRunes, secrets...)
	}

	result := make(map[string]interface{})
	if summary.StatusCode != 0 {
		result["status_code"] = summary.StatusCode
	}
	if summary.Type != "" {
		result["type"] = summary.Type
	}
	if summary.Code != "" {
		result["code"] = summary.Code
	}
	if summary.Message != "" {
		result["message"] = summary.Message
	}
	if summary.Source != "" {
		result["source"] = summary.Source
	}
	if summary.Truncated {
		result["truncated"] = true
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func BuildUpstreamErrorLogSummary(err *types.NewAPIError, secrets ...string) map[string]interface{} {
	return BuildErrorLogSummary(err, secrets...)
}

func ErrorSourceForLog(err *types.NewAPIError) string {
	if err == nil {
		return ""
	}
	if types.IsChannelError(err) {
		return "channel"
	}
	switch err.GetErrorType() {
	case types.ErrorTypeOpenAIError, types.ErrorTypeClaudeError, types.ErrorTypeGeminiError, types.ErrorTypeUpstreamError:
		return "upstream"
	case types.ErrorTypeNewAPIError:
		switch err.GetErrorCode() {
		case types.ErrorCodeBadResponseStatusCode, types.ErrorCodeBadResponse, types.ErrorCodeBadResponseBody,
			types.ErrorCodeReadResponseBodyFailed, types.ErrorCodeEmptyResponse, types.ErrorCodeDoRequestFailed,
			types.ErrorCodeAwsInvokeError, types.ErrorCodePromptBlocked:
			return "upstream"
		default:
			return "new_api"
		}
	default:
		return string(err.GetErrorType())
	}
}

func SafeErrorLogSnippet(text string, maxRunes int, secrets ...string) (string, bool) {
	text = strings.TrimSpace(text)
	if text == "" {
		return "", false
	}
	masked := sanitizeErrorLogText(text, secrets...)
	if maxRunes <= 0 {
		return masked, false
	}
	return truncateRunes(masked, maxRunes)
}

func sanitizeErrorLogText(text string, secrets ...string) string {
	if redacted, ok := redactJSONErrorLogText(text, secrets...); ok {
		return redacted
	}
	text = common.MaskSecretsForLog(text, secrets...)
	text = maskErrorLogSecrets(text)
	return maskErrorLogPayloadFields(text)
}

func redactJSONErrorLogText(text string, secrets ...string) (string, bool) {
	var payload any
	if err := common.Unmarshal([]byte(text), &payload); err != nil {
		return "", false
	}
	payload = redactErrorLogValue(payload, secrets...)
	bytes, err := common.Marshal(payload)
	if err != nil {
		return "", false
	}
	return string(bytes), true
}

func redactErrorLogValue(value any, secrets ...string) any {
	switch typed := value.(type) {
	case map[string]any:
		for key, item := range typed {
			switch {
			case isSecretLogField(key):
				typed[key] = "***"
			case isPayloadLogField(key):
				typed[key] = "[redacted]"
			default:
				typed[key] = redactErrorLogValue(item, secrets...)
			}
		}
		return typed
	case []any:
		for i, item := range typed {
			typed[i] = redactErrorLogValue(item, secrets...)
		}
		return typed
	case string:
		return maskErrorLogPayloadFields(maskErrorLogSecrets(common.MaskSecretsForLog(typed, secrets...)))
	default:
		return typed
	}
}

func isSecretLogField(key string) bool {
	switch normalizeErrorLogField(key) {
	case "authorization", "apikey", "xapikey", "accesstoken", "refreshtoken", "bearertoken", "secret", "token":
		return true
	default:
		return false
	}
}

func isPayloadLogField(key string) bool {
	switch normalizeErrorLogField(key) {
	case "prompt", "prompts", "messages", "input", "inputs", "content", "imageurl", "image", "images", "filedata", "file", "files", "audio":
		return true
	default:
		return false
	}
}

func normalizeErrorLogField(key string) string {
	key = strings.ToLower(strings.TrimSpace(key))
	key = strings.ReplaceAll(key, "-", "")
	key = strings.ReplaceAll(key, "_", "")
	key = strings.ReplaceAll(key, " ", "")
	return key
}

func maskErrorLogSecrets(text string) string {
	if text == "" {
		return ""
	}
	text = bearerTokenPattern.ReplaceAllString(text, "Bearer ***")
	text = skTokenPattern.ReplaceAllString(text, "sk-***")
	text = secretAssignmentPattern.ReplaceAllStringFunc(text, func(match string) string {
		idx := strings.IndexAny(match, ":=")
		if idx < 0 {
			return "***"
		}
		key := strings.TrimSpace(match[:idx])
		return key + match[idx:idx+1] + "***"
	})
	return text
}

func maskErrorLogPayloadFields(text string) string {
	if text == "" {
		return ""
	}
	var builder strings.Builder
	cursor := 0
	for cursor < len(text) {
		loc := payloadFieldPrefixPattern.FindStringIndex(text[cursor:])
		if loc == nil {
			builder.WriteString(text[cursor:])
			break
		}
		prefixStart := cursor + loc[0]
		prefixEnd := cursor + loc[1]
		builder.WriteString(text[cursor:prefixStart])
		builder.WriteString(formatRedactedErrorLogField(text[prefixStart:prefixEnd], "[redacted]"))
		cursor = findErrorLogFieldValueEnd(text, prefixEnd)
	}
	return builder.String()
}

func formatRedactedErrorLogField(prefix string, replacement string) string {
	idx := strings.IndexAny(prefix, ":=")
	if idx < 0 {
		return replacement
	}
	key := strings.TrimSpace(prefix[:idx])
	return key + prefix[idx:idx+1] + replacement
}

func findErrorLogFieldValueEnd(text string, start int) int {
	if start >= len(text) {
		return start
	}
	switch text[start] {
	case '"', '\'':
		return findQuotedErrorLogFieldValueEnd(text, start)
	case '[', '{':
		return findBracketedErrorLogFieldValueEnd(text, start)
	}
	end := len(text)
	if loc := payloadFieldPrefixPattern.FindStringIndex(text[start:]); loc != nil && loc[0] > 0 {
		end = start + loc[0]
		for end > start && (text[end-1] == ' ' || text[end-1] == '\t') {
			end--
		}
	}
	for i := start; i < end; i++ {
		switch text[i] {
		case '\r', '\n', ',', ';', '}', ']':
			return i
		}
	}
	return end
}

func findQuotedErrorLogFieldValueEnd(text string, start int) int {
	quote := text[start]
	escaped := false
	for i := start + 1; i < len(text); i++ {
		if escaped {
			escaped = false
			continue
		}
		if text[i] == '\\' {
			escaped = true
			continue
		}
		if text[i] == quote {
			return i + 1
		}
	}
	return len(text)
}

func findBracketedErrorLogFieldValueEnd(text string, start int) int {
	open := text[start]
	close := byte(']')
	if open == '{' {
		close = '}'
	}
	depth := 0
	var quote byte
	escaped := false
	for i := start; i < len(text); i++ {
		if quote != 0 {
			if escaped {
				escaped = false
				continue
			}
			if text[i] == '\\' {
				escaped = true
				continue
			}
			if text[i] == quote {
				quote = 0
			}
			continue
		}
		switch text[i] {
		case '"', '\'':
			quote = text[i]
		case open:
			depth++
		case close:
			depth--
			if depth == 0 {
				return i + 1
			}
		case '\r', '\n':
			return i
		}
	}
	return len(text)
}

func truncateRunes(text string, maxRunes int) (string, bool) {
	if maxRunes <= 0 {
		return text, false
	}
	if utf8.RuneCountInString(text) <= maxRunes {
		return text, false
	}
	runes := []rune(text)
	return string(runes[:maxRunes]) + "...", true
}
