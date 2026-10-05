package common

import (
	"bytes"
	"context"
	"errors"
	"io"
	"math"
	"mime"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// HTTP audit emits bounded JSON lines through the application's existing log
// writer. It has no dependency on a log agent, database, or remote log service.
// Configuration is initialized once, before HTTP clients or handlers are used.
var HTTPAuditEnabled bool
var httpAuditHMACKey []byte

const httpAuditCaptureBytes = 1 << 20

func InitHTTPAudit() error {
	HTTPAuditEnabled = false
	httpAuditHMACKey = nil
	if value := os.Getenv("HTTP_AUDIT_ENABLED"); value != "" {
		enabled, err := strconv.ParseBool(value)
		if err != nil {
			return errors.New("HTTP_AUDIT_ENABLED must be a boolean")
		}
		if !enabled {
			return nil
		}
	} else {
		return nil
	}
	key := []byte(os.Getenv("HTTP_AUDIT_HMAC_KEY"))
	if len(key) < 32 {
		return errors.New("HTTP_AUDIT_HMAC_KEY must contain at least 32 bytes when HTTP audit is enabled")
	}
	httpAuditHMACKey = key
	HTTPAuditEnabled = true
	return nil
}

type httpAuditContextKey struct{}

type httpAuditRequest struct {
	requestID        string
	edgeID           string
	attempts         atomic.Uint64
	mu               sync.Mutex
	params           map[string]any
	paramsIncomplete bool
	result           map[string]any
}

func auditRequest(ctx context.Context) *httpAuditRequest {
	state, _ := ctx.Value(httpAuditContextKey{}).(*httpAuditRequest)
	return state
}

// SetHTTPAuditResult records the application result independently of HTTP
// status. Only classification/identifier fields belong here, never content.
func SetHTTPAuditResult(ctx context.Context, result map[string]any) {
	if state := auditRequest(ctx); state != nil {
		state.mu.Lock()
		defer state.mu.Unlock()
		state.result = result
	}
}

// ObserveHTTPAuditRequestBody uses an independent replay reader, not the live
// request cursor. Only selected scalar parameters survive in request state.
func ObserveHTTPAuditRequestBody(c *gin.Context, storage BodyStorage) {
	state := auditRequest(c.Request.Context())
	if state == nil {
		return
	}
	reader, err := storage.NewReader()
	if err != nil {
		return
	}
	defer reader.Close()
	data, _ := io.ReadAll(io.LimitReader(reader, httpAuditCaptureBytes))
	state.mu.Lock()
	state.params = auditParameters(data, c.Request.Header.Get("Content-Type"))
	state.paramsIncomplete = storage.Size() > httpAuditCaptureBytes
	state.mu.Unlock()
}

// The allowlist deliberately excludes free text, arbitrary objects, URLs,
// messages, input, prompts, and media. The audit never rewrites a payload.
var httpAuditParameterNames = []string{
	"model", "stream", "temperature", "top_p", "top_k", "max_tokens",
	"max_completion_tokens", "max_output_tokens", "seed", "n", "size",
	"quality", "duration", "seconds", "resolution", "aspect_ratio",
	"frequency_penalty", "presence_penalty", "response_format", "voice",
	"speed", "generationConfig.temperature", "generationConfig.topP",
	"generationConfig.topK", "generationConfig.maxOutputTokens",
}

func auditParameters(data []byte, contentType string) map[string]any {
	params := make(map[string]any)
	mediaType, attributes, _ := mime.ParseMediaType(contentType)
	switch mediaType {
	case "application/json":
		// gjson can recover fields preceding a truncated large content value.
		// Never decode/copy the entire prompt into the audit event.
		for _, name := range httpAuditParameterNames {
			value := gjson.GetBytes(data, name)
			if value.Type == gjson.String && safeAuditScalar(value.Str) {
				params[name] = value.Str
			} else if value.Type == gjson.Number && !math.IsInf(value.Float(), 0) || value.Type == gjson.True || value.Type == gjson.False {
				params[name] = value.Value()
			}
		}
	case "application/x-www-form-urlencoded":
		values, _ := url.ParseQuery(string(data))
		for _, name := range httpAuditParameterNames {
			if value := values.Get(name); value != "" && safeAuditScalar(value) {
				params[name] = value
			}
		}
	case "multipart/form-data":
		reader := multipart.NewReader(bytes.NewReader(data), attributes["boundary"])
		for {
			part, err := reader.NextPart()
			if err != nil {
				break
			}
			if part.FileName() == "" {
				for _, name := range httpAuditParameterNames {
					if part.FormName() == name {
						value, _ := io.ReadAll(io.LimitReader(part, 257))
						if safeAuditScalar(string(value)) {
							params[name] = string(value)
						}
						break
					}
				}
			}
		}
	}
	return params
}

func safeAuditScalar(value string) bool {
	if value == "" || len(value) > 256 || strings.Contains(value, "://") || strings.HasPrefix(value, "data:") {
		return false
	}
	for _, char := range value {
		if !(char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || strings.ContainsRune("._:/-", char)) {
			return false
		}
	}
	return true
}

func auditHeaders(headers http.Header) http.Header {
	clean := make(http.Header)
	for name, values := range headers {
		lower := strings.ToLower(name)
		if lower == "x-new-api-origin-verify" || lower == "link" || lower == "content-disposition" {
			continue
		}
		secret := false
		for _, word := range []string{"auth", "cookie", "token", "session", "key", "secret", "password", "passwd", "credential", "signature", "csrf"} {
			if strings.Contains(lower, word) {
				secret = true
				break
			}
		}
		if secret {
			continue
		}
		for _, value := range values {
			parsed, err := url.Parse(value)
			if err != nil && strings.Contains(value, "://") {
				continue
			}
			if err == nil && (parsed.IsAbs() || lower == "location" || lower == "referer") {
				parsed.User, parsed.RawQuery, parsed.Fragment = nil, "", ""
				value = parsed.String()
			}
			clean.Add(name, value)
		}
	}
	return clean
}

func auditTokenHash(req *http.Request) string {
	token := req.Header.Get("Authorization")
	if scheme, value, ok := strings.Cut(token, " "); ok && strings.EqualFold(scheme, "Bearer") {
		token = strings.TrimSpace(value)
	} else {
		token = "" // Do not fingerprint a Basic-auth password or login session.
	}
	for _, name := range []string{"X-Api-Key", "X-Goog-Api-Key"} {
		if token == "" {
			token = req.Header.Get(name)
		}
	}
	if token == "" {
		token = req.URL.Query().Get("key")
	}
	if token == "" {
		return ""
	}
	return GenerateHMACWithKey(httpAuditHMACKey, token)
}

func auditEvent(req *http.Request, direction string) map[string]any {
	event := map[string]any{
		"event": "http_audit", "direction": direction, "method": req.Method,
		"path": req.URL.Path, "request_headers": auditHeaders(req.Header),
		"outcome": "unknown",
	}
	if req.Host != "" {
		event["request_headers"].(http.Header).Set("Host", req.Host)
	} else {
		event["request_headers"].(http.Header).Set("Host", req.URL.Host)
	}
	if state := auditRequest(req.Context()); state != nil {
		event["request_id"], event["edge_request_id"] = state.requestID, state.edgeID
	}
	return event
}

func writeAuditEvent(event map[string]any, started time.Time) {
	event["timestamp"] = time.Now().UTC().Format(time.RFC3339Nano)
	event["duration_ms"] = time.Since(started).Milliseconds()
	event["level"] = "INFO"
	if event["outcome"] == "error" {
		event["level"] = "ERROR"
	}
	line := encodeHTTPAuditEvent(event)
	LogWriterMu.Lock()
	defer LogWriterMu.Unlock()
	_, _ = gin.DefaultWriter.Write(append(line, '\n'))
}

// HTTPAuditMiddleware covers all HTTP routes, including auth/validation
// rejections. It does not read bodies that the handler itself never consumed.
func HTTPAuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !HTTPAuditEnabled {
			c.Next()
			return
		}
		started := time.Now()
		state := &httpAuditRequest{requestID: c.GetString(RequestIdKey)}
		if id := c.GetHeader("X-Request-ID"); safeAuditScalar(id) {
			// Correlation only: an incoming ID is not an authentication claim and
			// never replaces the application's internally generated request ID.
			state.edgeID = id
		}
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), httpAuditContextKey{}, state))
		event := auditEvent(c.Request, "inbound")
		if hash := auditTokenHash(c.Request); hash != "" {
			event["token_hash"] = hash
		}
		requestBody := &httpAuditBody{ReadCloser: c.Request.Body}
		if c.Request.Body != nil {
			c.Request.Body = requestBody
		}
		writer := &httpAuditWriter{ResponseWriter: c.Writer}
		c.Writer = writer
		// Audit surrounds Recovery, so even a recovered panic has its real 500.
		defer func() {
			event["path"] = c.FullPath()
			if event["path"] == "" {
				event["path"] = "[unmatched]"
			}
			event["status"] = writer.Status()
			event["response_headers"] = auditHeaders(writer.Header())
			event["request_bytes_read"] = requestBody.bytes
			event["response_bytes"] = writer.capture.bytes
			event["upstream_attempts"] = state.attempts.Load()
			writer.capture.finish(event, writer.Status(), false)
			auditContextError(c.Request.Context(), event)
			state.mu.Lock()
			event["request_parameters_incomplete"] = requestBody.bytes == 0 && c.Request.ContentLength != 0 || requestBody.bytes > httpAuditCaptureBytes || c.GetHeader("Content-Encoding") != ""
			if state.params != nil {
				event["parameters"] = state.params
				event["request_parameters_incomplete"] = state.paramsIncomplete
			} else if c.Request.Header.Get("Content-Encoding") == "" {
				event["parameters"] = auditParameters(requestBody.data, c.Request.Header.Get("Content-Type"))
			}
			for name, value := range state.result {
				event[name] = value
			}
			state.mu.Unlock()
			writeAuditEvent(event, started)
		}()
		c.Next()
	}
}

