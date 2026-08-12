package service

import (
	"bytes"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	"github.com/gin-gonic/gin"
)

const (
	errorLogBodyMaxBytes      = 32 * 1024
	errorLogLongStringKeep    = 256
	errorLogNonJSONBodyKeep   = 8 * 1024
	errorLogDataURLPrefixKeep = 64
)

// AttachErrorLogRequestPayloads adds sanitized client/upstream request payloads into
// error-log other fields when available on the gin context.
func AttachErrorLogRequestPayloads(c *gin.Context, other map[string]interface{}) {
	if c == nil || other == nil {
		return
	}
	if _, exists := other["request_body"]; !exists {
		if body := extractClientRequestBodyForErrorLog(c); body != nil {
			other["request_body"] = body
		}
	}
	if _, exists := other["upstream_request_body"]; !exists {
		if v, ok := c.Get(taskcommon.GinKeyUpstreamRequestBody); ok {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				if body := sanitizeErrorLogBodyBytes([]byte(s)); body != nil {
					other["upstream_request_body"] = body
				}
			}
		}
	}
}

func extractClientRequestBodyForErrorLog(c *gin.Context) interface{} {
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return nil
	}
	raw, err := storage.Bytes()
	if err != nil || len(raw) == 0 {
		return nil
	}
	ct := ""
	if c.Request != nil {
		ct = strings.ToLower(strings.TrimSpace(c.Request.Header.Get("Content-Type")))
	}
	if strings.HasPrefix(ct, "multipart/") {
		// Avoid dumping multipart binary; prefer structured task request when present.
		if v, ok := c.Get("task_request"); ok && v != nil {
			if b, err := common.Marshal(v); err == nil {
				return sanitizeErrorLogBodyBytes(b)
			}
		}
		return map[string]interface{}{
			"_note":         "multipart body omitted; see task fields when available",
			"_content_type": ct,
			"_bytes":        len(raw),
		}
	}
	return sanitizeErrorLogBodyBytes(raw)
}

func sanitizeErrorLogBodyBytes(raw []byte) interface{} {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return nil
	}

	var parsed interface{}
	if err := common.Unmarshal(raw, &parsed); err == nil {
		sanitized := sanitizeErrorLogValue(parsed)
		b, err := common.Marshal(sanitized)
		if err != nil {
			return truncateErrorLogString(string(raw), errorLogNonJSONBodyKeep)
		}
		if len(b) > errorLogBodyMaxBytes {
			return map[string]interface{}{
				"_truncated": true,
				"_bytes":    len(b),
				"_preview":  truncateErrorLogString(string(b), errorLogBodyMaxBytes),
			}
		}
		return sanitized
	}

	return truncateErrorLogString(string(raw), errorLogNonJSONBodyKeep)
}

func sanitizeErrorLogValue(v interface{}) interface{} {
	switch t := v.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(t))
		for k, val := range t {
			out[k] = sanitizeErrorLogValue(val)
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(t))
		for i, val := range t {
			out[i] = sanitizeErrorLogValue(val)
		}
		return out
	case string:
		return sanitizeErrorLogString(t)
	default:
		return v
	}
}

func sanitizeErrorLogString(s string) string {
	trimmed := strings.TrimSpace(s)
	if strings.HasPrefix(strings.ToLower(trimmed), "data:") {
		if len(s) <= errorLogLongStringKeep {
			return s
		}
		keep := errorLogDataURLPrefixKeep
		if keep > len(s) {
			keep = len(s)
		}
		return s[:keep] + "...(data_url_redacted)"
	}
	if len(s) > errorLogLongStringKeep && looksLikeEmbeddedBinary(s) {
		return truncateErrorLogString(s, errorLogLongStringKeep) + "(binary_or_base64_redacted)"
	}
	if len(s) > 4*1024 {
		return truncateErrorLogString(s, 4*1024)
	}
	return s
}

func looksLikeEmbeddedBinary(s string) bool {
	if strings.Contains(s, "base64,") {
		return true
	}
	// Long strings without whitespace are usually base64 / tokens / binary.
	if len(s) >= 512 && !strings.ContainsAny(s, " \n\t") {
		return true
	}
	return false
}

func truncateErrorLogString(s string, maxBytes int) string {
	if maxBytes <= 0 || len(s) <= maxBytes {
		return s
	}
	// Avoid cutting mid-rune.
	for maxBytes > 0 && !utf8.ValidString(s[:maxBytes]) {
		maxBytes--
	}
	return s[:maxBytes] + "..."
}
