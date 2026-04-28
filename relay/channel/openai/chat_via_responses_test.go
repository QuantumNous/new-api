package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupResponsesChatTest(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
		},
		RelayFormat: types.RelayFormatOpenAI,
		DisablePing: true,
	}

	return c, recorder, resp, info
}

func emptyResponsesCompletedEvent() string {
	return `{"type":"response.completed","response":{"id":"resp_empty","created_at":123,"model":"gpt-test","usage":{"input_tokens":1,"output_tokens":0,"total_tokens":1}}}`
}

func incompleteResponsesEvent(reason string) string {
	return `{"type":"response.incomplete","response":{"id":"resp_incomplete","created_at":123,"model":"gpt-test","status":"incomplete","incomplete_details":{"reason":"` + reason + `"},"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}`
}

func TestOaiResponsesToChatStreamToNonStreamHandlerRejectsEmptyAssistantResult(t *testing.T) {
	body := "data: " + emptyResponsesCompletedEvent() + "\n\ndata: [DONE]\n\n"
	c, recorder, resp, info := setupResponsesChatTest(t, body)

	usage, err := OaiResponsesToChatStreamToNonStreamHandler(c, info, resp)

	if err == nil {
		t.Fatal("expected empty assistant result to return an error")
	}
	if usage != nil {
		t.Fatalf("expected nil usage on error, got %#v", usage)
	}
	if !strings.Contains(err.Error(), "empty assistant response") {
		t.Fatalf("expected empty assistant response error, got %q", err.Error())
	}
	if err.GetErrorCode() != types.ErrorCodeEmptyResponse {
		t.Fatalf("expected empty_response error code, got %q", err.GetErrorCode())
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("expected no synthetic chat response, got %q", recorder.Body.String())
	}
}

func TestOaiResponsesToChatStreamHandlerRejectsEmptyAssistantResult(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":""}`,
		"data: " + emptyResponsesCompletedEvent(),
		"data: [DONE]",
		"",
	}, "\n\n")
	c, recorder, resp, info := setupResponsesChatTest(t, body)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)

	if err == nil {
		t.Fatal("expected empty assistant result to return an error")
	}
	if usage != nil {
		t.Fatalf("expected nil usage on error, got %#v", usage)
	}
	if !strings.Contains(err.Error(), "empty assistant response") {
		t.Fatalf("expected empty assistant response error, got %q", err.Error())
	}
	if err.GetErrorCode() != types.ErrorCodeEmptyResponse {
		t.Fatalf("expected empty_response error code, got %q", err.GetErrorCode())
	}
	if strings.Contains(recorder.Body.String(), "chat.completion.chunk") {
		t.Fatalf("expected no synthetic stream chunks, got %q", recorder.Body.String())
	}
}

func TestOaiResponsesToChatStreamToNonStreamHandlerMapsIncompleteFinishReason(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		"data: " + incompleteResponsesEvent("max_output_tokens"),
		"data: [DONE]",
		"",
	}, "\n\n")
	c, recorder, resp, info := setupResponsesChatTest(t, body)

	usage, err := OaiResponsesToChatStreamToNonStreamHandler(c, info, resp)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if usage == nil {
		t.Fatal("expected usage")
	}
	if !strings.Contains(recorder.Body.String(), `"finish_reason":"length"`) {
		t.Fatalf("expected length finish_reason, got %q", recorder.Body.String())
	}
}

func TestOaiResponsesToChatStreamHandlerMapsIncompleteFinishReason(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		"data: " + incompleteResponsesEvent("content_filter"),
		"data: [DONE]",
		"",
	}, "\n\n")
	c, recorder, resp, info := setupResponsesChatTest(t, body)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if usage == nil {
		t.Fatal("expected usage")
	}
	if !strings.Contains(recorder.Body.String(), `"finish_reason":"content_filter"`) {
		t.Fatalf("expected content_filter finish_reason, got %q", recorder.Body.String())
	}
}
