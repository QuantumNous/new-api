package aionly

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAionlyTTSHandler_ReturnsSynthesisResponseJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	originalEstimator := estimateAionlyAudioTokensFn
	estimateAionlyAudioTokensFn = func(_ *gin.Context, _ string) int {
		return 250
	}
	t.Cleanup(func() {
		estimateAionlyAudioTokensFn = originalEstimator
	})

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       ioNopCloser(`{"code":200,"msg":"ok","data":{"url":"/audio/test.mp3"}}`),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.aiionly.com"},
	}
	info.SetEstimatePromptTokens(12)

	usage, newErr := AionlyTTSHandler(c, resp, info)

	require.Nil(t, newErr)
	require.NotNil(t, usage)
	usageData, ok := usage.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 12, usageData.PromptTokens)
	assert.Equal(t, 250, usageData.CompletionTokens)
	assert.Equal(t, 250, usageData.CompletionTokenDetails.AudioTokens)
	assert.Equal(t, 262, usageData.TotalTokens)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "application/json", recorder.Header().Get("Content-Type"))

	var responseBody aionlySynthesisResponse
	err := common.Unmarshal(recorder.Body.Bytes(), &responseBody)
	require.NoError(t, err)
	assert.Equal(t, 200, responseBody.Code)
	assert.Equal(t, "https://api.aiionly.com/audio/test.mp3", responseBody.Data.URL)
}

func TestAionlyTTSHandler_ReturnsErrorWhenSynthesisFailed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       ioNopCloser(`{"code":500,"msg":"failed","data":null}`),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.aiionly.com"},
	}

	usage, newErr := AionlyTTSHandler(c, resp, info)

	assert.Nil(t, usage)
	require.NotNil(t, newErr)
	assert.Equal(t, http.StatusOK, newErr.StatusCode)
	assert.True(t, strings.Contains(newErr.Error(), "aiionly synthesis failed"))
}

func TestCompletionTokensFromDuration(t *testing.T) {
	assert.Equal(t, 1000, completionTokensFromDuration(60))
	assert.Equal(t, 1017, completionTokensFromDuration(61))
	assert.Equal(t, 1, completionTokensFromDuration(0))
}

func TestCompletionTokensFromSize(t *testing.T) {
	assert.Equal(t, 1, completionTokensFromSize(1))
	assert.Equal(t, 2, completionTokensFromSize(1500))
	assert.Equal(t, 1, completionTokensFromSize(0))
}