type httpAuditWriter struct {
	gin.ResponseWriter
	capture httpAuditCapture
}

func (writer *httpAuditWriter) Write(data []byte) (int, error) {
	n, err := writer.ResponseWriter.Write(data)
	writer.capture.observe(data[:n], writer.Header().Get("Content-Type"))
	if err != nil {
		writer.capture.mu.Lock()
		writer.capture.readError = true
		writer.capture.mu.Unlock()
	}
	return n, err
}

func (writer *httpAuditWriter) WriteString(data string) (int, error) {
	return writer.Write([]byte(data))
}

func (writer *httpAuditWriter) Unwrap() http.ResponseWriter { return writer.ResponseWriter }

// WrapHTTPAuditTransport observes requests without changing headers, retry
// policy, TLS/proxy settings, GetBody, or response bytes. CloseIdleConnections
// is forwarded to preserve connection-pool invalidation.
func WrapHTTPAuditTransport(transport http.RoundTripper) http.RoundTripper {
	if !HTTPAuditEnabled {
		return transport
	}
	if transport == nil {
		transport = http.DefaultTransport
	}
	return &httpAuditTransport{RoundTripper: transport}
}

type httpAuditTransport struct{ http.RoundTripper }

func (transport *httpAuditTransport) CloseIdleConnections() {
	if closer, ok := transport.RoundTripper.(interface{ CloseIdleConnections() }); ok {
		closer.CloseIdleConnections()
	}
}

