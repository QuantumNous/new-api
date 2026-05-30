package ali

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func TestAliMiniMaxVoiceCloneResponseSetsUnlockPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := `{
		"output": {
			"base_resp": {"status_code": 0, "status_msg": "success"},
			"demo_audio": "https://example.com/demo.mp3"
		},
		"usage": {"characters": 15},
		"request_id": "test-request"
	}`

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "MiniMax/speech-02-turbo",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "MiniMax/speech-02-turbo",
		},
	}

	err, usage := aliVoiceCloneHandler(ctx, resp, info)
	if err != nil {
		t.Fatalf("aliVoiceCloneHandler returned error: %v", err)
	}

	if usage.CompletionTokens != 15 {
		t.Fatalf("CompletionTokens = %d, want 15", usage.CompletionTokens)
	}
	if usage.CompletionTokenDetails.AudioTokens != 15 {
		t.Fatalf("audio completion tokens = %d, want 15", usage.CompletionTokenDetails.AudioTokens)
	}
	if got := ctx.GetFloat64(service.ContextKeyVoiceCloneFixedPrice); got != 9.9 {
		t.Fatalf("voice clone fixed price = %v, want 9.9", got)
	}
}

func TestAliQwenVoiceCloneListDoesNotSetUnlockPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ratio_setting.InitRatioSettings()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	// Qwen list returns usage.count=0
	body := `{
		"output": {
			"base_resp": {"status_code": 0, "status_msg": "success"},
			"results": []
		},
		"usage": {"count": 0},
		"request_id": "test-qwen-list"
	}`

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "qwen-voice-enrollment",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "qwen-voice-enrollment",
		},
	}

	err, usage := aliVoiceCloneHandler(ctx, resp, info)
	if err != nil {
		t.Fatalf("aliVoiceCloneHandler returned error: %v", err)
	}

	// Qwen is not MiniMax, should NOT set unlock price
	if got := ctx.GetFloat64(service.ContextKeyVoiceCloneFixedPrice); got != 0 {
		t.Fatalf("voice clone fixed price = %v, want 0 (Qwen should not set unlock price)", got)
	}
	// usage.count=0 -> prompt tokens should be 0 (not fallback to estimate)
	if usage.PromptTokens != 0 {
		t.Fatalf("PromptTokens = %d, want 0 (list has count=0)", usage.PromptTokens)
	}
	if usage.CompletionTokens != 0 {
		t.Fatalf("CompletionTokens = %d, want 0", usage.CompletionTokens)
	}
}

func TestAliVoiceCloneUnmarshalError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	// Invalid JSON
	body := `not json`

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "MiniMax/speech-02-turbo",
	}

	err, _ := aliVoiceCloneHandler(ctx, resp, info)
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
	if err.StatusCode != http.StatusInternalServerError {
		t.Fatalf("StatusCode = %d, want %d", err.StatusCode, http.StatusInternalServerError)
	}
}

func TestAliVoiceCloneUpstreamError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := `{
		"code": "InvalidParameter",
		"message": "voice not found",
		"request_id": "test-error"
	}`

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "MiniMax/speech-02-turbo",
	}

	err, _ := aliVoiceCloneHandler(ctx, resp, info)
	if err == nil {
		t.Fatal("expected error for upstream error, got nil")
	}
	if err.StatusCode != http.StatusBadRequest {
		t.Fatalf("StatusCode = %d, want %d", err.StatusCode, http.StatusBadRequest)
	}
}
