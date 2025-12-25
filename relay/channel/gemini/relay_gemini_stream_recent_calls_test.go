package gemini

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func TestGeminiStreamWritesRecentCallsChunksAndAggregatedText(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-1.5-pro:streamGenerateContent", strings.NewReader(`{"contents":[]}`))

	id := service.RecentCallsCache().BeginFromContext(c, nil, []byte(`{"contents":[]}`))
	if id == 0 {
		t.Fatalf("expected non-zero recent call id")
	}

	body := strings.Join([]string{
		`data: {"candidates":[{"index":0,"content":{"parts":[{"text":"hello "}]}}],"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":1,"totalTokenCount":2}}`,
		`data: {"candidates":[{"index":0,"content":{"parts":[{"text":"world"}]}}],"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":2,"totalTokenCount":3}}`,
		`data: [DONE]`,
		"",
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	info := &relaycommon.RelayInfo{
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-1.5-pro",
			ChannelSetting:    dto.ChannelSettings{},
		},
	}
	_, apiErr := GeminiChatStreamHandler(c, info, resp)
	if apiErr != nil {
		t.Fatalf("unexpected api error: %v", apiErr)
	}

	rec, ok := service.RecentCallsCache().Get(id)
	if !ok {
		t.Fatalf("expected recent call record")
	}
	if rec.Stream == nil {
		t.Fatalf("expected stream info")
	}
	if len(rec.Stream.Chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d", len(rec.Stream.Chunks))
	}
	if rec.Stream.Chunks[0] == "" || rec.Stream.Chunks[1] == "" {
		t.Fatalf("expected non-empty chunks")
	}
	if rec.Stream.AggregatedText != "hello world" {
		t.Fatalf("unexpected aggregated text: %q", rec.Stream.AggregatedText)
	}
}