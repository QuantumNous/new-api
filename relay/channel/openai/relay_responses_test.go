package openai

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
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

func TestOaiResponsesStreamHandlerResponseDoneIsCodexOnly(t *testing.T) {
	upstream := strings.Join([]string{
		"event: response.done",
		`data: {"type":"response.done","response":{"id":"resp_done","status":"completed","usage":{"input_tokens":71,"output_tokens":19,"total_tokens":90,"input_tokens_details":{"cached_tokens":7,"cache_write_tokens":2}}}}`,
		"",
	}, "\n")

	for _, test := range []struct {
		name, want string
		channel    int
	}{
		{name: "Codex captures usage", channel: constant.ChannelTypeCodex, want: "71/19/90"},
		{name: "other channels stay unchanged", channel: constant.ChannelTypeOpenAI, want: "0/0/0"},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder, ctx, info, resp := newResponsesStreamTest(t, upstream, test.channel)
			usage, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
			if apiErr != nil {
				t.Fatal(apiErr)
			}
			if got := fmt.Sprintf("%d/%d/%d", usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens); got != test.want {
				t.Fatalf("usage = %s, want %s", got, test.want)
			}
			if !strings.Contains(recorder.Body.String(), "response.done") {
				t.Fatalf("done event was not forwarded: %s", recorder.Body.String())
			}
		})
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
	for _, header := range []string{"Content-Type", "Transfer-Encoding", "X-Reasoning-Included", "X-Codex-Turn-State"} {
		if got := recorder.Header().Get(header); got != "" {
			t.Fatalf("retryable failure retained %s %q", header, got)
		}
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

	// A real retry reuses RelayInfo and the downstream writer. Prove the reset
	// above re-arms both response observation and SSE headers.
	retry := strings.Join([]string{
		"event: response.done",
		`data: {"type":"response.done","response":{"id":"resp_done","status":"completed","usage":{"input_tokens":8,"output_tokens":2,"total_tokens":10}}}`,
		"",
	}, "\n")
	resp = &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(retry)),
	}
	usage, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
	if apiErr != nil || !info.HasSendResponse() || info.ReceivedResponseCount != 1 {
		t.Fatalf("retry error=%v sent=%v received=%d", apiErr, info.HasSendResponse(), info.ReceivedResponseCount)
	}
	if usage.PromptTokens != 8 || usage.CompletionTokens != 2 || !strings.HasPrefix(recorder.Header().Get("Content-Type"), "text/event-stream") {
		t.Fatalf("retry usage=%#v content-type=%q", *usage, recorder.Header().Get("Content-Type"))
	}
}

func TestOaiResponsesStreamHandlerCodexFailedAfterCommitSkipsRetry(t *testing.T) {
	upstream := strings.Join([]string{
		"event: response.created",
		`data: {"type":"response.created","response":{"id":"resp_failed","status":"in_progress"}}`,
		"",
		"event: response.output_text.delta",
		`data: {"type":"response.output_text.delta","delta":"partial output"}`,
		"",
		"event: response.failed",
		`data: {"type":"response.failed","response":{"id":"resp_failed","status":"failed","error":{"code":"server_error","message":"upstream blew up"},"usage":{"input_tokens":11,"output_tokens":3,"total_tokens":14}}}`,
		"",
	}, "\n")

	recorder, ctx, info, resp := newResponsesStreamTest(t, upstream, constant.ChannelTypeCodex)
	usage, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
	if apiErr == nil {
		t.Fatal("expected Codex response.failed error")
	}
	if !types.IsSkipRetryError(apiErr) {
		t.Fatal("failure after response commit must skip retry")
	}
	if !strings.Contains(recorder.Body.String(), "response.created") || !strings.Contains(recorder.Body.String(), "response.failed") {
		t.Fatalf("committed Codex events were not forwarded: %s", recorder.Body.String())
	}
	if usage.PromptTokens != 11 || usage.CompletionTokens != 3 || usage.TotalTokens != 14 {
		t.Fatalf("failed response usage = %#v", *usage)
	}
}

