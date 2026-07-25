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
