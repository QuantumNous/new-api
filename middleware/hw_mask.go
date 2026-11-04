package middleware

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"net"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// Provider masking. The customer may never see which supplier answered: no
// supplier name, no supplier header, no supplier response id and no supplier
// wording. Masking is structural (allowlisted headers, rewritten JSON/SSE
// payloads); the word scan exists only as a last-resort safety net.
const hwMaxPendingPayload = 4 << 20

// hwProviderNetEnabled toggles the last-resort scan. Tests disable it to prove
// the structural masking stands on its own.
var hwProviderNetEnabled atomic.Bool

func init() {
	hwProviderNetEnabled.Store(true)
}

// HwSetProviderNetEnabled switches the last-resort provider-word scan on or off.
func HwSetProviderNetEnabled(enabled bool) {
	hwProviderNetEnabled.Store(enabled)
}

// hwAllowedResponseHeaders lists the response headers a customer may receive.
// Everything else is dropped, which removes supplier traces by construction.
var hwAllowedResponseHeaders = map[string]bool{
	"content-type":        true,
	"content-length":      true,
	"cache-control":       true,
	"date":                true,
	"expires":             true,
	"pragma":              true,
	"vary":                true,
	"etag":                true,
	"last-modified":       true,
	"accept-ranges":       true,
	"content-range":       true,
	"content-disposition": true,
	"retry-after":         true,
	"x-accel-buffering":   true,
}

// hwContentKeys hold model-authored text. Masking them would rewrite the
// answer itself, so they are never touched by the last-resort word scan.
var hwContentKeys = map[string]bool{
	"content":           true,
	"text":              true,
	"thinking":          true,
	"reasoning":         true,
	"reasoning_content": true,
	"arguments":         true,
	"input":             true,
	"output_text":       true,
	"delta":             true,
}

type hwMaskWriter struct {
	gin.ResponseWriter
	ctx *gin.Context

	// base holds the header names our own middleware set before masking
	// started; they survive the allowlist because they carry no supplier
	// information.
	base map[string]bool
	live http.Header

	status      int
	headerSeen  bool
	committed   bool
	abandoned   bool
	transform   bool
	stream      bool
	anthropic   bool
	oaiChat     bool
	apiRoute    bool
	hijacked    bool
	flushed     bool
	lengthKnown bool
	buffer      bytes.Buffer
	pending     []byte
	// terminal holds the end-of-stream marker of the previous write. It is only
	// released when no error event follows it, so a client never sees the stream
	// close as complete right before the error that says it was cut short.
	terminal  []byte
	ownModel  string
	requestID string
}

// HwMask installs the customer-facing response mask. It belongs on every route a
// customer can call; admin-only routes do not need it.
func HwMask() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Writer == nil || hwMaskSkipped(c) {
			c.Next()
			return
		}
		if _, already := c.Writer.(*hwMaskWriter); already {
			c.Next()
			return
		}
		original := c.Writer
		writer := &hwMaskWriter{
			ResponseWriter: original,
			ctx:            c,
			base:           hwHeaderNameSet(original.Header()),
			live:           original.Header().Clone(),
			status:         http.StatusOK,
			ownModel:       c.GetString("original_model"),
			requestID:      c.GetString(common.RequestIdKey),
			anthropic:      hwAnthropicPath(c),
			oaiChat:        hwOpenAIChatPath(c),
			apiRoute:       hwOwnAPIRoute(c),
		}
		c.Writer = writer
		defer func() {
			if recovered := recover(); recovered != nil {
				c.Writer = original
				panic(recovered)
			}
			writer.finish()
			c.Writer = original
		}()
		c.Next()
	}
}

func hwHeaderNameSet(header http.Header) map[string]bool {
	names := make(map[string]bool, len(header))
	for name := range header {
		names[strings.ToLower(name)] = true
	}
	return names
}

// hwMaskSkipped reports whether a response must not be buffered or rewritten.
// The decision never looks at request headers: a customer can send "Upgrade" or
// "Connection: upgrade" on any route, and honouring those would hand out the
// unfiltered supplier answer. Only a connection the server itself hijacked is
// passed through, and the masking writer learns that from its own Hijack call.
func hwMaskSkipped(c *gin.Context) bool {
	return c == nil || c.Request == nil
}

