package vertex

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestVertexClaudeMessagesToGeminiUsesGenerateContent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3.8-flash",
		IsStream:        true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://us-central1-aiplatform.googleapis.com",
			ApiKey:            "test-key",
			UpstreamModelName: "gemini-3.8-flash",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				VertexKeyType: dto.VertexKeyTypeAPIKey,
			},
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	require.Equal(t, RequestModeGemini, adaptor.RequestMode)

	maxTokens := uint(32)
	got, err := adaptor.ConvertClaudeRequest(ctx, info, &dto.ClaudeRequest{
		Model:     "gemini-3.8-flash",
		MaxTokens: &maxTokens,
		Messages:  []dto.ClaudeMessage{{Role: "user", Content: "hi"}},
	})
	require.NoError(t, err)
	geminiRequest, ok := got.(*dto.GeminiChatRequest)
	require.True(t, ok, "expected Gemini generateContent request, got %T", got)
	require.Len(t, geminiRequest.Contents, 1)
	require.Len(t, geminiRequest.Contents[0].Parts, 1)
	require.Equal(t, "hi", geminiRequest.Contents[0].Parts[0].Text)

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.True(t, strings.Contains(url, "/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse"), url)
	require.NotContains(t, url, "anthropic")
}
