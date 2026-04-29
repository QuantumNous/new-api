package common

import (
	"net/http"
	"strings"
	"unicode/utf8"
)

const LogTraceInlineLimit = 64 << 10

type TracePayloadPart struct {
	Headers     map[string][]string `json:"headers,omitempty"`
	Body        string              `json:"body,omitempty"`
	BodySize    int64               `json:"body_size,omitempty"`
	ContentType string              `json:"content_type,omitempty"`
	Truncated   bool                `json:"truncated,omitempty"`
	StorageKind string              `json:"storage_kind,omitempty"`
}

type TracePayload struct {
	Version           int               `json:"version"`
	Request           *TracePayloadPart `json:"request,omitempty"`
	Response          *TracePayloadPart `json:"response,omitempty"`
	UpstreamRequestId string            `json:"upstream_request_id,omitempty"`
	StatusCode        int               `json:"status_code,omitempty"`
}

func (info *RelayInfo) ensureTracePayload() *TracePayload {
	if info == nil {
		return nil
	}
	if info.TracePayload == nil {
		info.TracePayload = &TracePayload{
			Version: 1,
		}
	}
	return info.TracePayload
}

func cloneHeader(header http.Header) map[string][]string {
	if len(header) == 0 {
		return nil
	}
	cloned := make(map[string][]string, len(header))
	for key, values := range header {
		if len(values) == 0 {
			continue
		}
		items := make([]string, len(values))
		copy(items, values)
		cloned[key] = items
	}
	return cloned
}

func shouldInlineTraceBody(contentType string, body []byte) bool {
	lowerContentType := strings.ToLower(strings.TrimSpace(contentType))
	if lowerContentType == "" {
		return utf8.Valid(body)
	}
	if strings.Contains(lowerContentType, "multipart/form-data") {
		return false
	}
	if strings.HasPrefix(lowerContentType, "image/") ||
		strings.HasPrefix(lowerContentType, "audio/") ||
		strings.HasPrefix(lowerContentType, "video/") ||
		strings.Contains(lowerContentType, "application/octet-stream") {
		return false
	}
	if strings.HasPrefix(lowerContentType, "text/") ||
		strings.Contains(lowerContentType, "json") ||
		strings.Contains(lowerContentType, "xml") ||
		strings.Contains(lowerContentType, "javascript") ||
		strings.Contains(lowerContentType, "x-www-form-urlencoded") ||
		strings.Contains(lowerContentType, "graphql") {
		return true
	}
	return utf8.Valid(body)
}

func inferTraceStorageKind(contentType string, body []byte) string {
	lowerContentType := strings.ToLower(strings.TrimSpace(contentType))
	if len(body) == 0 {
		return "empty"
	}
	if strings.Contains(lowerContentType, "multipart/form-data") {
		return "omitted_multipart"
	}
	if !shouldInlineTraceBody(contentType, body) {
		return "omitted_binary"
	}
	return "inline_text"
}

func fillTracePart(part *TracePayloadPart, contentType string, preview []byte, bodySize int64, truncated bool) {
	if part == nil {
		return
	}
	part.ContentType = contentType
	part.BodySize = bodySize
	part.Truncated = truncated
	part.StorageKind = inferTraceStorageKind(contentType, preview)
	if part.StorageKind != "inline_text" {
		part.Body = ""
		return
	}
	part.Body = string(preview)
}

func (info *RelayInfo) SetTraceRequestHeaders(header http.Header) {
	payload := info.ensureTracePayload()
	if payload == nil {
		return
	}
	if payload.Request == nil {
		payload.Request = &TracePayloadPart{}
	}
	payload.Request.Headers = cloneHeader(header)
}

func (info *RelayInfo) SetTraceResponseHeaders(resp *http.Response) {
	payload := info.ensureTracePayload()
	if payload == nil || resp == nil {
		return
	}
	if payload.Response == nil {
		payload.Response = &TracePayloadPart{}
	}
	payload.Response.Headers = cloneHeader(resp.Header)
	payload.Response.ContentType = resp.Header.Get("Content-Type")
	payload.StatusCode = resp.StatusCode
	if upstreamRequestId := extractUpstreamRequestId(resp.Header); upstreamRequestId != "" {
		payload.UpstreamRequestId = upstreamRequestId
	}
}

func extractUpstreamRequestId(header http.Header) string {
	for _, key := range []string{
		"x-request-id",
		"request-id",
		"anthropic-request-id",
		"x-openai-request-id",
		"openai-request-id",
		"x-b3-traceid",
	} {
		if value := strings.TrimSpace(header.Get(key)); value != "" {
			return value
		}
	}
	return ""
}

func (info *RelayInfo) SetTraceRequestBodyPreview(contentType string, preview []byte, bodySize int64, truncated bool) {
	payload := info.ensureTracePayload()
	if payload == nil {
		return
	}
	if payload.Request == nil {
		payload.Request = &TracePayloadPart{}
	}
	fillTracePart(payload.Request, contentType, preview, bodySize, truncated)
}

func (info *RelayInfo) SetTraceResponseBodyPreview(contentType string, preview []byte, bodySize int64, truncated bool) {
	payload := info.ensureTracePayload()
	if payload == nil {
		return
	}
	if payload.Response == nil {
		payload.Response = &TracePayloadPart{}
	}
	fillTracePart(payload.Response, contentType, preview, bodySize, truncated)
}

func (info *RelayInfo) AppendTraceResponseChunk(chunk string) {
	payload := info.ensureTracePayload()
	if payload == nil || chunk == "" {
		return
	}
	if payload.Response == nil {
		payload.Response = &TracePayloadPart{
			StorageKind: "inline_text",
		}
	}
	part := payload.Response
	if part.StorageKind == "" {
		part.StorageKind = "inline_text"
	}
	if part.ContentType == "" {
		part.ContentType = "text/event-stream"
	}
	part.BodySize += int64(len(chunk))
	if part.StorageKind != "inline_text" {
		return
	}
	if part.Truncated || len(part.Body) >= LogTraceInlineLimit {
		part.Truncated = true
		return
	}
	remain := LogTraceInlineLimit - len(part.Body)
	if remain <= 0 {
		part.Truncated = true
		return
	}
	if len(chunk) > remain {
		part.Body += chunk[:remain]
		part.Truncated = true
		return
	}
	part.Body += chunk
}