func hwAnthropicPath(c *gin.Context) bool {
	if c == nil || c.Request == nil || c.Request.URL == nil {
		return false
	}
	return strings.Contains(c.Request.URL.Path, "/messages")
}

// hwOwnAPIRoute reports whether this request serves our own /api surface
// rather than a relay route. Relay answers pass through the supplier and must
// never hand out Set-Cookie or Location from that side.
func hwOwnAPIRoute(c *gin.Context) bool {
	return c != nil && c.Request != nil && c.Request.URL != nil &&
		strings.HasPrefix(c.Request.URL.Path, "/api/")
}

func (w *hwMaskWriter) Header() http.Header {
	return w.live
}

func (w *hwMaskWriter) Status() int {
	return w.status
}

func (w *hwMaskWriter) Written() bool {
	return w.committed
}

func (w *hwMaskWriter) WriteHeader(code int) {
	if code <= 0 || w.headerSeen {
		return
	}
	w.headerSeen = true
	w.status = code
	if !w.planTransform() {
		w.commit()
	}
}

func (w *hwMaskWriter) WriteHeaderNow() {
	if !w.headerSeen {
		w.WriteHeader(http.StatusOK)
	}
}

func (w *hwMaskWriter) Write(data []byte) (int, error) {
	if len(data) == 0 {
		return 0, nil
	}
	if w.abandoned {
		// The answer already ended with our own error; drop what follows.
		return len(data), nil
	}
	if !w.headerSeen {
		w.WriteHeader(http.StatusOK)
	}
	if w.hijacked {
		return w.ResponseWriter.Write(data)
	}
	if !w.transform {
		// A pass-through body leaves immediately; only its headers were ours.
		w.commit()
		return w.ResponseWriter.Write(data)
	}
	// Everything below runs the masking itself, so a panic there must not
	// reach gin's recovery with a half-masked answer in play.
	defer w.recoverFilterPanic()
	if w.stream {
		// A stream goes out event by event and commits its headers now; a
		// rewritten body gets its headers (and length) at finish.
		w.commit()
		service.HwNoteStreamWrite(w.ctx)
		isError := false
		if !hwLooksLikeSSE(data) {
			// The relay engine reports a terminal failure with a JSON envelope
			// while the client is already reading SSE; hand the client a proper
			// error event instead of a stray JSON document.
			data = w.streamErrorEvent(data)
			isError = true
		} else if hwStreamCarriesError(data) {
			isError = true
		}
		out := w.sanitizeStream(data)
		if isError {
			// The error event replaces the end-of-stream marker that was written
			// just before it: [DONE] followed by an error would tell an SDK the
			// answer is complete.
			w.terminal = nil
		} else if len(out) > 0 {
			if len(w.terminal) > 0 {
				merged := make([]byte, 0, len(w.terminal)+len(out))
				merged = append(merged, w.terminal...)
				out = append(merged, out...)
				w.terminal = nil
			}
			out, w.terminal = hwSplitStreamTerminal(out, w.anthropic)
		}
		if len(out) == 0 {
			return len(data), nil
		}
		_, err := w.ResponseWriter.Write(out)
		w.ResponseWriter.Flush()
		return len(data), err
	}
	w.buffer.Write(data)
	return len(data), nil
}

func (w *hwMaskWriter) WriteString(s string) (int, error) {
	return w.Write([]byte(s))
}

func (w *hwMaskWriter) Flush() {
	if !w.headerSeen {
		w.WriteHeader(http.StatusOK)
	}
	if !w.committed {
		defer w.recoverFilterPanic()
		w.commit()
	}
	w.flushed = true
	w.ResponseWriter.Flush()
}

// Hijack hands the connection to the protocol upgrade handler (WebSocket) and
// wraps its writer so the handshake response block is filtered before it leaves
// the process. Everything after the handshake — the WebSocket frames — is
// protocol data the HTTP mask cannot read, so it passes through unchanged; the
// handshake is the only place a supplier header could reach the customer.
func (w *hwMaskWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	conn, readWriter, err := w.ResponseWriter.Hijack()
	if err != nil {
		return nil, nil, err
	}
	w.hijacked = true
	readWriter.Writer = bufio.NewWriter(&hwHandshakeWriter{
		target: readWriter.Writer,
		ctx:    w.ctx,
	})
	return conn, readWriter, nil
}

