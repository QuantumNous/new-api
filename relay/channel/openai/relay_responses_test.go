package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func TestOaiResponsesStreamHandlerCapturesIncompleteUsage(t *testing.T) {
	previousTimeout := constant.StreamingTimeout
	if previousTimeout <= 0 {
		constant.StreamingTimeout = 30
	}
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })

	upstream := strings.Join([]string{
		"event: response.output_item.done",
		`data: {"type":"response.output_item.done","output_index":0,"item":{"id":"fc_incomplete","type":"function_call","status":"incomplete","arguments":"{\"value\":","call_id":"call_incomplete","name":"get_magic_word"}}`,
		"",
		"event: response.incomplete",
		`data: {"type":"response.incomplete","response":{"id":"resp_incomplete","status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"usage":{"input_tokens":61,"output_tokens":16,"total_tokens":77,"input_tokens_details":{"cached_tokens":5,"cache_write_tokens":3}}}}`,
		"",
	}, "\n")

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{
		IsStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-5.6-sol",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(upstream)),
	}

	usage, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
	if apiErr != nil {
		t.Fatalf("handle incomplete Responses stream: %v", apiErr)
	}
	want := dto.Usage{
		PromptTokens:     61,
		CompletionTokens: 16,
		TotalTokens:      77,
	}
	want.PromptTokensDetails.CachedTokens = 5
	want.PromptTokensDetails.CacheWriteTokens = 3
	if *usage != want {
		t.Fatalf("incomplete usage = %#v, want %#v", *usage, want)
	}
	if !strings.Contains(recorder.Body.String(), "response.incomplete") {
		t.Fatalf("incomplete event was not forwarded: %s", recorder.Body.String())
	}
}

func TestOaiResponsesStreamHandlerCodexCapturesDoneUsage(t *testing.T) {
	upstream := strings.Join([]string{
		"event: response.done",
		`data: {"type":"response.done","response":{"id":"resp_done","status":"completed","usage":{"input_tokens":71,"output_tokens":19,"total_tokens":90,"input_tokens_details":{"cached_tokens":7,"cache_write_tokens":2}}}}`,
		"",
	}, "\n")

	recorder, ctx, info, resp := newResponsesStreamTest(t, upstream, constant.ChannelTypeCodex)
	usage, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
	if apiErr != nil {
		t.Fatalf("handle Codex response.done: %v", apiErr)
	}
	if usage.PromptTokens != 71 || usage.CompletionTokens != 19 || usage.TotalTokens != 90 {
		t.Fatalf("done usage = %#v", *usage)
	}
	if usage.PromptTokensDetails.CachedTokens != 7 || usage.PromptTokensDetails.CacheWriteTokens != 2 {
		t.Fatalf("done token details = %#v", usage.PromptTokensDetails)
	}
	if !strings.Contains(recorder.Body.String(), "response.done") {
		t.Fatalf("done event was not forwarded: %s", recorder.Body.String())
	}
}

func TestOaiResponsesStreamHandlerNonCodexKeepsDoneBehavior(t *testing.T) {
	upstream := strings.Join([]string{
		"event: response.done",
		`data: {"type":"response.done","response":{"id":"resp_done","status":"completed","usage":{"input_tokens":71,"output_tokens":19,"total_tokens":90}}}`,
		"",
	}, "\n")

	_, ctx, info, resp := newResponsesStreamTest(t, upstream, constant.ChannelTypeOpenAI)
	usage, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
	if apiErr != nil {
		t.Fatalf("handle non-Codex response.done: %v", apiErr)
	}
	if usage.PromptTokens != 0 || usage.CompletionTokens != 0 || usage.TotalTokens != 0 {
		t.Fatalf("non-Codex behavior changed, usage = %#v", *usage)
	}
}

