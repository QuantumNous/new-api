package blockrun

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func newSnifferCtx() *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	return c
}

func mkResp(body string) *http.Response {
	return &http.Response{Body: io.NopCloser(strings.NewReader(body))}
}

// TestCaptureUpstreamID_NonStream covers the json-unmarshal path. The headline
// case is the tool-calling OpenAI body: choices (with tool_calls[].id=call_*)
// precede the top-level id, so a first-match scan would capture the WRONG id.
func TestCaptureUpstreamID_NonStream(t *testing.T) {
	cases := []struct {
		name string
		body string
		want string
	}{
		{
			name: "openai tool_calls — top-level id wins over call_* (the bug #1 regression)",
			body: `{"choices":[{"index":0,"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_SHOULD_NOT_WIN","type":"function","function":{"name":"x","arguments":"{}"}}]}}],"created":1781576552,"id":"chatcmpl-REAL","model":"gpt-5.4-nano","object":"chat.completion"}`,
			want: "chatcmpl-REAL",
		},
		{
			name: "openai plain chat.completion (id after choices)",
			body: `{"choices":[{"finish_reason":"length","index":0,"message":{"content":"Hi","role":"assistant"}}],"created":1781576552,"id":"chatcmpl-DrDjcU","model":"gpt-5.4-nano","object":"chat.completion"}`,
			want: "chatcmpl-DrDjcU",
		},
		{
			name: "anthropic message",
			body: `{"model":"claude-haiku-4-5","id":"msg_015Hcka9","type":"message","role":"assistant","content":[{"type":"text","text":"Hi"}]}`,
			want: "msg_015Hcka9",
		},
		{
			name: "no id leaves key empty",
			body: `{"object":"chat.completion","choices":[]}`,
			want: "",
		},
		{
			name: "invalid json leaves key empty",
			body: `not-json`,
			want: "",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := newSnifferCtx()
			resp := mkResp(tc.body)
			info := &relaycommon.RelayInfo{IsStream: false}
			captureUpstreamID(c, resp, info)
			// The delegate must still see the exact original bytes.
			got, _ := io.ReadAll(resp.Body)
			if string(got) != tc.body {
				t.Fatalf("body passthrough mismatch:\n got %q\nwant %q", got, tc.body)
			}
			if id := c.GetString(common.UpstreamRequestIdKey); id != tc.want {
				t.Fatalf("UpstreamRequestId = %q, want %q", id, tc.want)
			}
		})
	}
}

// TestCaptureUpstreamID_Stream covers the first-id sniffer path used for SSE.
func TestCaptureUpstreamID_Stream(t *testing.T) {
	cases := []struct {
		name string
		body string
		want string
	}{
		{
			name: "openai stream first chunk",
			body: `data: {"id":"chatcmpl-stream123","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hi"}}]}` + "\n\n",
			want: "chatcmpl-stream123",
		},
		{
			name: "anthropic stream message_start (id nested under message, first id wins)",
			body: "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_stream456\",\"type\":\"message\"}}\n\n",
			want: "msg_stream456",
		},
		{
			name: "request_id must not false-match id",
			body: `data: {"request_id":"req_no","id":"chatcmpl-real","object":"chat.completion.chunk"}` + "\n",
			want: "chatcmpl-real",
		},
		{
			name: "id split across reads",
			body: `data: {"id":"chatcmpl-split-across-chunks-xyz","object":"chat.completion.chunk"}` + "\n",
			want: "chatcmpl-split-across-chunks-xyz",
		},
		{
			name: "no id leaves key empty",
			body: `data: {"object":"chat.completion.chunk","choices":[]}` + "\n",
			want: "",
		},
	}
	for _, chunk := range []int{1, 3, 7, 4096} {
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				c := newSnifferCtx()
				resp := mkResp(tc.body)
				info := &relaycommon.RelayInfo{IsStream: true}
				captureUpstreamID(c, resp, info)
				// Drain through a fixed-size buffer to exercise cross-Read accumulation,
				// and verify byte-transparency at the same time.
				var out []byte
				buf := make([]byte, chunk)
				for {
					n, err := resp.Body.Read(buf)
					out = append(out, buf[:n]...)
					if err == io.EOF {
						break
					}
					if err != nil {
						t.Fatalf("read: %v", err)
					}
				}
				if string(out) != tc.body {
					t.Fatalf("stream passthrough mismatch (chunk=%d):\n got %q\nwant %q", chunk, out, tc.body)
				}
				if id := c.GetString(common.UpstreamRequestIdKey); id != tc.want {
					t.Fatalf("chunk=%d UpstreamRequestId = %q, want %q", chunk, id, tc.want)
				}
			})
		}
	}
}

// TestCaptureNonStreamID_PreservesReadError ensures a mid-body read error is not
// swallowed: the delegate must still observe it after the buffered bytes.
func TestCaptureNonStreamID_PreservesReadError(t *testing.T) {
	wantErr := errors.New("boom")
	c := newSnifferCtx()
	resp := &http.Response{Body: io.NopCloser(&errAfterReader{data: []byte(`{"id":"msg_x"}`), err: wantErr})}
	captureUpstreamID(c, resp, &relaycommon.RelayInfo{IsStream: false})
	_, err := io.ReadAll(resp.Body)
	if !errors.Is(err, wantErr) {
		t.Fatalf("read error not preserved: got %v, want %v", err, wantErr)
	}
}

// errAfterReader yields data once, then the error (mimics a body that fails mid-read).
type errAfterReader struct {
	data []byte
	err  error
	done bool
}

func (r *errAfterReader) Read(p []byte) (int, error) {
	if !r.done {
		r.done = true
		n := copy(p, r.data)
		return n, nil
	}
	return 0, r.err
}

// TestCaptureUpstreamID_NilSafe verifies nil inputs never disturb the body.
func TestCaptureUpstreamID_NilSafe(t *testing.T) {
	// nil info => skip (must not buffer/replace body).
	resp := mkResp(`{"id":"msg_x"}`)
	orig := resp.Body
	captureUpstreamID(newSnifferCtx(), resp, nil)
	if resp.Body != orig {
		t.Fatal("nil info must leave resp.Body untouched")
	}
	// nil resp / nil ctx must not panic.
	captureUpstreamID(nil, mkResp("x"), &relaycommon.RelayInfo{})
	captureUpstreamID(newSnifferCtx(), nil, &relaycommon.RelayInfo{})
}