// hwHandshakeWriter filters the status line and headers of a hijacked
// connection, then passes every following byte through untouched.
type hwHandshakeWriter struct {
	target io.Writer
	ctx    *gin.Context
	head   []byte
	open   bool
}

func (h *hwHandshakeWriter) Write(data []byte) (int, error) {
	if h.open {
		return h.target.Write(data)
	}
	h.head = append(h.head, data...)
	end := bytes.Index(h.head, []byte("\r\n\r\n"))
	if end < 0 {
		return len(data), nil
	}
	block := h.head[:end+4]
	rest := h.head[end+4:]
	h.head = nil
	h.open = true
	if _, err := h.target.Write(hwFilterHandshake(block)); err != nil {
		return 0, err
	}
	if len(rest) > 0 {
		if _, err := h.target.Write(rest); err != nil {
			return 0, err
		}
	}
	return len(data), nil
}

// hwFilterHandshake keeps the status line and drops every header line that names
// a supplier. Protocol headers (Upgrade, Connection, Sec-WebSocket-Accept) carry
// no supplier trace, so the handshake stays intact.
func hwFilterHandshake(block []byte) []byte {
	lines := bytes.Split(bytes.TrimSuffix(block, []byte("\r\n\r\n")), []byte("\r\n"))
	var out bytes.Buffer
	for index, line := range lines {
		if index == 0 {
			out.Write(line)
			out.WriteString("\r\n")
			continue
		}
		if len(line) == 0 {
			continue
		}
		name, value, found := bytes.Cut(line, []byte(":"))
		if !found {
			out.Write(line)
			out.WriteString("\r\n")
			continue
		}
		if common.HwHasProviderTrace(string(name)) {
			continue
		}
		out.Write(name)
		out.WriteString(":")
		out.WriteString(common.HwReplaceProviderTextWords(string(value)))
		out.WriteString("\r\n")
	}
	out.WriteString("\r\n")
	return out.Bytes()
}

// planTransform decides from the committed content type whether the body needs
// rewriting. Binary payloads pass through untouched; only their headers are
// filtered.
func (w *hwMaskWriter) planTransform() bool {
	contentType := strings.ToLower(w.live.Get("Content-Type"))
	w.stream = strings.HasPrefix(contentType, "text/event-stream")
	w.transform = w.stream ||
		strings.Contains(contentType, "json") ||
		strings.HasPrefix(contentType, "text/") ||
		contentType == ""
	return w.transform
}

// commit filters the response headers and writes the status line once.
func (w *hwMaskWriter) commit() {
	if w.committed {
		return
	}
	w.committed = true
	w.planTransform()
	target := w.ResponseWriter.Header()
	for key := range target {
		delete(target, key)
	}
	for key, values := range w.live {
		if !hwResponseHeaderAllowed(key, w.base, w.apiRoute) {
			continue
		}
		clean := make([]string, 0, len(values))
		for _, value := range values {
			clean = append(clean, hwSafetyNet(w.ctx, []byte(value)))
		}
		target[key] = clean
	}
	if w.requestID != "" && target.Get(common.RequestIdKey) == "" {
		target.Set(common.RequestIdKey, w.requestID)
	}
	if w.transform && (w.stream || !w.lengthKnown) {
		// Length is decided by the rewritten body, never by the supplier.
		target.Del("Content-Length")
	}
	w.ResponseWriter.WriteHeader(w.status)
}

// recoverFilterPanic turns a panic raised inside the masking itself into a
// neutral answer of ours. The route handler's own panics never pass through
// here and keep flowing to gin's recovery middleware. A hijacked connection
// can no longer receive a status line, so that case re-panics.
func (w *hwMaskWriter) recoverFilterPanic() {
	recovered := recover()
	if recovered == nil {
		return
	}
	path := ""
	if w.ctx != nil && w.ctx.Request != nil && w.ctx.Request.URL != nil {
		path = w.ctx.Request.URL.Path
	}
	common.SysError(fmt.Sprintf("provider mask panicked on %s: %v\n%s", path, recovered, debug.Stack()))
	if w.hijacked {
		panic(recovered)
	}
	if w.committed {
		// The stream already started; end it with our own error event. Every
		// later write is dropped so no half-masked fragment follows it.
		w.abandoned = true
		if w.stream {
			event := w.streamErrorEventFor(
				service.HwGenericErrorMessage(w.ctx, http.StatusInternalServerError), "internal_error")
			_, _ = w.ResponseWriter.Write(event)
			w.ResponseWriter.Flush()
		}
		return
	}
	w.resetToServerError()
}

