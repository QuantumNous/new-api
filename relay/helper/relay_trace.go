package helper

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

const relayTraceContextKey = "relay_trace"

type relayTrace struct {
	startedAt time.Time
	format    string
	writer    *relayTraceResponseWriter

	mu       sync.Mutex
	attempts []*relayTraceAttempt
}

type relayTraceAttempt struct {
	startedAt time.Time
	method    string
	url       string
	headers   map[string]any
	channel   map[string]any
	request   *relayTraceCapture
	response  *relayTraceResponse
	err       string
}

type relayTraceResponse struct {
	status  int
	headers map[string]any
	body    *relayTraceCapture
}

type relayTraceCapture struct {
	limit int

	mu    sync.Mutex
	data  bytes.Buffer
	total int64
}

type relayTraceResponseWriter struct {
	gin.ResponseWriter
	capture *relayTraceCapture
}

func (w *relayTraceResponseWriter) Write(data []byte) (int, error) {
	n, err := w.ResponseWriter.Write(data)
	w.capture.add(data[:n])
	return n, err
}

func (w *relayTraceResponseWriter) WriteString(value string) (int, error) {
	n, err := w.ResponseWriter.WriteString(value)
	w.capture.add([]byte(value[:n]))
	return n, err
}

func (c *relayTraceCapture) add(data []byte) {
	if len(data) == 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.total += int64(len(data))
	remaining := c.limit - c.data.Len()
	if remaining <= 0 {
		return
	}
	if len(data) > remaining {
		data = data[:remaining]
	}
	_, _ = c.data.Write(data)
}

func (c *relayTraceCapture) snapshot(contentType string) map[string]any {
	c.mu.Lock()
	data := append([]byte(nil), c.data.Bytes()...)
	total := c.total
	limit := c.limit
	c.mu.Unlock()
	return summarizeRelayTraceBody(data, total, limit, contentType, constant.RelayTraceLogFullBodyEnabled)
}

type relayTraceReadCloser struct {
	io.ReadCloser
	capture *relayTraceCapture
}

func (r *relayTraceReadCloser) Read(data []byte) (int, error) {
	n, err := r.ReadCloser.Read(data)
	r.capture.add(data[:n])
	return n, err
}

func StartRelayTrace(c *gin.Context, format string) {
	if !constant.RelayTraceLogEnabled || c == nil {
		return
	}
	writer := &relayTraceResponseWriter{
		ResponseWriter: c.Writer,
		capture:        newRelayTraceCapture(),
	}
	trace := &relayTrace{startedAt: time.Now(), format: format, writer: writer}
	c.Writer = writer
	c.Set(relayTraceContextKey, trace)
}

func CaptureUpstreamRequest(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) {
	trace := getRelayTrace(c)
	if trace == nil || req == nil {
		return
	}
	attempt := &relayTraceAttempt{
		startedAt: time.Now(),
		method:    req.Method,
		url:       sanitizeRelayTraceURL(req.URL),
		headers:   sanitizeRelayTraceHeaders(req.Header),
		channel:   relayTraceChannelInfo(c, info),
	}
	if req.Body != nil {
		attempt.request = newRelayTraceCapture()
		req.Body = &relayTraceReadCloser{ReadCloser: req.Body, capture: attempt.request}
	}
	trace.mu.Lock()
	trace.attempts = append(trace.attempts, attempt)
	trace.mu.Unlock()
}

func CaptureUpstreamResponse(c *gin.Context, resp *http.Response) {
	trace := getRelayTrace(c)
	if trace == nil || resp == nil {
		return
	}
	trace.mu.Lock()
	defer trace.mu.Unlock()
	if len(trace.attempts) == 0 {
		return
	}
	attempt := trace.attempts[len(trace.attempts)-1]
	attempt.response = &relayTraceResponse{
		status:  resp.StatusCode,
		headers: sanitizeRelayTraceHeaders(resp.Header),
	}
	if resp.Body != nil {
		capture := newRelayTraceCapture()
		attempt.response.body = capture
		resp.Body = &relayTraceReadCloser{ReadCloser: resp.Body, capture: capture}
	}
}