func (transport *httpAuditTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	started := time.Now()
	event := auditEvent(req, "outbound")
	event["upstream_host"] = req.URL.Host
	if state := auditRequest(req.Context()); state != nil {
		event["attempt_id"] = state.attempts.Add(1)
	} else {
		event["request_id"] = NewRequestId()
		event["attempt_id"] = uint64(1)
	}
	if id, ok := req.Context().Value(httpAuditChannelKey{}).([2]int); ok {
		event["channel_id"], event["channel_type"] = id[0], id[1]
	}
	// Inspect a bounded independent replay, never drain the transport's body.
	if req.GetBody != nil {
		if reader, err := req.GetBody(); err == nil {
			data, _ := io.ReadAll(io.LimitReader(reader, httpAuditCaptureBytes))
			reader.Close()
			event["parameters"] = auditParameters(data, req.Header.Get("Content-Type"))
			event["request_parameters_incomplete"] = req.ContentLength < 0 || req.ContentLength > httpAuditCaptureBytes
		}
	} else if req.Body != nil {
		event["request_parameters_incomplete"] = true
	}
	resp, err := transport.RoundTripper.RoundTrip(req)
	if err != nil {
		event["outcome"], event["error_type"] = "error", "transport_error"
		if errors.Is(err, context.Canceled) {
			event["outcome"], event["error_type"] = "cancelled", "context_cancelled"
		} else if errors.Is(err, context.DeadlineExceeded) {
			event["error_type"] = "timeout"
		} else if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
			event["error_type"] = "timeout"
		}
		// Raw transport errors can contain credential-bearing URLs.
		writeAuditEvent(event, started)
		return resp, err
	}
	event["status"], event["response_headers"] = resp.StatusCode, auditHeaders(resp.Header)
	if resp.Body == nil {
		capture := httpAuditCapture{eof: true}
		capture.finish(event, resp.StatusCode, true)
		writeAuditEvent(event, started)
		return resp, nil
	}
	if resp.StatusCode == http.StatusSwitchingProtocols {
		// Preserve the upgraded body's io.Writer/connection interfaces.
		writeAuditEvent(event, started)
		return resp, nil
	}
	body := &httpAuditBody{ReadCloser: resp.Body, event: event, started: started, ctx: req.Context(), status: resp.StatusCode, contentType: resp.Header.Get("Content-Type")}
	resp.Body = body
	return resp, nil
}

