package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type modelStatusResponse struct {
	Model              string                  `json:"model"`
	Available          bool                    `json:"available"`
	SupportedEndpoints []constant.EndpointType `json:"supported_endpoint_types"`
	Endpoints          []modelStatusEndpoint   `json:"endpoints"`
}

func seedModelStatusTestData(t *testing.T) {
	t.Helper()

	db := setupModelListControllerTestDB(t)
	imageChannel := &model.Channel{
		Id:     7001,
		Type:   constant.ChannelTypeAzure,
		Name:   "Azure image status",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-image-2",
		Group:  "default",
		Key:    "test-key",
	}
	require.NoError(t, db.Create(imageChannel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-image-2",
		ChannelId: imageChannel.Id,
		Enabled:   true,
	}).Error)
	model.InvalidatePricingCache()
	t.Cleanup(model.InvalidatePricingCache)
}

func TestGetModelStatusReturnsEndpointCompatibility(t *testing.T) {
	seedModelStatusTestData(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models/gpt-image-2/status", nil)
	ctx.Params = gin.Params{{Key: "model", Value: "gpt-image-2"}}

	GetModelStatus(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload modelStatusResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Equal(t, "gpt-image-2", payload.Model)
	require.True(t, payload.Available)
	require.Contains(t, payload.SupportedEndpoints, constant.EndpointTypeImageGeneration)
	require.NotContains(t, payload.SupportedEndpoints, constant.EndpointTypeOpenAI)
	require.NotEmpty(t, payload.Endpoints)
	require.Equal(t, "/v1/images/generations", payload.Endpoints[0].Path)
}