// resetToServerError replaces an uncommitted answer with a neutral 500 JSON
// body written straight to the underlying writer, so the panic cannot leak a
// half-masked supplier answer.
func (w *hwMaskWriter) resetToServerError() {
	w.abandoned = true
	w.buffer.Reset()
	w.pending = nil
	w.terminal = nil
	w.stream = false
	w.transform = false
	w.committed = true
	w.headerSeen = true
	w.status = http.StatusInternalServerError
	body, err := common.Marshal(map[string]any{
		"error": map[string]any{
			"message": service.HwGenericErrorMessage(w.ctx, http.StatusInternalServerError),
			"type":    "server_error",
			"code":    "internal_error",
		},
	})
	if err != nil {
		body = []byte(`{"error":{"message":"The request could not be processed right now.","type":"server_error","code":"internal_error"}}`)
	}
	target := w.ResponseWriter.Header()
	for key := range target {
		delete(target, key)
	}
	target.Set("Content-Type", "application/json")
	target.Set("Content-Length", strconv.Itoa(len(body)))
	w.ResponseWriter.WriteHeader(http.StatusInternalServerError)
	_, _ = w.ResponseWriter.Write(body)
}

// finish flushes whatever the handler produced. Streams end with a final flush;
// buffered bodies are sanitised as a whole so the length stays correct.
func (w *hwMaskWriter) finish() {
	if w.hijacked || w.abandoned {
		return
	}
	defer w.recoverFilterPanic()
	if w.stream {
		if !w.headerSeen {
			w.WriteHeader(http.StatusOK)
		}
		if len(w.pending) > 0 {
			_, _ = w.ResponseWriter.Write([]byte(hwSafetyNet(w.ctx, w.pending)))
			w.pending = nil
		}
		if len(w.terminal) > 0 {
			_, _ = w.ResponseWriter.Write(w.terminal)
			w.terminal = nil
		}
		w.ResponseWriter.Flush()
		return
	}
	body := w.buffer.Bytes()
	if w.transform {
		body = w.sanitizeBody(body)
	}
	if !w.headerSeen {
		w.WriteHeader(http.StatusOK)
	}
	if !w.committed {
		if w.transform {
			// The rewritten body decides the length, never the upstream header.
			if len(body) > 0 && !w.flushed {
				w.live.Set("Content-Length", strconv.Itoa(len(body)))
				w.lengthKnown = true
			} else {
				w.live.Del("Content-Length")
			}
		}
		w.commit()
	}
	if len(body) == 0 {
		return
	}
	_, _ = w.ResponseWriter.Write(body)
}

// sanitizeBody rewrites a complete non-stream response body.
func (w *hwMaskWriter) sanitizeBody(body []byte) []byte {
	if len(body) == 0 {
		return body
	}
	var object map[string]any
	if err := common.Unmarshal(body, &object); err == nil && object != nil {
		w.sanitizeObject(object, w.status)
		if encoded, err := common.Marshal(object); err == nil {
			return encoded
		}
		return body
	}
	return []byte(hwSafetyNet(w.ctx, body))
}

// sanitizeStream rewrites the complete JSON values inside an SSE byte stream and
// forwards everything else (event names, comments, separators) verbatim.
func (w *hwMaskWriter) sanitizeStream(data []byte) []byte {
	w.pending = append(w.pending, data...)
	var out bytes.Buffer
	for len(w.pending) > 0 {
		start := hwJSONValueStart(w.pending)
		if start < 0 {
			out.WriteString(hwSafetyNet(w.ctx, w.pending))
			w.pending = nil
			break
		}
		if start > 0 {
			out.WriteString(hwSafetyNet(w.ctx, w.pending[:start]))
			w.pending = w.pending[start:]
		}
		end, complete := hwJSONValueEnd(w.pending)
		if !complete {
			if len(w.pending) > hwMaxPendingPayload {
				// The value exceeds the parse budget, so it goes out as text
				// instead of being rewritten structurally — but never raw:
				// the safety net still scrubs it.
				out.WriteString(hwSafetyNet(w.ctx, w.pending))
				w.pending = nil
			}
			break
		}
		out.Write(w.sanitizePayload(w.pending[:end]))
		w.pending = w.pending[end:]
	}
	if out.Len() == 0 {
		return nil
	}
	return out.Bytes()
}

