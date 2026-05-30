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
