package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestBuildUserModelOptionsAddsImageGenerationEndpointByModelRule(t *testing.T) {
	options := buildUserModelOptions([]string{
		"gpt-image-1",
		"gpt-image-2",
		"grok-imagine-image",
		"grok-imagine-image-pro",
		"grok-2-image-1212",
		"grok-imagine-video",
		"gpt-4o-mini",
	})

	require.Len(t, options, 7)
	require.Equal(t, "gpt-image-1", options[0].Value)
	require.Contains(t, options[0].SupportedEndpointTypes, "image-generation")
	require.Equal(t, "gpt-image-2", options[1].Value)
	require.Contains(t, options[1].SupportedEndpointTypes, "image-generation")
	require.Equal(t, "grok-imagine-image", options[2].Value)
	require.Contains(t, options[2].SupportedEndpointTypes, "image-generation")
	require.Equal(t, "grok-imagine-image-pro", options[3].Value)
	require.Contains(t, options[3].SupportedEndpointTypes, "image-generation")
	require.Equal(t, "grok-2-image-1212", options[4].Value)
	require.Contains(t, options[4].SupportedEndpointTypes, "image-generation")
	require.Equal(t, "grok-imagine-video", options[5].Value)
	require.NotContains(t, options[5].SupportedEndpointTypes, "image-generation")
	require.Equal(t, "gpt-4o-mini", options[6].Value)
	require.NotContains(t, options[6].SupportedEndpointTypes, "image-generation")
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
