package blockrun

import (
	"bytes"
	"io"
	"net/http"
	"regexp"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// captureUpstreamID extracts BlockRun's per-call id — the upstream response
// body's TOP-LEVEL "id" (chatcmpl-* for OpenAI, msg-* for Anthropic) — and
// stashes it in the gin context under common.UpstreamRequestIdKey so
// RecordConsumeLog persists it as logs.upstream_request_id for per-call
// reconciliation/溯源.
//
// Extraction is STRUCTURE-AWARE and dispatches by stream-ness, because a naive
// "first \"id\" in the bytes" is wrong for a non-stream OpenAI body: there
// `choices` precedes the top-level id, and a tool-calling choice carries
// `tool_calls[].id` (call_*), which would be matched first.
//
//   - non-stream: buffer the (bounded) body and json-unmarshal the top-level
//     id, so field order and nested ids never matter;
//   - stream: wrap the body with a byte-transparent sniffer that takes the
//     FIRST "id" — correct for SSE, where each OpenAI chunk leads with its
//     chatcmpl id and each Anthropic stream leads with message.id ahead of any
//     content-block id, and where the body must never be buffered whole.
//
// It is a no-op (and never disturbs the body) when c/resp/body is nil, or when
// info is nil (stream-ness unknown — better to skip than risk buffering a stream).
func captureUpstreamID(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) {
	if c == nil || resp == nil || resp.Body == nil || info == nil {
		return
	}
	if info.IsStream {
		resp.Body = newStreamIDSniffer(c, resp.Body)
		return
	}
	captureNonStreamID(c, resp)
}

// captureNonStreamID buffers a complete (non-stream) response body, unmarshals
// its top-level id, and replaces resp.Body with a replay reader that yields the
// exact same bytes (and preserves any read error) for the delegated handler.
func captureNonStreamID(c *gin.Context, resp *http.Response) {
	body, readErr := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if len(body) > 0 {
		var probe struct {
			ID string `json:"id"`
		}
		if common.Unmarshal(body, &probe) == nil && probe.ID != "" {
			c.Set(common.UpstreamRequestIdKey, probe.ID)
		}
	}
	resp.Body = &replayCloser{r: bytes.NewReader(body), err: readErr}
}

// replayCloser re-serves a buffered body and surfaces the original read error
// (if any) after the bytes are drained, so error semantics are not swallowed.
type replayCloser struct {
	r   *bytes.Reader
	err error
}

func (b *replayCloser) Read(p []byte) (int, error) {
	n, e := b.r.Read(p)
	if e == io.EOF && b.err != nil {
		return n, b.err
	}
	return n, e
}

func (b *replayCloser) Close() error { return nil }

// idPattern matches a JSON `"id": "value"` field. The closing quote is required,
// so a value split across Read calls simply waits for more bytes (no truncation).
var idPattern = regexp.MustCompile(`"id"\s*:\s*"([^"]*)"`)

// idSnifferCap bounds how many bytes the stream sniffer accumulates while looking
// for the id before giving up, so a malformed/id-less stream can never grow the
// scan buffer without limit. The id always appears in the first chunk in practice.
const idSnifferCap = 64 << 10

// streamIDSniffer wraps a streaming response body and scans the passthrough
// bytes for the FIRST "id", stashing it in the gin context. It is byte-transparent
// (every byte read is returned unchanged) and never buffers the whole body, so SSE
// stays unbuffered; scanning stops as soon as the id is found (first chunk).
type streamIDSniffer struct {
	c    *gin.Context
	r    io.ReadCloser
	buf  []byte
	done bool
}

// newStreamIDSniffer wraps r. If c or r is nil it returns r untouched.
func newStreamIDSniffer(c *gin.Context, r io.ReadCloser) io.ReadCloser {
	if c == nil || r == nil {
		return r
	}
	return &streamIDSniffer{c: c, r: r}
}

func (s *streamIDSniffer) Read(p []byte) (int, error) {
	n, err := s.r.Read(p)
	if n > 0 && !s.done {
		s.buf = append(s.buf, p[:n]...)
		if m := idPattern.FindSubmatch(s.buf); m != nil {
			s.c.Set(common.UpstreamRequestIdKey, string(m[1]))
			s.done = true
			s.buf = nil
		} else if len(s.buf) >= idSnifferCap {
			s.done = true
			s.buf = nil
		}
	}
	return n, err
}

func (s *streamIDSniffer) Close() error { return s.r.Close() }
