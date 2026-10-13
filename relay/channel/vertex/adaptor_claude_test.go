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

func TestVertexClaudeRequestUsesAnthropicRawPredictForModelAlias(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "team-claude",
		IsStream:        true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://us-central1-aiplatform.googleapis.com",
			ApiKey:            "test-key",
			UpstreamModelName: "team-claude",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				VertexKeyType: dto.VertexKeyTypeAPIKey,
			},
		},
	}
	// Init classifies this custom alias as Gemini. The incoming Claude
	// Messages protocol must take precedence when converting its request.
	adaptor := &Adaptor{}
	adaptor.Init(info)
	require.Equal(t, RequestModeGemini, adaptor.RequestMode)

	maxTokens := uint(32)
	got, err := adaptor.ConvertClaudeRequest(ctx, info, &dto.ClaudeRequest{
		Model:     "team-claude",
		MaxTokens: &maxTokens,
	})
	require.NoError(t, err)
	require.IsType(t, &VertexAIClaudeRequest{}, got)
	require.Equal(t, RequestModeClaude, adaptor.RequestMode)
	require.Equal(t, anthropicVersion, got.(*VertexAIClaudeRequest).AnthropicVersion)

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.True(t, strings.Contains(url, "/publishers/anthropic/models/team-claude:streamRawPredict?alt=sse"), url)
	require.NotContains(t, url, "generateContent")
}