func CaptureUpstreamError(c *gin.Context, err error) {
	trace := getRelayTrace(c)
	if trace == nil || err == nil {
		return
	}
	trace.mu.Lock()
	defer trace.mu.Unlock()
	if len(trace.attempts) > 0 {
		trace.attempts[len(trace.attempts)-1].err = sanitizeRelayTraceString(err.Error())
	}
}

func FinishRelayTrace(c *gin.Context, err error) {
	trace := getRelayTrace(c)
	if trace == nil || c == nil {
		return
	}
	if !shouldLogRelayTrace(c.Writer.Status(), err) {
		return
	}

	payload := map[string]any{
		"event":        "relay_trace",
		"request_id":   c.GetString(common.RequestIdKey),
		"started_at":   trace.startedAt.Format(time.RFC3339Nano),
		"duration_ms":  time.Since(trace.startedAt).Milliseconds(),
		"relay_format": trace.format,
		"downstream_request": map[string]any{
			"method":      c.Request.Method,
			"url":         sanitizeRelayTraceURL(c.Request.URL),
			"protocol":    c.Request.Proto,
			"client_ip":   c.ClientIP(),
			"remote_addr": c.Request.RemoteAddr,
			"user_agent":  c.Request.UserAgent(),
			"identity": map[string]any{
				"user_id":        common.GetContextKeyInt(c, constant.ContextKeyUserId),
				"username":       common.GetContextKeyString(c, constant.ContextKeyUserName),
				"token_id":       common.GetContextKeyInt(c, constant.ContextKeyTokenId),
				"using_group":    common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
				"original_model": common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
			},
			"headers": sanitizeRelayTraceHeaders(c.Request.Header),
			"body":    readIncomingRelayTraceBody(c),
		},
		"upstream_attempts": trace.snapshotAttempts(),
		"downstream_response": map[string]any{
			"status":  c.Writer.Status(),
			"headers": sanitizeRelayTraceHeaders(c.Writer.Header()),
			"body":    trace.writer.capture.snapshot(c.Writer.Header().Get("Content-Type")),
		},
	}
	if err != nil {
		payload["error"] = sanitizeRelayTraceString(err.Error())
	}
	data, marshalErr := common.Marshal(payload)
	if marshalErr != nil {
		logger.LogError(c, fmt.Sprintf("relay trace marshal failed: %s", marshalErr.Error()))
		return
	}
	logger.LogInfo(c, "relay_trace="+string(data))
}

func shouldLogRelayTrace(status int, err error) bool {
	return !constant.RelayTraceLogFailureOnly || err != nil || status >= http.StatusBadRequest
}

func (t *relayTrace) snapshotAttempts() []any {
	t.mu.Lock()
	defer t.mu.Unlock()
	result := make([]any, 0, len(t.attempts))
	for _, attempt := range t.attempts {
		item := map[string]any{
			"method":      attempt.method,
			"url":         attempt.url,
			"duration_ms": time.Since(attempt.startedAt).Milliseconds(),
			"headers":     attempt.headers,
			"channel":     attempt.channel,
		}
		if attempt.request != nil {
			item["request_body"] = attempt.request.snapshot(headerContentType(attempt.headers))
		}
		if attempt.response != nil {
			response := map[string]any{
				"status":  attempt.response.status,
				"headers": attempt.response.headers,
			}
			if attempt.response.body != nil {
				response["body"] = attempt.response.body.snapshot(headerContentType(attempt.response.headers))
			}
			item["response"] = response
		}
		if attempt.err != "" {
			item["error"] = attempt.err
		}
		result = append(result, item)
	}
	return result
}

func getRelayTrace(c *gin.Context) *relayTrace {
	if !constant.RelayTraceLogEnabled || c == nil {
		return nil
	}
	value, ok := c.Get(relayTraceContextKey)
	if !ok {
		return nil
	}
	trace, _ := value.(*relayTrace)
	return trace
}

