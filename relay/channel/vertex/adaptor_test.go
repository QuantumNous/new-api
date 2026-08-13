package vertex

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestClaudeRequest() *dto.ClaudeRequest {
	maxTokens := uint(16)
	return &dto.ClaudeRequest{
		Model:     "gemini-2.5-pro",
		MaxTokens: &maxTokens,
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hi"},
		},
	}
}

// A Vertex channel whose upstream is Gemini must convert the incoming Anthropic
// Messages body to Gemini generateContent. Forwarding the raw Anthropic body to
// the generateContent URL makes Vertex reject anthropic_version/messages/max_tokens
// with HTTP 400 (issue #6715). The channel test dispatches through this same
// ConvertClaudeRequest for the Anthropic endpoint, so this also fixes the test.
func TestConvertClaudeRequestByRequestMode(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name        string
		requestMode int
		wantKeys    []string
		absentKeys  []string
	}{
		{
			name:        "gemini upstream converts to generateContent",
			requestMode: RequestModeGemini,
			wantKeys:    []string{"contents", "generationConfig"},
			absentKeys:  []string{"anthropic_version", "messages", "max_tokens"},
		},
		{
			name:        "claude upstream keeps anthropic messages body",
			requestMode: RequestModeClaude,
			wantKeys:    []string{"anthropic_version", "messages", "max_tokens"},
			absentKeys:  []string{"contents", "generationConfig"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{
				RelayFormat: types.RelayFormatClaude,
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: "gemini-2.5-pro",
				},
			}
			adaptor := &Adaptor{RequestMode: tc.requestMode}

			converted, err := adaptor.ConvertClaudeRequest(c, info, newTestClaudeRequest())
			require.NoError(t, err)
			require.NotNil(t, converted)

			raw, err := common.Marshal(converted)
			require.NoError(t, err)

			var body map[string]any
			require.NoError(t, common.Unmarshal(raw, &body))
			for _, key := range tc.wantKeys {
				assert.Contains(t, body, key, "expected key %q in converted body", key)
			}
			for _, key := range tc.absentKeys {
				assert.NotContains(t, body, key, "unexpected key %q in converted body", key)
			}

			switch tc.requestMode {
			case RequestModeGemini:
				geminiReq, ok := converted.(*dto.GeminiChatRequest)
				require.True(t, ok, "expected *dto.GeminiChatRequest, got %T", converted)
				require.Len(t, geminiReq.Contents, 1)
				require.Len(t, geminiReq.Contents[0].Parts, 1)
				assert.Equal(t, "hi", geminiReq.Contents[0].Parts[0].Text)
				require.NotNil(t, geminiReq.GenerationConfig.MaxOutputTokens)
				assert.Equal(t, uint(16), *geminiReq.GenerationConfig.MaxOutputTokens)
			case RequestModeClaude:
				claudeReq, ok := converted.(*VertexAIClaudeRequest)
				require.True(t, ok, "expected *VertexAIClaudeRequest, got %T", converted)
				assert.Equal(t, anthropicVersion, claudeReq.AnthropicVersion)
			}
		})
	}
}
