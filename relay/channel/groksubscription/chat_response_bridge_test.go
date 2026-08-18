package groksubscription

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

// grokResponsesSSE 是一段最小但完整的 Responses SSE：created → 文本增量 → completed（带 usage 与完整 output）。
const grokResponsesSSE = "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\",\"model\":\"grok-4\"}}\n\n" +
	"data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hello\"}\n\n" +
	"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"model\":\"grok-4\",\"status\":\"completed\",\"usage\":{\"input_tokens\":5,\"output_tokens\":1,\"total_tokens\":6},\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"Hello\"}]}]}}\n\n"

func newSSEResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

// TestRelayChatOverGrok_NonStreamAggregatesToJSON 锁住 C1 修复：客户端 stream=false
// 时，即便上游是 SSE，也必须聚合成单个 chat.completion JSON，绝不能回 SSE / [DONE]。
func TestRelayChatOverGrok_NonStreamAggregatesToJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "grok-4"},
		UserWantsStream: false,
	}
	usageAny, apiErr := RelayChatOverGrok(c, info, newSSEResponse(grokResponsesSSE))
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}

	out := rec.Body.String()
	if strings.Contains(out, "data:") || strings.Contains(out, "[DONE]") {
		t.Fatalf("non-stream client must NOT receive SSE; got: %s", out)
	}
	var chatResp dto.OpenAITextResponse
	if err := common.Unmarshal(rec.Body.Bytes(), &chatResp); err != nil {
		t.Fatalf("output must be a single Chat JSON: %v; body=%s", err, out)
	}
	if chatResp.Object != "chat.completion" {
		t.Fatalf("object = %q, want chat.completion", chatResp.Object)
	}
	if len(chatResp.Choices) == 0 || chatResp.Choices[0].Message.StringContent() != "Hello" {
		t.Fatalf("aggregated content mismatch; body=%s", out)
	}

	// usage 是计费依据：必须回 *dto.Usage 且 token 翻译正确（对应 SSE 里的
	// usage:{input_tokens:5,output_tokens:1,total_tokens:6}）。
	usage, ok := usageAny.(*dto.Usage)
	if !ok {
		t.Fatalf("usage return = %T, want *dto.Usage", usageAny)
	}
	if usage.PromptTokens != 5 {
		t.Fatalf("PromptTokens = %d, want 5", usage.PromptTokens)
	}
	if usage.CompletionTokens != 1 {
		t.Fatalf("CompletionTokens = %d, want 1", usage.CompletionTokens)
	}
	if usage.TotalTokens != 6 {
		t.Fatalf("TotalTokens = %d, want 6", usage.TotalTokens)
	}
}

// TestRelayChatOverGrok_StreamStillSSE 锁住流式路径不回归：stream=true 仍回
// chat.completion.chunk SSE 且以 [DONE] 收尾。
func TestRelayChatOverGrok_StreamStillSSE(t *testing.T) {
	// 流式路径委托给 openai.OaiResponsesToChatStreamHandler，其内部 StreamScannerHandler
	// 会 time.NewTicker(constant.StreamingTimeout)。该全局在 server 启动时由 env 初始化，
	// 测试二进制里默认 0 会触发 NewTicker panic——沿用 openai/blockrun/gemini 测试的
	// 既定 save/set/restore 惯例补一个正数值。
	previousTimeout := constant.StreamingTimeout
	if previousTimeout <= 0 {
		constant.StreamingTimeout = 30
	}
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "grok-4"},
		UserWantsStream: true,
		RelayFormat:     "openai",
	}
	if _, apiErr := RelayChatOverGrok(c, info, newSSEResponse(grokResponsesSSE)); apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	out := rec.Body.String()
	if !strings.Contains(out, "chat.completion.chunk") {
		t.Fatalf("stream client must receive chat.completion.chunk; got: %s", out)
	}
	if !strings.Contains(out, "[DONE]") {
		t.Fatalf("stream must terminate with [DONE]; got: %s", out)
	}
}

// TestRelayChatOverGrok_UpstreamErrorPreservesStatus 校验上游非 200 时保留状态码。
func TestRelayChatOverGrok_UpstreamErrorPreservesStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		StatusCode: http.StatusTooManyRequests,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader(`{"error":"rate limited"}`)),
	}
	_, apiErr := RelayChatOverGrok(c, &relaycommon.RelayInfo{UserWantsStream: false}, resp)
	if apiErr == nil {
		t.Fatalf("expected error for non-200 upstream")
	}
	if apiErr.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429 (must preserve upstream status for retry/limit signals)", apiErr.StatusCode)
	}
}

// TestRelayChatOverGrok_ResponseFailedSurfacesUpstreamMessage 校验 response.failed
// 分支：聚合器读到 failed 事件时返回 500，且错误 message 走三级回退的第一级
// （response.error.message），把上游原文透给上层。
func TestRelayChatOverGrok_ResponseFailedSurfacesUpstreamMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	const failedSSE = "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\",\"model\":\"grok-4\"}}\n\n" +
		"data: {\"type\":\"response.failed\",\"response\":{\"id\":\"resp_1\",\"status\":\"failed\",\"error\":{\"code\":\"server_error\",\"message\":\"upstream boom\"}}}\n\n"

	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "grok-4"},
		UserWantsStream: false,
	}
	_, apiErr := RelayChatOverGrok(c, info, newSSEResponse(failedSSE))
	if apiErr == nil {
		t.Fatalf("expected error for response.failed event")
	}
	if apiErr.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (grokResponseFailedError uses StatusInternalServerError)", apiErr.StatusCode)
	}
	if !strings.Contains(apiErr.Error(), "upstream boom") {
		t.Fatalf("error must surface upstream error.message; got: %s", apiErr.Error())
	}
}

// TestRelayChatOverGrok_NoTerminalEventIsBadGateway 校验协议错误分支：上游流在
// 任何 terminal 事件（completed/done/incomplete/failed）之前就结束时，聚合器必须
// 报 502（http.StatusBadGateway），而不是把半截输出当成成功返回。
func TestRelayChatOverGrok_NoTerminalEventIsBadGateway(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	const truncatedSSE = "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\",\"model\":\"grok-4\"}}\n\n" +
		"data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hello\"}\n\n"

	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "grok-4"},
		UserWantsStream: false,
	}
	_, apiErr := RelayChatOverGrok(c, info, newSSEResponse(truncatedSSE))
	if apiErr == nil {
		t.Fatalf("expected error when stream ends before a terminal event")
	}
	if apiErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502 (no terminal event is a protocol error)", apiErr.StatusCode)
	}
}
