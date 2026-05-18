package controller

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const errorRequestSnapshotBodyLimit = 16 * 1024

type errorRequestSnapshot struct {
	Method        string              `json:"method,omitempty"`
	Path          string              `json:"path,omitempty"`
	Query         string              `json:"query,omitempty"`
	ContentType   string              `json:"content_type,omitempty"`
	ContentLength int64               `json:"content_length,omitempty"`
	Headers       map[string][]string `json:"headers,omitempty"`
	Body          any                 `json:"body,omitempty"`
	BodyPreview   string              `json:"body_preview,omitempty"`
	BodyTruncated bool                `json:"body_truncated,omitempty"`
	BodyError     string              `json:"body_error,omitempty"`
}

func buildErrorRequestSnapshot(c *gin.Context) map[string]any {
	if c == nil || c.Request == nil {
		return nil
	}
	req := c.Request
	snapshot := errorRequestSnapshot{
		Method:        req.Method,
		ContentType:   req.Header.Get("Content-Type"),
		ContentLength: req.ContentLength,
		Headers:       sanitizeRequestHeaders(req.Header),
	}
	if req.URL != nil {
		snapshot.Path = req.URL.Path
		snapshot.Query = req.URL.RawQuery
	}

	bodyBytes, truncated, err := readRequestSnapshotBody(c)
	if err != nil {
		snapshot.BodyError = err.Error()
	} else if len(bodyBytes) > 0 {
		snapshot.BodyTruncated = truncated
		if isJSONSnapshotContentType(snapshot.ContentType) {
			var parsed any
			if err := common.Unmarshal(bodyBytes, &parsed); err == nil {
				snapshot.Body = sanitizeJSONValue(parsed)
			} else {
				snapshot.BodyPreview = string(bodyBytes)
				snapshot.BodyError = fmt.Sprintf("parse json failed: %s", err.Error())
			}
		} else if isTextSnapshotContentType(snapshot.ContentType) {
			snapshot.BodyPreview = string(bodyBytes)
		} else {
			snapshot.BodyPreview = fmt.Sprintf("<%d bytes omitted: %s>", len(bodyBytes), snapshot.ContentType)
		}
	}

	out := map[string]any{
		"method":         snapshot.Method,
		"path":           snapshot.Path,
		"query":          snapshot.Query,
		"content_type":   snapshot.ContentType,
		"content_length": snapshot.ContentLength,
		"headers":        snapshot.Headers,
		"body":           snapshot.Body,
		"body_preview":   snapshot.BodyPreview,
		"body_truncated": snapshot.BodyTruncated,
		"body_error":     snapshot.BodyError,
	}
	for key, value := range out {
		if isEmptySnapshotValue(value) {
			delete(out, key)
		}
	}
	return out
}

func readRequestSnapshotBody(c *gin.Context) ([]byte, bool, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, false, err
	}
	bodyBytes, err := storage.Bytes()
	if err != nil {
		return nil, false, err
	}
	if len(bodyBytes) <= errorRequestSnapshotBodyLimit {
		return bodyBytes, false, nil
	}
	return append([]byte(nil), bodyBytes[:errorRequestSnapshotBodyLimit]...), true, nil
}

func sanitizeRequestHeaders(headers http.Header) map[string][]string {
	if len(headers) == 0 {
		return nil
	}
	sanitized := make(map[string][]string, len(headers))
	for key, values := range headers {
		if isSensitiveSnapshotKey(key) {
			sanitized[key] = []string{"***"}
			continue
		}
		copied := make([]string, 0, len(values))
		for _, value := range values {
			copied = append(copied, sanitizeSnapshotString(value))
		}
		sanitized[key] = copied
	}
	return sanitized
}

func sanitizeJSONValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(typed))
		for key, item := range typed {
			if isSensitiveSnapshotKey(key) {
				out[key] = "***"
			} else {
				out[key] = sanitizeJSONValue(item)
			}
		}
		return out
	case []any:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			out = append(out, sanitizeJSONValue(item))
		}
		return out
	case string:
		return sanitizeSnapshotString(typed)
	default:
		return typed
	}
}

func sanitizeSnapshotString(value string) string {
	if value == "" {
		return value
	}
	if len(value) > errorRequestSnapshotBodyLimit {
		value = value[:errorRequestSnapshotBodyLimit] + "...(truncated)"
	}
	return common.MaskSensitiveInfo(value)
}

func isSensitiveSnapshotKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	normalized = strings.ReplaceAll(normalized, "-", "_")
	sensitiveFragments := []string{
		"authorization",
		"api_key",
		"apikey",
		"access_token",
		"refresh_token",
		"token",
		"password",
		"secret",
		"cookie",
		"credential",
	}
	for _, fragment := range sensitiveFragments {
		if strings.Contains(normalized, fragment) {
			return true
		}
	}
	return false
}

func isJSONSnapshotContentType(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	return strings.HasPrefix(contentType, "application/json") || strings.Contains(contentType, "+json")
}

func isTextSnapshotContentType(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	return strings.HasPrefix(contentType, "text/") ||
		strings.HasPrefix(contentType, "application/x-www-form-urlencoded")
}

func isEmptySnapshotValue(value any) bool {
	switch typed := value.(type) {
	case nil:
		return true
	case string:
		return typed == ""
	case int64:
		return typed == 0
	case bool:
		return !typed
	case map[string][]string:
		return len(typed) == 0
	default:
		return false
	}
}