func TestOaiResponsesStreamHandlerCodexFailedAfterCommitEstimatesDeliveredUsage(t *testing.T) {
	service.InitTokenEncoders()
	tests := []struct {
		name      string
		eventType string
		delta     string
	}{
		{name: "text", eventType: "response.output_text.delta", delta: "partial output without terminal usage"},
		{name: "tool arguments", eventType: "response.function_call_arguments.delta", delta: `{"city":"Shanghai"}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			upstream := strings.Join([]string{
				"event: response.created",
				`data: {"type":"response.created","response":{"id":"resp_failed","status":"in_progress"}}`,
				"",
				"event: " + test.eventType,
				fmt.Sprintf(`data: {"type":%q,"item_id":"call_1","delta":%q}`, test.eventType, test.delta),
				"",
				"event: response.failed",
				`data: {"type":"response.failed","response":{"id":"resp_failed","status":"failed","error":{"code":"server_error","message":"upstream blew up"}}}`,
				"",
			}, "\n")

			_, ctx, info, resp := newResponsesStreamTest(t, upstream, constant.ChannelTypeCodex)
			info.SetEstimatePromptTokens(17)
			usage, apiErr := OaiResponsesStreamHandler(ctx, info, resp)
			if apiErr == nil || !types.IsSkipRetryError(apiErr) {
				t.Fatalf("failed response error = %#v", apiErr)
			}
			if usage.PromptTokens != 17 || usage.CompletionTokens <= 0 || usage.TotalTokens <= 17 {
				t.Fatalf("estimated failed response usage = %#v", *usage)
			}
		})
	}
}

func TestAppendResponsesFallbackUsageCapsBufferedBytes(t *testing.T) {
	var builder strings.Builder
	delta := strings.Repeat("x", maxResponsesFallbackUsageBytes+1024)

	appendResponsesFallbackUsage(&builder, delta)
	appendResponsesFallbackUsage(&builder, "ignored after cap")

	if builder.Len() != maxResponsesFallbackUsageBytes {
		t.Fatalf("buffered bytes = %d, want %d", builder.Len(), maxResponsesFallbackUsageBytes)
	}
}

func TestCodexResponsesFailedStatus(t *testing.T) {
	tests := []struct {
		name       string
		errorType  string
		errorCode  any
		statusCode int
	}{
		{name: "invalid request type", errorType: "invalid_request_error", statusCode: http.StatusBadRequest},
		{name: "image validation", errorCode: "unsupported_image_media_type", statusCode: http.StatusBadRequest},
		{name: "authentication", errorType: "authentication_error", statusCode: http.StatusUnauthorized},
		{name: "specific code overrides generic type", errorType: "invalid_request_error", errorCode: "permission_denied", statusCode: http.StatusForbidden},
		{name: "server code overrides generic client type", errorType: "invalid_request_error", errorCode: "server_error", statusCode: http.StatusInternalServerError},
		{name: "permanent quota", errorCode: "insufficient_quota", statusCode: http.StatusTooManyRequests},
		{name: "overloaded", errorCode: "service_unavailable", statusCode: http.StatusServiceUnavailable},
		{name: "unknown fallback", errorCode: "new_unrecognized_code", statusCode: http.StatusInternalServerError},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := &dto.OpenAIResponsesResponse{Error: types.OpenAIError{
				Type:    test.errorType,
				Code:    test.errorCode,
				Message: "upstream failure",
			}}
			apiErr := newCodexResponsesFailedError(response, false)
			if apiErr.StatusCode != test.statusCode {
				t.Fatalf("status = %d, want %d", apiErr.StatusCode, test.statusCode)
			}
			if types.IsSkipRetryError(apiErr) {
				t.Fatal("pre-commit retry must remain controlled by the centralized status policy")
			}
		})
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
