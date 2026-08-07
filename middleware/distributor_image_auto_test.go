package middleware

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDistributorImageAutoBypassesPinnedChannelAndAffinitySelection(t *testing.T) {
	assert.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	router := gin.New()
	reached := false
	router.POST("/v1/images/generations", func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, "not-a-channel-id")
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"image-auto": true})
	}, Distribute(), func(c *gin.Context) {
		reached = true
		_, hasChannel := common.GetContextKey(c, constant.ContextKeyChannelId)
		assert.False(t, hasChannel)
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(`{"model":"image-auto"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.True(t, reached)
	assert.Equal(t, http.StatusNoContent, response.Code)
}

func TestDistributorImageAutoStillEnforcesTokenModelLimit(t *testing.T) {
	assert.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	router := gin.New()
	reached := false
	router.POST("/v1/images/generations", func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"other-model": true})
	}, Distribute(), func(c *gin.Context) {
		reached = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(`{"model":"image-auto"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.False(t, reached)
	assert.Equal(t, http.StatusForbidden, response.Code)
}

func TestGetModelRequestReadsStudioImageEditMultipartModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	assert.NoError(t, writer.WriteField("model", "image-auto"))
	assert.NoError(t, writer.WriteField("prompt", "edit this image"))
	file, err := writer.CreateFormFile("image", "source.png")
	assert.NoError(t, err)
	_, err = file.Write([]byte("image-bytes"))
	assert.NoError(t, err)
	assert.NoError(t, writer.Close())

	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/studio/images/edits", body)
	context.Request.Header.Set("Content-Type", writer.FormDataContentType())

	request, shouldSelectChannel, err := getModelRequest(context)

	assert.NoError(t, err)
	assert.True(t, shouldSelectChannel)
	assert.Equal(t, "image-auto", request.Model)
}

func TestSetupContextForSelectedChannelClearsRetryOnlyMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	common.SetContextKey(context, constant.ContextKeyChannelOrganization, "stale-org")
	common.SetContextKey(context, constant.ContextKeyChannelIsMultiKey, true)
	common.SetContextKey(context, constant.ContextKeyChannelMultiKeyIndex, 9)
	context.Set("api_version", "stale-version")
	context.Set("region", "stale-region")
	context.Set("plugin", "stale-plugin")
	context.Set("bot_id", "stale-bot")

	require.Nil(t, SetupContextForSelectedChannel(context, &model.Channel{Id: 15, Type: constant.ChannelTypeOpenAI, Key: "key-c"}, "image-auto"))
	require.Empty(t, common.GetContextKeyString(context, constant.ContextKeyChannelOrganization))
	require.False(t, common.GetContextKeyBool(context, constant.ContextKeyChannelIsMultiKey))
	require.Zero(t, common.GetContextKeyInt(context, constant.ContextKeyChannelMultiKeyIndex))
	require.Empty(t, context.GetString("api_version"))
	require.Empty(t, context.GetString("region"))
	require.Empty(t, context.GetString("plugin"))
	require.Empty(t, context.GetString("bot_id"))
}

func TestSetupContextForSelectedChannelKeepsCurrentOrganization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	organization := "current-org"

	require.Nil(t, SetupContextForSelectedChannel(context, &model.Channel{
		Id: 36, Type: constant.ChannelTypeOpenAI, Key: "key-alt", OpenAIOrganization: &organization,
	}, "image-auto"))
	require.Equal(t, organization, common.GetContextKeyString(context, constant.ContextKeyChannelOrganization))
}
