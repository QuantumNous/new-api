package ollama

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOllamaChatHandlerNonStreamToolCalls(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name   string
		raw    string
		wantID string
	}{
		{
			name:   "compact json per-line parse path",
			raw:    `{"model":"llama3.1","created_at":"2026-05-27T12:00:00Z","message":{"role":"assistant","content":"","tool_calls":[{"id":"call_upstream","function":{"name":"get_weather","arguments":{"city":"Paris","days":0}}}]},"done":true,"done_reason":"stop","prompt_eval_count":5,"eval_count":7}`,
			wantID: "call_upstream",
		},
		{
			name: "pretty json fallback parse path",
			raw: `{
  "model": "llama3.1",
  "created_at": "2026-05-27T12:00:00Z",
  "message": {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "function": {
          "name": "get_weather",
          "arguments": {
            "city": "Paris",
            "days": 0
          }
        }
      }
    ]
  },
  "done": true,
  "done_reason": "stop",
  "prompt_eval_count": 5,
  "eval_count": 7
}`,
			wantID: "call_0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			resp := &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(tt.raw)),
			}

			usage, apiErr := ollamaChatHandler(c, &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "fallback-model"},
			}, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			assert.Equal(t, 12, usage.TotalTokens)

			var out dto.OpenAITextResponse
			require.NoError(t, common.Unmarshal(w.Body.Bytes(), &out))
			require.Len(t, out.Choices, 1)
			assert.Equal(t, constant.FinishReasonToolCalls, out.Choices[0].FinishReason)

			var toolCalls []dto.ToolCallResponse
			require.NoError(t, common.Unmarshal(out.Choices[0].Message.ToolCalls, &toolCalls))
			require.Len(t, toolCalls, 1)
			assert.Equal(t, tt.wantID, toolCalls[0].ID)
			assert.Equal(t, "function", toolCalls[0].Type)
			assert.Equal(t, "get_weather", toolCalls[0].Function.Name)
			assert.Nil(t, toolCalls[0].Index)

			var args map[string]any
			require.NoError(t, common.Unmarshal([]byte(toolCalls[0].Function.Arguments), &args))
			assert.Equal(t, "Paris", args["city"])
			assert.Equal(t, float64(0), args["days"])
		})
	}
}

func TestOllamaStreamHandlerCompletesThinkingAndContent(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	raw := strings.Join([]string{
		`{"model":"qwen3","created_at":"2026-08-14T12:00:00Z","message":{"role":"assistant","content":"","thinking":"plan"},"done":false}`,
		`{"model":"qwen3","created_at":"2026-08-14T12:00:01Z","message":{"role":"assistant","content":"hello"},"done":false}`,
		`{"model":"qwen3","created_at":"2026-08-14T12:00:02Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","prompt_eval_count":3,"eval_count":2}`,
	}, "\n")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	usage, apiErr := ollamaStreamHandler(c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "qwen3"},
	}, &http.Response{Body: io.NopCloser(strings.NewReader(raw))})
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 5, usage.TotalTokens)

	body := recorder.Body.String()
	assert.Contains(t, body, "plan")
	assert.Contains(t, body, "hello")
	assert.Contains(t, body, "[DONE]")
}

// TestOllamaStreamHandlerClientCancelClosesUpstream pins the playground-stop
// contract for Ollama NDJSON streams: aborting the client request (Playground
// stop) must close the upstream body so Ollama stops generating, and the
// handler must return without waiting for more tokens.
func TestOllamaStreamHandlerClientCancelClosesUpstream(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pr, pw := io.Pipe()
	t.Cleanup(func() {
		_ = pr.Close()
		_ = pw.Close()
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(ctx)
	firstHandled := make(chan struct{})
	c.Writer = &notifyAfterWriter{ResponseWriter: c.Writer, needle: "halfway", notify: firstHandled}

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "qwen3"},
	}

	done := make(chan struct{})
	go func() {
		_, _ = ollamaStreamHandler(c, info, resp)
		close(done)
	}()

	first := `{"model":"qwen3","created_at":"2026-08-14T12:00:00Z","message":{"role":"assistant","content":"","thinking":"halfway"},"done":false}` + "\n"
	_, err := fmt.Fprint(pw, first)
	require.NoError(t, err)

	select {
	case <-firstHandled:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for first thinking chunk")
	}

	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("handler did not return after client disconnect")
	}

	_, err = fmt.Fprint(pw, `{"model":"qwen3","message":{"role":"assistant","content":"more"},"done":false}`+"\n")
	require.ErrorIs(t, err, io.ErrClosedPipe, "upstream body should be closed after client disconnect")

	body := recorder.Body.String()
	assert.Contains(t, body, "halfway")
	assert.NotContains(t, body, `"more"`)
}

// notifyAfterWriter signals once the streamed payload containing needle has
// been written, so the test can cancel after the first thinking chunk.
type notifyAfterWriter struct {
	gin.ResponseWriter
	needle string
	notify chan struct{}
	once   sync.Once
}

func (w *notifyAfterWriter) Write(p []byte) (int, error) {
	n, err := w.ResponseWriter.Write(p)
	if strings.Contains(string(p), w.needle) {
		w.once.Do(func() { close(w.notify) })
	}
	return n, err
}

func (w *notifyAfterWriter) WriteString(s string) (int, error) {
	n, err := io.WriteString(w.ResponseWriter, s)
	if strings.Contains(s, w.needle) {
		w.once.Do(func() { close(w.notify) })
	}
	return n, err
}
