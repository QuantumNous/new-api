package gemini

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIImageRequestToGeminiGenerateContent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-2.5-flash-image",
		},
	}

	var req dto.ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gemini-2.5-flash-image",
		"prompt":"make it cinematic",
		"image":"data:image/png;base64,aW1hZ2U=",
		"size":"1792x1024",
		"quality":"high"
	}`), &req))

	got, err := (&Adaptor{}).ConvertImageRequest(c, info, req)
	require.NoError(t, err)

	geminiReq, ok := got.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, geminiReq.Contents, 1)
	require.Len(t, geminiReq.Contents[0].Parts, 2)
	require.Equal(t, "make it cinematic", geminiReq.Contents[0].Parts[0].Text)
	require.NotNil(t, geminiReq.Contents[0].Parts[1].InlineData)
	require.Equal(t, "image/png", geminiReq.Contents[0].Parts[1].InlineData.MimeType)
	require.Equal(t, "aW1hZ2U=", geminiReq.Contents[0].Parts[1].InlineData.Data)
	require.Equal(t, []string{"TEXT", "IMAGE"}, geminiReq.GenerationConfig.ResponseModalities)

	var imageConfig map[string]string
	require.NoError(t, common.Unmarshal(geminiReq.GenerationConfig.ImageConfig, &imageConfig))
	require.Equal(t, "16:9", imageConfig["aspectRatio"])
	require.Equal(t, "2K", imageConfig["imageSize"])
}

func TestGeminiGenerateContentImageHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(`{
			"candidates":[{
				"content":{
					"parts":[
						{"text":"done"},
						{"inlineData":{"mimeType":"image/png","data":"Z2VuZXJhdGVk"}}
					]
				}
			}],
			"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":3,"totalTokenCount":5}
		}`)),
	}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}

	usage, err := GeminiGenerateContentImageHandler(c, info, resp)
	require.Nil(t, err)
	require.Equal(t, 5, usage.TotalTokens)
	require.Contains(t, recorder.Body.String(), `"b64_json":"Z2VuZXJhdGVk"`)
	require.NotContains(t, recorder.Body.String(), `"choices"`)
}
