package relay

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func newResp(contentType, body string) *http.Response {
	h := http.Header{}
	if contentType != "" {
		h.Set("Content-Type", contentType)
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     h,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

const codexSSEBody = "event: response.created\n" +
	`data: {"type":"response.created","response":{"id":"resp_1"}}` + "\n\n"

func TestResponsesUpstreamIsStream(t *testing.T) {
	cases := []struct {
		name        string
		contentType string
		body        string
		want        bool
	}{
		{"标准 SSE 响应头", "text/event-stream", codexSSEBody, true},
		{"SSE 响应头带 charset", "text/event-stream; charset=utf-8", codexSSEBody, true},
		// Codex 的 backend-api/codex/responses 返回 SSE 却不带 Content-Type，
		// 这是线上 500 "invalid character 'e'" 的直接成因。
		{"无 Content-Type 但体是 SSE(event: 开头)", "", codexSSEBody, true},
		{"无 Content-Type 但体是 SSE(data: 开头)", "", "data: {\"type\":\"x\"}\n\n", true},
		{"无 Content-Type 且体是 JSON", "", `{"id":"resp_1","object":"response"}`, false},
		{"JSON 响应头", "application/json", `{"id":"resp_1"}`, false},
		{"空响应体", "", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := newResp(tc.contentType, tc.body)
			if got := responsesUpstreamIsStream(resp); got != tc.want {
				t.Fatalf("responsesUpstreamIsStream() = %v, want %v", got, tc.want)
			}
		})
	}
}

// 嗅探不能吃掉响应体，否则后续 handler 会丢事件。
func TestResponsesUpstreamIsStreamPreservesBody(t *testing.T) {
	resp := newResp("", codexSSEBody)

	if !responsesUpstreamIsStream(resp) {
		t.Fatal("应判定为 SSE")
	}

	got, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("读取响应体失败: %v", err)
	}
	if string(got) != codexSSEBody {
		t.Fatalf("响应体被嗅探消耗了\n got: %q\nwant: %q", string(got), codexSSEBody)
	}
}

// 嗅探替换 Body 后，原始 Closer 仍须被调用，避免连接泄漏。
func TestResponsesUpstreamIsStreamClosesOriginalBody(t *testing.T) {
	closed := false
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body: struct {
			io.Reader
			io.Closer
		}{
			Reader: strings.NewReader(codexSSEBody),
			Closer: closerFunc(func() error { closed = true; return nil }),
		},
	}

	responsesUpstreamIsStream(resp)
	if err := resp.Body.Close(); err != nil {
		t.Fatalf("关闭失败: %v", err)
	}
	if !closed {
		t.Fatal("原始 Body 的 Close 未被调用")
	}
}

type closerFunc func() error

func (f closerFunc) Close() error { return f() }