func newRelayTraceCapture() *relayTraceCapture {
	maxKB := constant.RelayTraceLogMaxBodyKB
	if constant.RelayTraceLogFullBodyEnabled {
		maxKB = constant.RelayTraceLogFullBodyMaxMB * 1024
	}
	if maxKB < 1 {
		maxKB = 256
	}
	return &relayTraceCapture{limit: maxKB * 1024}
}

func readIncomingRelayTraceBody(c *gin.Context) map[string]any {
	if c.Request.ContentLength == 0 {
		return summarizeRelayTraceBody(nil, 0, newRelayTraceCapture().limit, c.Request.Header.Get("Content-Type"), constant.RelayTraceLogFullBodyEnabled)
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return map[string]any{"available": false, "error": sanitizeRelayTraceString(err.Error())}
	}
	if _, err = storage.Seek(0, io.SeekStart); err != nil {
		return map[string]any{"available": false, "error": sanitizeRelayTraceString(err.Error())}
	}
	capture := newRelayTraceCapture()
	_, _ = io.Copy(capture, io.LimitReader(storage, int64(capture.limit)+1))
	capture.mu.Lock()
	capture.total = storage.Size()
	capture.mu.Unlock()
	_, _ = storage.Seek(0, io.SeekStart)
	result := capture.snapshot(c.Request.Header.Get("Content-Type"))
	if c.Request.MultipartForm != nil {
		fields := make(map[string]any, len(c.Request.MultipartForm.Value))
		for key, values := range c.Request.MultipartForm.Value {
			if isRelayTraceSensitiveKey(key) {
				fields[key] = "[redacted]"
				continue
			}
			sanitized := make([]string, 0, len(values))
			for _, value := range values {
				sanitized = append(sanitized, sanitizeRelayTraceString(value))
			}
			fields[key] = sanitized
		}
		files := make(map[string]any, len(c.Request.MultipartForm.File))
		for key, values := range c.Request.MultipartForm.File {
			items := make([]any, 0, len(values))
			for _, file := range values {
				items = append(items, map[string]any{
					"filename":     file.Filename,
					"content_type": file.Header.Get("Content-Type"),
					"size":         file.Size,
				})
			}
			files[key] = items
		}
		result["form_fields"] = fields
		result["files"] = files
	}
	return result
}

func (c *relayTraceCapture) Write(data []byte) (int, error) {
	c.add(data)
	return len(data), nil
}

func summarizeRelayTraceBody(data []byte, total int64, limit int, contentType string, fullBody bool) map[string]any {
	result := map[string]any{
		"available":      true,
		"total_bytes":    total,
		"captured_bytes": len(data),
		"truncated":      total > int64(len(data)),
		"sample_sha256":  fmt.Sprintf("%x", sha256.Sum256(data)),
		"content_type":   contentType,
	}
	if total == 0 {
		return result
	}
	if fullBody {
		if isBinaryRelayTraceContent(contentType) {
			result["body_encoding"] = "base64"
			result["body"] = base64.StdEncoding.EncodeToString(data)
		} else {
			result["body"] = string(data)
		}
		return result
	}
	if isBinaryRelayTraceContent(contentType) {
		result["body"] = "[binary body omitted]"
		return result
	}
	if total > int64(limit) {
		result["body"] = "[body preview truncated]"
		return result
	}
	if isJSONRelayTraceContent(contentType) {
		var value any
		if err := common.Unmarshal(data, &value); err == nil {
			result["body"] = sanitizeRelayTraceValue(value, "")
			return result
		}
	}
	result["body"] = sanitizeRelayTraceString(string(data))
	return result
}

func sanitizeRelayTraceHeaders(headers http.Header) map[string]any {
	result := make(map[string]any, len(headers))
	for key, values := range headers {
		if isRelayTraceSensitiveKey(key) {
			result[key] = "[redacted]"
			continue
		}
		sanitized := make([]string, 0, len(values))
		for _, value := range values {
			sanitized = append(sanitized, sanitizeRelayTraceString(value))
		}
		result[key] = sanitized
	}
	return result
}