type httpAuditChannelKey struct{}

func WithHTTPAuditChannel(ctx context.Context, channelID, channelType int) context.Context {
	if !HTTPAuditEnabled {
		return ctx
	}
	return context.WithValue(ctx, httpAuditChannelKey{}, [2]int{channelID, channelType})
}

// Copy correlation onto an existing outbound context without changing its
// cancellation, deadlines, or other values. Some adaptors intentionally use
// an independent context; enabling audit must not change that behavior.
func WithHTTPAuditContext(ctx, incoming context.Context, channelID, channelType int) context.Context {
	if !HTTPAuditEnabled {
		return ctx
	}
	if state := auditRequest(incoming); state != nil {
		ctx = context.WithValue(ctx, httpAuditContextKey{}, state)
	}
	return WithHTTPAuditChannel(ctx, channelID, channelType)
}

type httpAuditBody struct {
	io.ReadCloser
	httpAuditCapture
	event       map[string]any
	started     time.Time
	ctx         context.Context
	status      int
	contentType string
	once        sync.Once
	delayed     bool
}

func (body *httpAuditBody) Read(data []byte) (int, error) {
	n, err := body.ReadCloser.Read(data)
	body.observe(data[:n], body.contentType)
	body.mu.Lock()
	if err == io.EOF {
		body.eof = true
	} else if err != nil {
		body.readError = true
	}
	body.mu.Unlock()
	if err == io.EOF && body.event != nil && !body.delayed {
		body.log(nil)
	}
	return n, err
}

func (body *httpAuditBody) Close() error {
	err := body.ReadCloser.Close()
	if body.event != nil && !body.delayed {
		body.log(nil)
	}
	return err
}

