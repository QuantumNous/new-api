package vertex

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVertexResponsesRequestConvertsToGemini(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	info := newVertexResponsesRelayInfo(false)
	got, err := (&Adaptor{RequestMode: RequestModeGemini}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model: "gemini-test",
		Input: json.RawMessage("\"hello\""),
	})
	require.NoError(t, err)

	geminiRequest, ok := got.(*dto.GeminiChatRequest)
	require.True(t, ok, "expected Gemini generateContent request, got %T", got)
	require.Len(t, geminiRequest.Contents, 1)
	require.Len(t, geminiRequest.Contents[0].Parts, 1)
	assert.Equal(t, "hello", geminiRequest.Contents[0].Parts[0].Text)
}

func TestVertexResponsesAdaptorReturnsOpenAIResponsesJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "vertex-responses-test")

	payload := dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Role:  "model",
					Parts: []dto.GeminiPart{{Text: "hello"}},
				},
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     2,
			CandidatesTokenCount: 3,
			TotalTokenCount:      5,
		},
	}
	body, err := common.Marshal(payload)
	require.NoError(t, err)

	info := newVertexResponsesRelayInfo(false)
	usage, apiErr := (&Adaptor{RequestMode: RequestModeGemini}).DoResponse(c, &http.Response{
		Body: io.NopCloser(bytes.NewReader(body)),
	}, info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	got := recorder.Body.String()
	assert.Contains(t, got, "\"object\":\"response\"")
	assert.Contains(t, got, "\"status\":\"completed\"")
	assert.Contains(t, got, "\"type\":\"output_text\"")
	assert.Contains(t, got, "\"text\":\"hello\"")
	assert.NotContains(t, got, "\"candidates\"")
	assert.NotContains(t, got, "\"choices\"")
}

func newVertexResponsesRelayInfo(isStream bool) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		IsStream:       isStream,
		RelayMode:      relayconstant.RelayModeResponses,
		RelayFormat:    types.RelayFormatOpenAIResponses,
		RequestURLPath: "/v1/responses",
		DisablePing:    true,
		OriginModelName: "gemini-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-test",
		},
	}
}
