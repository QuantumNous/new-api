package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOaiResponsesCompactionHandlerWrapsEventStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
	ctx.Request.Header.Set("Accept", "text/event-stream")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body: io.NopCloser(strings.NewReader(`{
			"id": "resp_compact_test",
			"object": "response.compaction",
			"created_at": 123,
			"output": [{
				"id": "msg_compact_test",
				"type": "message",
				"status": "completed",
				"role": "assistant",
				"content": [{
					"type": "output_text",
					"text": "compact summary"
				}]
			}],
			"usage": {
				"input_tokens": 2,
				"output_tokens": 3,
				"total_tokens": 5,
				"input_tokens_details": {
					"cached_tokens": 1
				}
			}
		}`)),
	}
	resp.Header.Set("Content-Type", "application/json")

	usage, newAPIError := OaiResponsesCompactionHandler(ctx, resp)

	require.Nil(t, newAPIError)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 3, usage.CompletionTokens)
	require.Equal(t, 5, usage.TotalTokens)
	require.Equal(t, 1, usage.PromptTokensDetails.CachedTokens)
	require.Contains(t, recorder.Header().Get("Content-Type"), "text/event-stream")
	require.Empty(t, recorder.Header().Get("Content-Length"))

	body := recorder.Body.String()
	require.Contains(t, body, "event: response.output_item.done")
	require.Contains(t, body, "event: response.completed")
	require.Contains(t, body, `"type":"response.output_item.done"`)
	require.Contains(t, body, `"type":"response.completed"`)
	require.Contains(t, body, `"text":"compact summary"`)
	require.Contains(t, body, `"object":"response.compaction"`)
	require.Contains(t, body, `"id":"resp_compact_test"`)
	require.Less(t, strings.Index(body, "response.output_item.done"), strings.Index(body, "response.completed"))
}