// sanitizePayload rewrites one complete JSON value from a stream.
// hwFilterPanicHook lets tests of this package raise a panic inside the
// masking itself; it is nil in production.
var hwFilterPanicHook func()

// hwPayloadNeedles are the byte strings whose presence means one SSE chunk may
// need rewriting: supplier traces, the droppable supplier keys, the fields the
// mask rewrites (identity, model, error) and the escape sequence that could
// hide a trace. Chunks without any of them are pure model output.
var hwPayloadNeedles = []string{
	"lumia", "openrouter", "litellm", "portix", "kie",
	`"model"`, `"id"`, `"error"`, `"object"`, `"type"`, `"message`, `"response`,
	"native_finish_reason", "is_byok", "cost_details", "system_fingerprint",
	"provider", "generation_id", `"x_`, `"x-`, "gen-", `\u`, `"usage"`,
}

// hwPayloadNeedsParsing reports whether a chunk is worth parsing at all. The
// check is a case-insensitive byte scan without allocation, so the common
// chunk — plain model output — never pays for JSON decoding.
func hwPayloadNeedsParsing(payload []byte) bool {
	for _, needle := range hwPayloadNeedles {
		if hwContainsFold(payload, needle) {
			return true
		}
	}
	return false
}

// hwContainsFold reports whether data contains needle, ignoring ASCII case
// only, without building a lowered copy.
func hwContainsFold(data []byte, needle string) bool {
	needleLen := len(needle)
	if needleLen == 0 || len(data) < needleLen {
		return false
	}
	first := needle[0] | 0x20
	for index := 0; index+needleLen <= len(data); index++ {
		if data[index]|0x20 != first {
			continue
		}
		matched := true
		for offset := 0; offset < needleLen; offset++ {
			if data[index+offset]|0x20 != needle[offset]|0x20 {
				matched = false
				break
			}
		}
		if matched {
			return true
		}
	}
	return false
}

func (w *hwMaskWriter) sanitizePayload(payload []byte) []byte {
	if !hwPayloadNeedsParsing(payload) {
		// Nothing the mask would rewrite is present; pass the chunk through
		// byte for byte, spacing and key order included.
		return payload
	}
	var object map[string]any
	if err := common.Unmarshal(payload, &object); err != nil || object == nil {
		return []byte(hwSafetyNet(w.ctx, payload))
	}
	status := w.status
	if status < http.StatusBadRequest {
		status = http.StatusBadGateway
	}
	w.sanitizeObject(object, status)
	encoded, err := common.Marshal(object)
	if err != nil {
		return payload
	}
	return encoded
}

// streamErrorEvent converts a terminal JSON error envelope into the error event
// of the customer's protocol.
func (w *hwMaskWriter) streamErrorEvent(data []byte) []byte {
	var envelope map[string]any
	if err := common.Unmarshal(data, &envelope); err != nil {
		return data
	}
	message, code := hwErrorEnvelopeMessage(envelope)
	if message == "" {
		message = service.HwGenericErrorMessage(w.ctx, http.StatusBadGateway)
	}
	return w.streamErrorEventFor(message, code)
}

// streamErrorEventFor renders one message as the error event of the customer's
// protocol. It also closes a stream the filter itself could not finish.
func (w *hwMaskWriter) streamErrorEventFor(message, code string) []byte {
	message = hwSafetyNet(w.ctx, []byte(message))
	if w.anthropic {
		event := map[string]any{
			"type": "error",
			"error": map[string]any{
				"type":    "api_error",
				"message": message,
			},
		}
		encoded, err := common.Marshal(event)
		if err != nil {
			return []byte(message)
		}
		return []byte("event: error\ndata: " + string(encoded) + "\n\n")
	}
	event := map[string]any{
		"error": map[string]any{
			"message": message,
			"type":    "service_error",
			"code":    code,
		},
	}
	encoded, err := common.Marshal(event)
	if err != nil {
		return []byte(message)
	}
	return []byte("data: " + string(encoded) + "\n\ndata: [DONE]\n\n")
}

