package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestBuildUserModelOptionsAddsImageGenerationEndpointByModelRule(t *testing.T) {
	options := buildUserModelOptions([]string{
		"gpt-image-1",
		"gpt-image-2",
		"grok-imagine-image",
		"grok-imagine-image-lite",
		"grok-imagine-image-pro",
		"grok-2-image-1212",
		"grok-imagine-image-edit",
		"grok-imagine-video",
		"gpt-4o-mini",
	})

	require.Len(t, options, 2)
	require.Equal(t, "gpt-image-1", options[0].Value)
	require.Contains(t, options[0].SupportedEndpointTypes, "image-generation")
	require.Equal(t, "gpt-image-2", options[1].Value)
	require.Contains(t, options[1].SupportedEndpointTypes, "image-generation")
}

func TestBuildUserModelOptionsAddsGrokImageGenerationEndpointFromXAIChannel(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	model.InvalidatePricingCache()
	require.NoError(t, db.Create(&model.Channel{
		Id:     48,
		Type:   constant.ChannelTypeXai,
		Status: common.ChannelStatusEnabled,
		Models: "grok-imagine-image-lite",
		Group:  "default",
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "grok-imagine-image-lite",
		ChannelId: 48,
		Enabled:   true,
	}).Error)
	model.GetPricing()

	options := buildUserModelOptions([]string{"grok-imagine-image-lite"})

	require.Len(t, options, 1)
	require.Equal(t, "grok-imagine-image-lite", options[0].Value)
	require.Contains(t, options[0].SupportedEndpointTypes, "image-generation")
	require.NotContains(t, options[0].SupportedEndpointTypes, "openai")
	require.NotContains(t, options[0].SupportedEndpointTypes, "openai-response")
}

func TestGetUserModelsWithEndpointTypesSkipsGrokImageFromOpenAIChannel(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	model.InvalidatePricingCache()
	require.NoError(t, db.Create(&model.User{
		Id:       2003,
		Username: "user-models-grok-openai",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id:     2,
		Type:   constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled,
		Models: "grok-imagine-image-lite",
		Group:  "default",
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "grok-imagine-image-lite",
		ChannelId: 2,
		Enabled:   true,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/models?with_endpoint_types=true", nil)
	ctx.Set("id", 2003)

	GetUserModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload struct {
		Success bool                  `json:"success"`
		Data    []dto.UserModelOption `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Empty(t, payload.Data)
}

func TestIsImageGenerationModelExcludesGrokImageEdit(t *testing.T) {
	require.True(t, common.IsImageGenerationModel("grok-imagine-image-lite"))
	require.True(t, common.IsImageGenerationModel("grok-imagine-image-pro"))
	require.True(t, common.IsImageGenerationModel("grok-2-image-1212"))
	require.False(t, common.IsImageGenerationModel("grok-imagine-image-edit"))
	require.False(t, common.IsImageGenerationModel("grok-imagine-video"))
}

func TestNormalizeChannelTestEndpointUsesXAIImageGenerationForGrokImage(t *testing.T) {
	require.Equal(t,
		"image-generation",
		normalizeChannelTestEndpoint(&model.Channel{Type: constant.ChannelTypeXai}, "grok-imagine-image-lite", ""),
	)
	require.Equal(t,
		"",
		normalizeChannelTestEndpoint(&model.Channel{Type: constant.ChannelTypeOpenAI}, "grok-imagine-image-lite", ""),
	)
	require.Equal(t,
		"",
		normalizeChannelTestEndpoint(&model.Channel{Type: constant.ChannelTypeOpenAI}, "grok-2-image-1212", ""),
	)
	require.Equal(t,
		"image-generation",
		normalizeChannelTestEndpoint(&model.Channel{Type: constant.ChannelTypeXai}, "grok-2-image-1212", ""),
	)
	require.Equal(t,
		"image-generation",
		normalizeChannelTestEndpoint(&model.Channel{Type: constant.ChannelTypeOpenAI}, "gpt-image-2", ""),
	)
}

func TestGetUserModelsDefaultResponseRemainsStringArray(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       2001,
		Username: "user-models-default",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-image-1",
		ChannelId: 1,
		Enabled:   true,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/models", nil)
	ctx.Set("id", 2001)

	GetUserModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload struct {
		Success bool     `json:"success"`
		Data    []string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, []string{"gpt-image-1"}, payload.Data)
}

func TestGetUserModelsWithEndpointTypesReturnsModelOptions(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.User{
		Id:       2002,
		Username: "user-models-endpoints",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-image-1",
		ChannelId: 1,
		Enabled:   true,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/models?with_endpoint_types=true", nil)
	ctx.Set("id", 2002)

	GetUserModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload struct {
		Success bool `json:"success"`
		Data    []struct {
			Label                  string   `json:"label"`
			Value                  string   `json:"value"`
			SupportedEndpointTypes []string `json:"supported_endpoint_types"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Len(t, payload.Data, 1)
	require.Equal(t, "gpt-image-1", payload.Data[0].Label)
	require.Equal(t, "gpt-image-1", payload.Data[0].Value)
	require.Contains(t, payload.Data[0].SupportedEndpointTypes, "image-generation")
}