func relayTraceChannelInfo(c *gin.Context, info *relaycommon.RelayInfo) map[string]any {
	result := map[string]any{
		"channel_id":    common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		"channel_name":  common.GetContextKeyString(c, constant.ContextKeyChannelName),
		"used_channels": c.GetStringSlice("use_channel"),
	}
	if info != nil {
		result["channel_type"] = info.ChannelType
		result["origin_model"] = info.OriginModelName
		result["upstream_model"] = info.UpstreamModelName
		result["retry_index"] = info.RetryIndex
	}
	return result
}

func sanitizeRelayTraceValue(value any, key string) any {
	if isRelayTraceSensitiveKey(key) {
		return "[redacted]"
	}
	switch typed := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(typed))
		for childKey, child := range typed {
			result[childKey] = sanitizeRelayTraceValue(child, childKey)
		}
		return result
	case []any:
		result := make([]any, 0, len(typed))
		for _, child := range typed {
			result = append(result, sanitizeRelayTraceValue(child, key))
		}
		return result
	case string:
		return sanitizeRelayTraceString(typed)
	default:
		return typed
	}
}

func sanitizeRelayTraceString(value string) string {
	lower := strings.ToLower(value)
	if strings.HasPrefix(lower, "data:") || strings.Contains(lower, ";base64,") {
		return fmt.Sprintf("[binary data omitted, bytes=%d]", len(value))
	}
	parsed, err := url.Parse(value)
	if err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") {
		for key := range parsed.Query() {
			if isRelayTraceSensitiveKey(key) {
				query := parsed.Query()
				query.Set(key, "[redacted]")
				parsed.RawQuery = query.Encode()
			}
		}
		return parsed.String()
	}
	return value
}

func sanitizeRelayTraceURL(value *url.URL) string {
	if value == nil {
		return ""
	}
	copy := *value
	for key := range copy.Query() {
		if isRelayTraceSensitiveKey(key) {
			query := copy.Query()
			query.Set(key, "[redacted]")
			copy.RawQuery = query.Encode()
		}
	}
	return copy.String()
}

func isRelayTraceSensitiveKey(key string) bool {
	normalized := strings.ToLower(strings.NewReplacer("_", "", "-", "", ".", "").Replace(key))
	if strings.Contains(normalized, "authorization") ||
		strings.Contains(normalized, "apikey") ||
		strings.Contains(normalized, "secret") ||
		strings.Contains(normalized, "password") ||
		strings.Contains(normalized, "credential") ||
		strings.Contains(normalized, "signature") ||
		strings.Contains(normalized, "cookie") ||
		strings.Contains(normalized, "privatekey") ||
		strings.Contains(normalized, "session") ||
		(normalized != "tokens" && strings.HasSuffix(normalized, "token")) {
		return true
	}
	switch normalized {
	case "key", "b64json", "base64", "data", "inlinedata", "filedata", "image", "images", "mask", "inputimage", "referenceimage", "referenceimages":
		return true
	default:
		return false
	}
}

func isBinaryRelayTraceContent(contentType string) bool {
	contentType = strings.ToLower(contentType)
	return strings.HasPrefix(contentType, "image/") || strings.HasPrefix(contentType, "video/") || strings.HasPrefix(contentType, "audio/") || strings.HasPrefix(contentType, "multipart/") || strings.Contains(contentType, "octet-stream")
}

func isJSONRelayTraceContent(contentType string) bool {
	contentType = strings.ToLower(contentType)
	return strings.Contains(contentType, "application/json") || strings.Contains(contentType, "+json")
}

func headerContentType(headers map[string]any) string {
	for key, value := range headers {
		if !strings.EqualFold(key, "Content-Type") {
			continue
		}
		if values, ok := value.([]string); ok && len(values) > 0 {
			return values[0]
		}
	}
	return ""
}
