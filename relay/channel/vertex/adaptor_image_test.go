package vertex

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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/gin-gonic/gin"
)

func TestDoResponseNormalizesNativeGeminiImagesOnVertex(t *testing.T) {
	recorder := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(recorder, gin.New())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	response := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(
			`{"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"aW1hZ2U="}}]}}]}`,
		)),
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "nano-banana-2",
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)

	usage, apiErr := adaptor.DoResponse(c, response, info)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, http.StatusOK, recorder.Code)
	var imageResponse dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResponse))
	require.Len(t, imageResponse.Data, 1)
	assert.Equal(t, "aW1hZ2U=", imageResponse.Data[0].B64Json)
}

func TestBuildGoogleModelURLNormalizesGeminiModelAlias(t *testing.T) {
	requestURL := BuildGoogleModelURL(
		"https://aiplatform.googleapis.com",
		"v1",
		"project",
		"global",
		" models/GEMINI-3.1-FLASH-IMAGE ",
		"generateContent",
	)
	assert.Contains(t, requestURL, "/publishers/google/models/gemini-3.1-flash-image:generateContent")
	assert.NotContains(t, requestURL, "/models/models/")
}
