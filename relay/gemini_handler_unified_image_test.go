package relay

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiHelperRejectsPassThroughImageIntentHiddenByAliasPriority(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	rawBody := `{
		"contents":[{"role":"user","parts":[{"text":"draw a cat"}]}],
		"generationConfig":{
			"responseModalities":["IMAGE"],
			"response_modalities":["TEXT"]
		}
	}`
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-2.5-flash:generateContent", strings.NewReader(rawBody))
	c.Request.Header.Set("Content-Type", "application/json")
	defer common.CleanupBodyStorage(c)

	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeGemini)
	common.SetContextKey(c, constant.ContextKeyChannelId, 1)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://generativelanguage.googleapis.com")
	common.SetContextKey(c, constant.ContextKeyChannelKey, "test-key")
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "gemini-2.5-flash")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: true})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})

	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeGemini,
		RelayFormat:     types.RelayFormatGemini,
		OriginModelName: "gemini-2.5-flash",
		RequestURLPath:  c.Request.URL.Path,
		Request: &dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{{
				Role:  "user",
				Parts: []dto.GeminiPart{{Text: "draw a cat"}},
			}},
			GenerationConfig: dto.GeminiChatGenerationConfig{
				ResponseModalities: []string{"TEXT"},
			},
		},
	}

	apiErr := GeminiHelper(c, info)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeInvalidRequest, apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.Contains(t, apiErr.Error(), "POST /v1/images/generations")
}
