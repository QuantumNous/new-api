// Package relaydump captures relay traffic between the gateway and upstream
// providers: request headers/body, response headers/body and WebSocket
// handshakes. Captures are written as one JSON file per request under the
// configured directory, or printed to the server log, and are meant for
// troubleshooting only — captured bodies may contain user conversation
// content and must be treated as sensitive.
package relaydump

import (
	"bytes"
	"encoding/base64"
	"io"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const redactedValue = "<redacted>"

// defaultRedactedHeaders lists built-in credential-carrying headers. Values
// of these headers are replaced before any capture is written or logged.
var defaultRedactedHeaders = []string{
	"Authorization",
	"Proxy-Authorization",
	"X-Api-Key",
	"Api-Key",
	"X-Goog-Api-Key",
	"Cookie",
	"Sec-WebSocket-Protocol",
}

// Meta describes the relay request being captured. It is filled from relay
// context and stored in every dump file.
type Meta struct {
	RequestID   string `json:"request_id"`
	CreatedAt   int64  `json:"created_at"` // unix milli
	DurationMS  int64  `json:"duration_ms,omitempty"`
	ChannelID   int    `json:"channel_id,omitempty"`
	ChannelName string `json:"channel_name,omitempty"`
	Model       string `json:"model,omitempty"`
	IsStream    bool   `json:"is_stream,omitempty"`
	RequestPath string `json:"request_path,omitempty"`
}

// DumpFile is the on-disk document for one captured relay exchange.
type DumpFile struct {
	Meta
	Request  *DumpSide `json:"request,omitempty"`
	Response *DumpSide `json:"response,omitempty"`
	Error    string    `json:"error,omitempty"`
}

// DumpSide describes one direction of the exchange. The request side carries
// Method/URL, the response side carries StatusCode.
type DumpSide struct {
	Method        string              `json:"method,omitempty"`
	URL           string              `json:"url,omitempty"`
	StatusCode    int                 `json:"status_code,omitempty"`
	Headers       map[string][]string `json:"headers,omitempty"`
	Body          string              `json:"body,omitempty"`
	BodyTruncated bool                `json:"body_truncated,omitempty"`
	BodyBase64    bool                `json:"body_base64,omitempty"`
	BodyMissing   bool                `json:"body_missing,omitempty"`
}

type outputs struct {
	file bool
	log  bool
}

// Capture holds the in-memory snapshot of one relay exchange between
// BeginCapture and the finishing call. It buffers at most MaxBodyKB bytes per
// body so memory stays bounded.
type Capture struct {
	meta      Meta
	request   *DumpSide
	response  *DumpSide
	bodyBuf   *boundedBuffer
	errorText string

	enabled  bool
	keep     bool
	keepSet  bool
	finished bool

	outputs  outputs
	maxBody  int64
	redacted map[string]struct{}
}

// BeginCapture snapshots the outgoing request. It returns nil immediately
// when dumping is disabled, so the caller keeps a single code path.
func BeginCapture(req *http.Request, meta Meta) *Capture {
	setting := operation_setting.GetRelayDumpSetting()
	if setting == nil || !setting.Enabled || meta.RequestID == "" {
		return nil
	}
	c := &Capture{
		meta:     meta,
		enabled:  true,
		outputs:  outputs{file: setting.WriteToFile(), log: setting.WriteToLog()},
		maxBody:  setting.MaxBodyBytes(),
		redacted: buildRedactedHeaders(setting),
	}
	c.meta.CreatedAt = time.Now().UnixMilli()
	c.request = captureRequestSide(req, c.redacted, c.maxBody)
	return c
}

// ShouldKeep reports whether the observed status code qualifies for a dump
// under the configured mode: "all" keeps everything, "error" keeps only
// statuses >= 400. The first verdict wins, so call it right after the
// upstream response arrives. The capture is discarded when it does not keep.
func (c *Capture) ShouldKeep(statusCode int) bool {
	if c == nil || !c.enabled || c.keepSet {
		return c.keep
	}
	c.keepSet = true
	if operation_setting.GetRelayDumpSetting().DumpAll() {
		c.keep = true
	} else {
		c.keep = statusCode >= http.StatusBadRequest
	}
	if !c.keep {
		c.Discard()
	}
	return c.keep
}

// ObserveResponse records the upstream response status and headers. The
// response body must be captured through WrapBody.
func (c *Capture) ObserveResponse(statusCode int, header http.Header) {
	if c == nil || !c.enabled {
		return
	}
	if c.response == nil {
		c.response = &DumpSide{}
	}
	c.response.StatusCode = statusCode
	if header != nil {
		c.response.Headers = redactHeader(header, c.redacted)
	}
}

// WrapBody returns a reader that mirrors the response body into the capture
// while keeping the original Close semantics. The dump is queued for writing
// when the body is fully read or closed, whichever comes first.
func (c *Capture) WrapBody(body io.ReadCloser) io.ReadCloser {
	if c == nil || !c.enabled || body == nil {
		return body
	}
	if c.response == nil {
		c.response = &DumpSide{}
	}
	if c.bodyBuf == nil {
		c.bodyBuf = newBoundedBuffer(c.maxBody)
	}
	return &captureBody{capture: c, rc: body}
}

// FinishWithoutBody completes the capture for exchanges that have no
// capturable response body (WebSocket handshake).
func (c *Capture) FinishWithoutBody() {
	if c == nil || !c.enabled {
		return
	}
	c.finish()
}

// FinishFailure completes the capture for a failed exchange (transport error
// or upstream rejection) without a response body.
func (c *Capture) FinishFailure(statusCode int, header http.Header, errText string) {
	if c == nil || !c.enabled {
		return
	}
	if c.response == nil {
		c.response = &DumpSide{}
	}
	if statusCode != 0 {
		c.response.StatusCode = statusCode
	}
	if header != nil {
		c.response.Headers = redactHeader(header, c.redacted)
	}
	c.errorText = errText
	c.finish()
}

// Discard drops the buffered capture without writing anything.
func (c *Capture) Discard() {
	if c == nil {
		return
	}
	c.enabled = false
	c.request = nil
	c.response = nil
	c.bodyBuf = nil
}

func (c *Capture) finish() {
	if c == nil || c.finished {
		return
	}
	c.finished = true
	c.enabled = false
	c.meta.DurationMS = time.Since(time.UnixMilli(c.meta.CreatedAt)).Milliseconds()
	if c.bodyBuf != nil && c.response != nil {
		c.response.Body = c.bodyBuf.text()
		c.response.BodyTruncated = c.bodyBuf.truncated
		c.response.BodyBase64 = c.bodyBuf.binary
	}
	dump := &DumpFile{
		Meta:     c.meta,
		Request:  c.request,
		Response: c.response,
		Error:    c.errorText,
	}
	if c.outputs.log {
		writeDumpLog(dump)
	}
	if c.outputs.file {
		enqueueWrite(dump)
	}
}

// captureBody mirrors a response body into the capture buffer.
type captureBody struct {
	capture *Capture
	rc      io.ReadCloser
}

func (b *captureBody) Read(p []byte) (int, error) {
	n, err := b.rc.Read(p)
	if n > 0 {
		b.capture.bodyBuf.write(p[:n])
	}
	if err == io.EOF {
		b.capture.finish()
	}
	return n, err
}

func (b *captureBody) Close() error {
	err := b.rc.Close()
	b.capture.finish()
	return err
}

// CaptureWebSocketHandshake dumps a realtime/Responses WebSocket handshake.
// Message-level traffic is intentionally not captured. A successful handshake
// is only captured in "all" mode; failures are always captured.
func CaptureWebSocketHandshake(meta Meta, url string, header http.Header, statusCode int, errText string) {
	setting := operation_setting.GetRelayDumpSetting()
	if setting == nil || !setting.Enabled || meta.RequestID == "" {
		return
	}
	failed := errText != "" || statusCode >= http.StatusBadRequest
	if !setting.DumpAll() && !failed {
		return
	}
	c := &Capture{
		enabled:  true,
		outputs:  outputs{file: setting.WriteToFile(), log: setting.WriteToLog()},
		redacted: buildRedactedHeaders(setting),
		meta:     meta,
		request:  captureWebSocketSide(url, header, buildRedactedHeaders(setting)),
		response: &DumpSide{StatusCode: statusCode},
	}
	c.errorText = errText
	c.finish()
}

func captureWebSocketSide(url string, header http.Header, redacted map[string]struct{}) *DumpSide {
	side := &DumpSide{
		Method:  http.MethodGet,
		URL:     url,
		Headers: map[string][]string{},
	}
	if header != nil {
		side.Headers = redactHeader(header, redacted)
	}
	return side
}

// boundedBuffer accumulates a body up to max bytes and reports truncation.
type boundedBuffer struct {
	buf       bytes.Buffer
	max       int64
	truncated bool
	binary    bool
}

func newBoundedBuffer(max int64) *boundedBuffer {
	return &boundedBuffer{max: max}
}

func (b *boundedBuffer) write(p []byte) {
	if b.truncated {
		return
	}
	free := b.max - int64(b.buf.Len())
	if free <= 0 {
		b.truncated = true
		return
	}
	if int64(len(p)) > free {
		b.buf.Write(p[:free])
		b.truncated = true
		return
	}
	b.buf.Write(p)
}

// text returns the buffered body as JSON-friendly text. Non-UTF-8 bodies are
// base64 encoded and flagged through BodyBase64.
func (b *boundedBuffer) text() string {
	data := b.buf.Bytes()
	if len(data) == 0 {
		return ""
	}
	if utf8.Valid(data) {
		return string(data)
	}
	b.binary = true
	return base64.StdEncoding.EncodeToString(data)
}