// sanitizeObject applies the structural rules to one JSON object: identity and
// model names become ours, supplier-specific keys disappear at any depth, error
// text becomes our own wording. Identities are recorded first so the admin log
// keeps the true upstream id even when the tree scan rewrites its text.
func (w *hwMaskWriter) sanitizeObject(object map[string]any, status int) {
	if hwFilterPanicHook != nil {
		hwFilterPanicHook()
	}
	if id, ok := object["id"].(string); ok && hwIsIdentityObject(object) && !hwIsOwnTaskObject(object, id) {
		prefix := hwIdentityPrefix(object)
		// Ids of the stored responses API carry no supplier text when the
		// upstream issues them plainly; rewriting those would break
		// previous_response_id and retrieval, so only supplier ids go.
		if prefix != "resp_hw-" || hwIsProviderIdentity(id) {
			w.recordUpstreamID(id)
			object["id"] = w.ownID(prefix)
		}
	}
	for _, nestedKey := range []string{"message", "response"} {
		if inner, ok := object[nestedKey].(map[string]any); ok {
			w.sanitizeNestedIdentity(inner, nestedKey == "response")
		}
	}
	w.sanitizeTree(object)
	if customerModel := w.customerModel(); customerModel != "" {
		if _, ok := object["model"].(string); ok {
			object["model"] = customerModel
		}
	}
	if errObject, ok := object["error"].(map[string]any); ok {
		w.sanitizeErrorObject(errObject, status)
	}
}

// sanitizeTree walks every nested object and array of a decoded payload:
// supplier-specific keys disappear at any depth and provider traces in string
// values are replaced, except in fields that hold model-authored text.
func (w *hwMaskWriter) sanitizeTree(node any) {
	switch typed := node.(type) {
	case map[string]any:
		for key, value := range typed {
			if hwDropJSONKey(key) {
				delete(typed, key)
				continue
			}
			if usage, ok := value.(map[string]any); ok && strings.EqualFold(strings.TrimSpace(key), "usage") {
				w.filterCustomerUsage(usage)
			}
			if text, ok := value.(string); ok {
				if !hwContentKeys[strings.ToLower(key)] && common.HwHasProviderTextTrace(text) {
					typed[key] = hwSafetyNet(w.ctx, []byte(text))
				}
				continue
			}
			w.sanitizeTree(value)
		}
	case []any:
		for _, item := range typed {
			w.sanitizeTree(item)
		}
	}
}

// sanitizeNestedIdentity rewrites the identity of a nested message/response
// object (Anthropic message_start, Responses API events) without touching ids
// that belong to content blocks or tool calls. Key dropping and value scanning
// already ran over the whole tree. keepPlainIds leaves a responses-API id
// untouched when it carries no supplier text, so it stays usable as
// previous_response_id and for retrieval.
func (w *hwMaskWriter) sanitizeNestedIdentity(inner map[string]any, keepPlainIds bool) {
	if customerModel := w.customerModel(); customerModel != "" {
		if _, ok := inner["model"].(string); ok {
			inner["model"] = customerModel
		}
	}
	id, ok := inner["id"].(string)
	if !ok || !hwIsIdentityObject(inner) {
		return
	}
	if keepPlainIds && !hwIsProviderIdentity(id) {
		return
	}
	w.recordUpstreamID(id)
	inner["id"] = w.ownID("msg_hw-")
}

// hwIsProviderIdentity reports whether a response id itself names the supplier:
// an emergency-supplier generation id ("gen-...") or any other supplier trace.
func hwIsProviderIdentity(id string) bool {
	return common.HwHasProviderTextTrace(id) || strings.HasPrefix(id, "gen-")
}