func TestOaiResponsesStreamHandlerCodexFailedBeforeCommitIsRetryable(t *testing.T) {
	upstream := strings.Join([]string{
		"event: response.failed",
		`data: {"type":"response.failed","response":{"id":"resp_failed","status":"failed","error":{"code":"server_error","message":"upstream blew up"}}}`,
		"",
	}, "\n")

	recorder, ctx, info, resp := newResponsesStreamTest(t, upstream, constant.ChannelTypeCodex)
	info.ApiType = constant.APITypeCodex
	ctx.Header("X-Existing", "keep")
	resp.Header.Set("X-Reasoning-Included", "true")
	resp.Header.Set("X-Codex-Turn-State", "state-from-failed-attempt")
	_, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
	if apiErr == nil {
		t.Fatal("expected Codex response.failed error")
	}
	if types.IsSkipRetryError(apiErr) {
		t.Fatal("failure before response commit must remain retryable")
	}
	if recorder.Body.Len() != 0 || ctx.Writer.Written() {
		t.Fatalf("failed event committed before retry: %s", recorder.Body.String())
	}
	if got := recorder.Header().Get("Content-Type"); got != "" {
		t.Fatalf("retryable failure retained SSE content type %q", got)
	}
	if got := recorder.Header().Get("Transfer-Encoding"); got != "" {
		t.Fatalf("retryable failure retained transfer encoding %q", got)
	}
	if got := recorder.Header().Get("X-Reasoning-Included"); got != "" {
		t.Fatalf("retryable failure retained Codex response header %q", got)
	}
	if got := recorder.Header().Get("X-Codex-Turn-State"); got != "" {
		t.Fatalf("retryable failure retained Codex turn state %q", got)
	}
	if got := recorder.Header().Get("X-Existing"); got != "keep" {
		t.Fatalf("pre-existing response header = %q", got)
	}
	if _, exists := ctx.Get("event_stream_headers_set"); exists {
		t.Fatal("retryable failure retained event_stream_headers_set")
	}
	if info.HasSendResponse() || info.ReceivedResponseCount != 0 {
		t.Fatalf("retryable failure retained first-response state: sent=%v received=%d", info.HasSendResponse(), info.ReceivedResponseCount)
	}

	ctx.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
	if got := recorder.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
		t.Fatalf("final JSON content type = %q", got)
	}
}

func TestOaiResponsesStreamHandlerCodexFailedAfterCommitSkipsRetry(t *testing.T) {
	upstream := strings.Join([]string{
		"event: response.created",
		`data: {"type":"response.created","response":{"id":"resp_failed","status":"in_progress"}}`,
		"",
		"event: response.failed",
		`data: {"type":"response.failed","response":{"id":"resp_failed","status":"failed","error":{"code":"server_error","message":"upstream blew up"}}}`,
		"",
	}, "\n")

	recorder, ctx, info, resp := newResponsesStreamTest(t, upstream, constant.ChannelTypeCodex)
	_, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
	if apiErr == nil {
		t.Fatal("expected Codex response.failed error")
	}
	if !types.IsSkipRetryError(apiErr) {
		t.Fatal("failure after response commit must skip retry")
	}
	if !strings.Contains(recorder.Body.String(), "response.created") || !strings.Contains(recorder.Body.String(), "response.failed") {
		t.Fatalf("committed Codex events were not forwarded: %s", recorder.Body.String())
	}
}

func TestOaiResponsesStreamHandlerCodexRetryRearmsFirstResponseTracking(t *testing.T) {
	failedUpstream := strings.Join([]string{
		"event: response.failed",
		`data: {"type":"response.failed","response":{"id":"resp_failed","status":"failed","error":{"code":"server_error","message":"upstream blew up"}}}`,
		"",
	}, "\n")

	recorder, ctx, info, failedResp := newResponsesStreamTest(t, failedUpstream, constant.ChannelTypeCodex)
	info.ApiType = constant.APITypeCodex
	_, apiErr := OaiResponsesStreamHandler(ctx, info, failedResp)
	if apiErr == nil || types.IsSkipRetryError(apiErr) {
		t.Fatalf("first attempt error = %#v", apiErr)
	}

	doneUpstream := strings.Join([]string{
		"event: response.done",
		`data: {"type":"response.done","response":{"id":"resp_done","status":"completed","usage":{"input_tokens":8,"output_tokens":2,"total_tokens":10}}}`,
		"",
	}, "\n")
	doneResp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(doneUpstream)),
	}

	usage, apiErr := OaiResponsesStreamHandler(ctx, info, doneResp)
	if apiErr != nil {
		t.Fatalf("retry attempt: %v", apiErr)
	}
	if !info.HasSendResponse() || info.ReceivedResponseCount != 1 {
		t.Fatalf("retry first-response state: sent=%v received=%d", info.HasSendResponse(), info.ReceivedResponseCount)
	}
	if usage.PromptTokens != 8 || usage.CompletionTokens != 2 {
		t.Fatalf("retry usage = %#v", *usage)
	}
	if got := recorder.Header().Get("Content-Type"); got != "text/event-stream" {
		t.Fatalf("retry content type = %q", got)
	}
}

func newResponsesStreamTest(t *testing.T, upstream string, channelType int) (*httptest.ResponseRecorder, *gin.Context, *relaycommon.RelayInfo, *http.Response) {
	t.Helper()
	previousTimeout := constant.StreamingTimeout
	if previousTimeout <= 0 {
		constant.StreamingTimeout = 30
	}
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{
		IsStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       channelType,
			UpstreamModelName: "gpt-5.6-terra",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(upstream)),
	}
	return recorder, ctx, info, resp
}
