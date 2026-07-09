package gemini

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertImageRequestGeminiNativeImageModel(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	n := uint(1)
	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-3.1-flash-image",
		},
	}, dto.ImageRequest{
		Prompt: "draw a small red house",
		Size:   "2048x2048",
		N:      &n,
	})

	require.NoError(t, err)
	geminiRequest, ok := converted.(dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, geminiRequest.Contents, 1)
	require.Equal(t, "user", geminiRequest.Contents[0].Role)
	require.Equal(t, "draw a small red house", geminiRequest.Contents[0].Parts[0].Text)
	require.Equal(t, []string{"TEXT", "IMAGE"}, geminiRequest.GenerationConfig.ResponseModalities)

	var imageConfig map[string]string
	require.NoError(t, common.Unmarshal(geminiRequest.GenerationConfig.ImageConfig, &imageConfig))
	require.Equal(t, "2K", imageConfig["imageSize"])
	require.Equal(t, "1:1", imageConfig["aspectRatio"])
}

func TestConvertImageRequestGeminiNativeImageRejectsMultipleImages(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	n := uint(2)
	_, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-3.1-flash-image",
		},
	}, dto.ImageRequest{
		Prompt: "draw a small red house",
		Size:   "1024x1024",
		N:      &n,
	})

	require.ErrorContains(t, err, "only supports n=1")
}

func TestGeminiNativeImageHandlerConvertsInlineImageToOpenAIImageResponse(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	payload := dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Role: "model",
					Parts: []dto.GeminiPart{
						{Text: "revised prompt"},
						{
							InlineData: &dto.GeminiInlineData{
								MimeType: "image/png",
								Data:     "aW1hZ2UtYnl0ZXM=",
							},
						},
					},
				},
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     11,
			CandidatesTokenCount: 22,
			TotalTokenCount:      33,
		},
	}
	body, err := common.Marshal(payload)
	require.NoError(t, err)

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-3.1-flash-image",
		},
	}
	usage, newAPIError := GeminiNativeImageHandler(c, info, &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
	})

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	require.Equal(t, 11, usage.PromptTokens)
	require.Equal(t, 22, usage.CompletionTokens)
	require.Equal(t, 33, usage.TotalTokens)
	require.Equal(t, float64(1), info.PriceData.OtherRatios["n"])

	var openAIResponse dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &openAIResponse))
	require.Len(t, openAIResponse.Data, 1)
	require.Equal(t, "aW1hZ2UtYnl0ZXM=", openAIResponse.Data[0].B64Json)
	require.Equal(t, "revised prompt", openAIResponse.Data[0].RevisedPrompt)
}