func (w *hwMaskWriter) sanitizeErrorObject(errObject map[string]any, status int) {
	for key := range errObject {
		if hwDropJSONKey(key) {
			delete(errObject, key)
		}
	}
	code := hwStringValue(errObject["code"])
	if code == "" {
		code = hwStringValue(errObject["type"])
	}
	if !service.HwIsOwnErrorCode(code) {
		if _, ok := errObject["message"]; ok {
			errObject["message"] = service.HwGenericErrorMessage(w.ctx, status)
			// A generic text always carries a code, so the admin log and the
			// customer can tell one masked failure class from another.
			if code == "" {
				errObject["code"] = "upstream_error"
			}
		}
	} else if message, ok := errObject["message"].(string); ok {
		errObject["message"] = hwSafetyNet(w.ctx, []byte(message))
	}
	for _, key := range []string{"type", "code"} {
		if text, ok := errObject[key].(string); ok && common.HwHasProviderTextTrace(text) {
			errObject[key] = common.HwReplaceProviderTextWords(text)
		}
	}
}

func (w *hwMaskWriter) customerModel() string {
	if w.ownModel != "" {
		return w.ownModel
	}
	w.ownModel = service.HwCustomerModel(w.ctx)
	return w.ownModel
}

func (w *hwMaskWriter) ownID(prefix string) string {
	if w.requestID == "" {
		w.requestID = common.NewRequestId()
	}
	return prefix + w.requestID
}

func (w *hwMaskWriter) recordUpstreamID(id string) {
	if id == "" || strings.HasPrefix(id, "hw-") || strings.HasPrefix(id, "msg_hw-") || strings.HasPrefix(id, "resp_hw-") {
		return
	}
	service.HwNoteUpstreamIdentity(w.ctx, id)
}

// hwIdentityPrefix picks the id prefix that matches the object being rewritten.
func hwIdentityPrefix(object map[string]any) string {
	if objectType := hwStringValue(object["type"]); strings.HasPrefix(objectType, "message") {
		return "msg_hw-"
	}
	if objectType := hwStringValue(object["object"]); objectType == "response" {
		return "resp_hw-"
	}
	return "hw-"
}

// hwIsIdentityObject reports whether an object carries the protocol identity we
// must rewrite, so ids of tool calls and content blocks stay untouched.
func hwIsIdentityObject(object map[string]any) bool {
	for _, key := range []string{"object", "created", "choices", "type", "role", "model", "usage"} {
		if _, ok := object[key]; ok {
			return true
		}
	}
	return false
}

func hwDropJSONKey(key string) bool {
	lower := strings.ToLower(strings.TrimSpace(key))
	switch lower {
	case "provider", "system_fingerprint", "native_finish_reason", "upstream_id", "upstream_model",
		"provider_name", "provider_slug", "generation_id", "is_byok", "cost_details":
		return true
	}
	// A key that names the supplier (openrouter_cost, lumia_cost_usd) goes,
	// whatever its position in the name.
	return common.HwHasProviderTextTrace(lower) || strings.HasPrefix(lower, "x_") || strings.HasPrefix(lower, "x-")
}

// hwResponseHeaderAllowed keeps headers our own middleware set and a small
// allowlist; everything that smells like a supplier or proxy is dropped. Own
// /api routes may additionally start a session or redirect: Set-Cookie and
// Location come from our handlers there, never from a supplier answer.
func hwResponseHeaderAllowed(name string, base map[string]bool, apiRoute bool) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	if common.HwHasProviderTrace(lower) || strings.HasPrefix(lower, "cf-") || lower == "server" || lower == "via" {
		return false
	}
	if apiRoute && (lower == "set-cookie" || lower == "location") {
		return true
	}
	if base[lower] {
		return true
	}
	if hwAllowedResponseHeaders[lower] {
		return true
	}
	return strings.HasPrefix(lower, "x-ratelimit-") || strings.HasPrefix(lower, "ratelimit-")
}

// hwSafetyNet is the last-resort scan of text that is about to reach the
// customer. It covers body text and header values, so it uses the text token
// set: the "x-or-" pattern stays reserved for header names. A hit is reported
// to the admin log without its content.
func hwSafetyNet(ctx *gin.Context, data []byte) string {
	text := string(data)
	if !hwProviderNetEnabled.Load() || !common.HwHasProviderTextTrace(text) {
		return text
	}
	service.HwNoteMaskAlert(ctx)
	return common.HwReplaceProviderTextWords(text)
}