func (body *httpAuditBody) log(result map[string]any) {
	body.once.Do(func() {
		body.finish(body.event, body.status, true)
		auditContextError(body.ctx, body.event)
		body.mu.Lock()
		body.event["response_bytes_read"] = body.bytes
		body.mu.Unlock()
		for name, value := range result {
			if name == "outcome" && body.event[name] == "error" && value == "success" {
				continue
			}
			body.event[name] = value
		}
		writeAuditEvent(body.event, body.started)
	})
}

// The stream parser already knows protocol-level completion, cancellation and
// errors. Delay its attempt event until the parser has stopped all goroutines.
func BeginHTTPAuditStream(resp *http.Response) {
	if body, ok := resp.Body.(*httpAuditBody); ok {
		body.delayed = true
	}
}

func FinishHTTPAuditStream(resp *http.Response, result map[string]any) {
	if body, ok := resp.Body.(*httpAuditBody); ok {
		body.log(result)
	}
}

func auditContextError(ctx context.Context, event map[string]any) {
	if errors.Is(ctx.Err(), context.Canceled) {
		event["outcome"] = "cancelled"
	} else if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		event["outcome"], event["error_type"] = "error", "timeout"
	}
}

// HTTP bodies and SSE lines are observed with fixed memory bounds. Content is
// kept transiently only for classification; successful generated content is
// never placed in an event. Provider error diagnostics are the sole exception.
type httpAuditCapture struct {
	mu                   sync.Mutex
	data                 []byte
	bytes                int64
	eof                  bool
	readError            bool
	stream               bool
	line                 []byte
	lineDropped          bool
	inspectionIncomplete bool
	streamOutcome        string
	diagnostic           any
	usage                map[string]any
}

func (capture *httpAuditCapture) observe(data []byte, contentType string) {
	capture.mu.Lock()
	defer capture.mu.Unlock()
	capture.bytes += int64(len(data))
	if strings.HasPrefix(contentType, "text/event-stream") {
		capture.stream = true
		// Process lines as they arrive, never retain or buffer an entire stream.
		for _, char := range data {
			if char == '\n' {
				if !capture.lineDropped {
					capture.observeSSELine(capture.line)
				}
				capture.line = capture.line[:0]
				capture.lineDropped = false
			} else if len(capture.line) < 64*1024 {
				capture.line = append(capture.line, char)
			} else {
				capture.lineDropped, capture.inspectionIncomplete = true, true
			}
		}
		return
	}
	remaining := httpAuditCaptureBytes - len(capture.data)
	if remaining > 0 {
		capture.data = append(capture.data, data[:min(remaining, len(data))]...)
	}
}

func (capture *httpAuditCapture) observeSSELine(line []byte) {
	data, ok := strings.CutPrefix(string(line), "data:")
	if !ok {
		return
	}
	data = strings.TrimSpace(data)
	if data == "[DONE]" {
		if capture.streamOutcome != "error" {
			capture.streamOutcome = "success"
		}
		return
	}
	root := gjson.Parse(data)
	errorValue := root.Get("error")
	if !errorValue.Exists() {
		errorValue = root.Get("response.error")
	}
	if errorValue.Exists() && errorValue.Type != gjson.Null || root.Get("type").String() == "error" {
		capture.streamOutcome = "error"
		var diagnostic any
		if Unmarshal([]byte(data), &diagnostic) == nil {
			// Never retain delta/message/content siblings of an error envelope.
			if errorValue.Exists() {
				_ = Unmarshal([]byte(errorValue.Raw), &diagnostic)
			}
			capture.diagnostic = diagnostic
		}
	}
	switch root.Get("type").String() {
	case "response.failed", "response.incomplete":
		capture.streamOutcome = "error"
	case "response.cancelled":
		if capture.streamOutcome != "error" {
			capture.streamOutcome = "cancelled"
		}
	case "response.completed", "message_stop":
		if capture.streamOutcome == "" {
			capture.streamOutcome = "success"
		}
	}
	usage := root.Get("usage")
	if !usage.Exists() {
		usage = root.Get("response.usage")
	}
	capture.usage = auditUsage(usage, capture.usage)
}

