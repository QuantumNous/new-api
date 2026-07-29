package relay

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestClaudeResponsesPolicyOverridesChannelBodyPassthrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	const testChannelID = 42
	const testModel = "policy-matched-model"

	var upstreamPath string
	var upstreamBody []byte
	var upstreamReadErr error
	var upstreamWriteErr error
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamPath = r.URL.Path
		upstreamBody, upstreamReadErr = io.ReadAll(r.Body)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, upstreamWriteErr = w.Write([]byte(`{"error":{"message":"stop after capturing request","type":"invalid_request_error","code":"test"}}`))
	}))
	defer upstream.Close()

	globalSettings := model_setting.GetGlobalSettings()
	originalGlobalSettings := *globalSettings
	t.Cleanup(func() {
		*globalSettings = originalGlobalSettings
	})
	globalSettings.PassThroughRequestEnabled = false
	globalSettings.ChatCompletionsToResponsesPolicy = model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		ChannelIDs:    []int{testChannelID},
		ModelPatterns: []string{`^policy-matched-model$`},
	}

	imageData := "iVBORw0KGgo="
	text := "Read the image."
	maxTokens := uint(64)
	request := &dto.ClaudeRequest{
		Model:     testModel,
		MaxTokens: &maxTokens,
		Messages: []dto.ClaudeMessage{
			{
				Role: "user",
				Content: []dto.ClaudeMediaMessage{
					{
						Type: "image",
						Source: &dto.ClaudeMessageSource{
							Type:      "base64",
							MediaType: "image/png",
							Data:      imageData,
						},
					},
					{
						Type: dto.ContentTypeText,
						Text: &text,
					},
				},
			},
		},
	}
	requestBody, err := common.Marshal(request)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", bytes.NewReader(requestBody))
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelId, testChannelID)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
	common.SetContextKey(c, constant.ContextKeyChannelKey, "test-key")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: true})
	common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)

	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatClaude, request, nil)
	require.NoError(t, err)

	newAPIError := ClaudeHelper(c, info)

	require.NotNil(t, newAPIError)
	require.NoError(t, upstreamReadErr)
	require.NoError(t, upstreamWriteErr)
	assert.Equal(t, "/v1/responses", upstreamPath)
	assert.Equal(t, "input_image", gjson.GetBytes(upstreamBody, "input.0.content.0.type").String())
	assert.Equal(t, "data:image/png;base64,"+imageData, gjson.GetBytes(upstreamBody, "input.0.content.0.image_url").String())
	assert.Equal(t, "input_text", gjson.GetBytes(upstreamBody, "input.0.content.1.type").String())
	assert.Equal(t, text, gjson.GetBytes(upstreamBody, "input.0.content.1.text").String())
	assert.Equal(t, []types.RelayFormat{
		types.RelayFormatClaude,
		types.RelayFormatOpenAI,
		types.RelayFormatOpenAIResponses,
	}, info.RequestConversionChain)
}