// hwSplitStreamTerminal separates the end-of-stream marker of one SSE write from
// the data before it. The caller holds the marker so it can drop it when an
// error event follows; a marker split across two writes is held as its leading
// part and completed on the next write.
func hwSplitStreamTerminal(data []byte, anthropic bool) (body, terminal []byte) {
	if len(data) == 0 {
		return data, nil
	}
	if anthropic {
		// Anthropic closes a message with message_stop; an error event must be
		// the last event instead.
		if index := bytes.LastIndex(data, []byte("event: message_stop")); index >= 0 {
			return data[:index], data[index:]
		}
		return data, nil
	}
	marker := []byte("data: [DONE]")
	if index := bytes.LastIndex(data, marker); index >= 0 && len(bytes.TrimSpace(data[index+len(marker):])) == 0 {
		return data[:index], data[index:]
	}
	for length := len(marker) - 1; length > 0; length-- {
		if bytes.HasSuffix(data, marker[:length]) {
			index := len(data) - length
			return data[:index], data[index:]
		}
	}
	return data, nil
}

// hwStreamCarriesError reports whether an SSE write holds a protocol error
// event, so the end-of-stream marker before it is not sent as a clean finish.
func hwStreamCarriesError(data []byte) bool {
	if bytes.Contains(data, []byte("event: error")) {
		return true
	}
	for line := range bytes.SplitSeq(data, []byte{10}) {
		payload, found := bytes.CutPrefix(bytes.TrimSpace(line), []byte("data:"))
		if !found {
			continue
		}
		var object map[string]any
		if err := common.Unmarshal(payload, &object); err != nil {
			continue
		}
		if _, isError := object["error"]; isError {
			return true
		}
	}
	return false
}

// hwLooksLikeSSE reports whether a stream write already uses SSE syntax.
func hwLooksLikeSSE(data []byte) bool {
	trimmed := bytes.TrimLeft(data, " \t\r\n")
	if len(trimmed) == 0 {
		return true
	}
	switch trimmed[0] {
	case ':':
		return true
	case 'd':
		return bytes.HasPrefix(trimmed, []byte("data:"))
	case 'e':
		return bytes.HasPrefix(trimmed, []byte("event:"))
	case 'i':
		return bytes.HasPrefix(trimmed, []byte("id:"))
	case 'r':
		return bytes.HasPrefix(trimmed, []byte("retry:"))
	}
	return false
}

// hwErrorEnvelopeMessage reads the code and message of a JSON error envelope.
// Only our own error text is reused; upstream wording never is.
func hwErrorEnvelopeMessage(envelope map[string]any) (string, string) {
	errObject, ok := envelope["error"].(map[string]any)
	if !ok {
		return "", ""
	}
	code := hwStringValue(errObject["code"])
	if !service.HwIsOwnErrorCode(code) {
		return "", code
	}
	return hwStringValue(errObject["message"]), code
}

func hwStringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		if typed == float64(int64(typed)) {
			return strconv.FormatInt(int64(typed), 10)
		}
	}
	return ""
}

// hwJSONValueStart returns the offset of the first '{' or '[' in data, or -1.
func hwJSONValueStart(data []byte) int {
	for index, char := range data {
		if char == '{' || char == '[' {
			return index
		}
	}
	return -1
}

// hwJSONValueEnd returns the offset just past the JSON value starting at data[0]
// and whether the value is complete.
func hwJSONValueEnd(data []byte) (int, bool) {
	if len(data) == 0 {
		return 0, false
	}
	depth := 0
	inString := false
	escaped := false
	for index := 0; index < len(data); index++ {
		char := data[index]
		if escaped {
			escaped = false
			continue
		}
		if inString {
			switch char {
			case '\\':
				escaped = true
			case '"':
				inString = false
			}
			continue
		}
		switch char {
		case '"':
			inString = true
		case '{', '[':
			depth++
		case '}', ']':
			depth--
			if depth == 0 {
				return index + 1, true
			}
		}
	}
	return 0, false
}

// hwIsOwnTaskObject reports whether an object is one of our own asynchronous
// task records. Their ids are issued by this gateway and are the handle the
// customer polls with, so rewriting them would break retrieval.
func hwIsOwnTaskObject(object map[string]any, id string) bool {
	if hwStringValue(object["object"]) == "video" {
		return true
	}
	return strings.HasPrefix(id, "task_") && !hwIsProviderIdentity(id)
}
