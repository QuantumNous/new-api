package openai

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Upstreams for /v1/responses do not send a "data: [DONE]" sentinel; the stream
// simply idles after "response.completed" until the upstream closes the socket.
// The handler must therefore mark completion itself, otherwise the end reason is
// decided by a race between upstream EOF and the client closing its connection
// right after the final event, which mislabels finished streams as client_gone
// (issue #6649).
func TestOaiResponsesStreamHandlerMarksDoneOnCompleted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	if constant.StreamingTimeout == 0 {
		constant.StreamingTimeout = 30
	}

	pr, pw := io.Pipe()
	t.Cleanup(func() {
		_ = pr.Close()
		_ = pw.Close()
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
		assert.Nil(t, apiErr)
		if assert.NotNil(t, usage) {
			assert.Equal(t, 5, usage.PromptTokens)
			assert.Equal(t, 7, usage.CompletionTokens)
		}
	}()

	_, err := fmt.Fprint(pw, "data: {\"type\":\"response.output_text.delta\",\"delta\":\"hi\"}\n")
	require.NoError(t, err)
	_, err = fmt.Fprint(pw, "data: {\"type\":\"response.completed\",\"response\":{\"usage\":{\"input_tokens\":5,\"output_tokens\":7,\"total_tokens\":12}}}\n")
	require.NoError(t, err)

	// Keep the pipe open: the handler must finish on the terminal event alone,
	// without waiting for upstream EOF.
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("handler did not return after response.completed (still waiting for upstream EOF)")
	}

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)

	body := recorder.Body.String()
	assert.Contains(t, body, "response.completed", "terminal event must still be forwarded to the client")
}
