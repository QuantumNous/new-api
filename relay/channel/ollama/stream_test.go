package ollama

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func TestOllamaChatHandlerNonStreamToolCalls(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	raw := `{"model":"llama3.1","created_at":"2026-05-27T12:00:00Z","message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"get_weather","arguments":{"city":"Paris","days":0}}}]},"done":true,"done_reason":"stop","prompt_eval_count":5,"eval_count":7}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(raw)),
	}

	usage, apiErr := ollamaChatHandler(c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "fallback-model"},
	}, resp)
	if apiErr != nil {
		t.Fatalf("ollamaChatHandler returned error: %v", apiErr)
	}
	if usage.TotalTokens != 12 {
		t.Fatalf("unexpected usage total: got %d", usage.TotalTokens)
	}

	var out dto.OpenAITextResponse
	if err := common.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(out.Choices) != 1 {
		t.Fatalf("expected one choice, got %d", len(out.Choices))
	}
	if out.Choices[0].FinishReason != constant.FinishReasonToolCalls {
		t.Fatalf("expected finish_reason %q, got %q", constant.FinishReasonToolCalls, out.Choices[0].FinishReason)
	}

	var toolCalls []dto.ToolCallResponse
	if err := common.Unmarshal(out.Choices[0].Message.ToolCalls, &toolCalls); err != nil {
		t.Fatalf("failed to decode tool calls: %v", err)
	}
	if len(toolCalls) != 1 {
		t.Fatalf("expected one tool call, got %d", len(toolCalls))
	}
	if toolCalls[0].ID == "" || toolCalls[0].Type != "function" || toolCalls[0].Function.Name != "get_weather" {
		t.Fatalf("unexpected tool call: %+v", toolCalls[0])
	}
	if toolCalls[0].Index != nil {
		t.Fatalf("non-stream tool call should not include index: %+v", toolCalls[0].Index)
	}

	var args map[string]any
	if err := common.Unmarshal([]byte(toolCalls[0].Function.Arguments), &args); err != nil {
		t.Fatalf("failed to decode tool call arguments: %v", err)
	}
	if args["city"] != "Paris" || args["days"] != float64(0) {
		t.Fatalf("unexpected tool call arguments: %+v", args)
	}
}