func auditUsage(value gjson.Result, current map[string]any) map[string]any {
	for _, name := range []string{"input_tokens", "output_tokens", "prompt_tokens", "completion_tokens", "total_tokens"} {
		if field := value.Get(name); field.Type == gjson.Number && !math.IsInf(field.Float(), 0) {
			if current == nil {
				current = make(map[string]any)
			}
			current[name] = field.Value()
		}
	}
	return current
}

func (capture *httpAuditCapture) finish(event map[string]any, status int, provider bool) {
	capture.mu.Lock()
	defer capture.mu.Unlock()
	if capture.stream {
		if len(capture.line) > 0 && !capture.lineDropped {
			capture.observeSSELine(capture.line)
		}
		event["outcome"] = "unknown"
		if capture.streamOutcome != "" {
			event["outcome"] = capture.streamOutcome
		}
		if status >= 400 || capture.readError {
			event["outcome"] = "error"
		}
		if provider && capture.diagnostic != nil {
			event["diagnostic"] = capture.diagnostic
		}
		if capture.inspectionIncomplete {
			event["response_inspection_incomplete"] = true
		}
		if capture.usage != nil {
			event["usage"] = capture.usage
		}
		return
	}
	if status >= 400 || capture.readError {
		event["outcome"] = "error"
	} else if status == http.StatusAccepted {
		event["outcome"] = "accepted"
	} else if status >= 200 && status < 300 {
		event["outcome"] = "success"
	}
	root := gjson.ParseBytes(capture.data)
	if !root.IsObject() && capture.eof && len(capture.data) == 0 && status >= 200 && status < 300 {
		return // A successfully read empty HTTP response has no content to classify.
	}
	if usage := auditUsage(root.Get("usage"), nil); usage != nil {
		event["usage"] = usage
	}
	if !root.IsObject() {
		// SSE and non-JSON content have no generic semantic success signal.
		if status < 400 && event["outcome"] != "error" {
			event["outcome"] = "unknown"
		}
	} else if root.Get("error").Exists() && root.Get("error").Type != gjson.Null || root.Get("success").Type == gjson.False {
		event["outcome"] = "error"
		for _, field := range []string{"code", "type"} {
			if value := root.Get("error." + field); value.Exists() && safeAuditScalar(value.String()) {
				event["error_"+field] = value.String()
			}
		}
	}
	if event["outcome"] == "success" {
		switch root.Get("status").String() {
		case "queued", "pending", "in_progress", "processing", "running":
			event["outcome"] = "accepted"
		case "failed", "incomplete":
			event["outcome"] = "error"
		case "cancelled", "canceled":
			event["outcome"] = "cancelled"
		}
	}
	for _, name := range []string{"task_id", "data.task_id"} {
		if id := root.Get(name).String(); safeAuditScalar(id) {
			event["task_id"] = id
			break
		}
	}
	protocolError := root.Get("error").Exists() && root.Get("error").Type != gjson.Null || root.Get("success").Type == gjson.False || root.Get("status").String() == "failed"
	if provider && (status >= 400 || protocolError) {
		// Deliberately retain diagnostic text without heuristic redaction.
		// A provider can quote prompt text in its error; operators must account
		// for that exception when choosing access/retention for audit logs.
		var diagnostic any
		data := capture.data
		if status < 400 && root.Get("error").Exists() {
			data = []byte(root.Get("error").Raw)
		}
		if Unmarshal(data, &diagnostic) == nil {
			event["diagnostic"] = diagnostic
		} else if len(data) > 0 {
			event["diagnostic"] = string(data)
		}
	}
	if event["outcome"] == "success" && len(capture.data) > 0 && !gjson.ValidBytes(capture.data) {
		event["outcome"] = "unknown"
	}
	if capture.bytes > httpAuditCaptureBytes {
		event["response_inspection_incomplete"] = true
		if event["outcome"] == "success" {
			event["outcome"] = "unknown"
		}
	}
	if provider && !capture.eof && status < 400 && event["outcome"] != "error" {
		event["outcome"] = "unknown"
	}
}
