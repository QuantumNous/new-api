package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestManagedUpstreamRouteAPIExposesEffectiveModels(t *testing.T) {
	originalDB := model.DB
	t.Cleanup(func() {
		model.DB = originalDB
	})
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(
		&model.Channel{},
		&model.UpstreamManagedRoute{},
	))
	model.DB = database

	channel := model.Channel{
		Name:   "effective-route",
		Key:    "fixture-key",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "actual-model,shared-model",
	}
	require.NoError(t, database.Create(&channel).Error)
	require.NoError(t, database.Create(&model.UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "group",
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       channel.Id,
		State:           model.UpstreamRouteStateActive,
	}).Error)

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	ListUpstreamOrchestrationRoutes(context)

	var response struct {
		Success bool `json:"success"`
		Data    []struct {
			ChannelID       int      `json:"channel_id"`
			EffectiveModels []string `json:"effective_models"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data, 1)
	assert.Equal(t, channel.Id, response.Data[0].ChannelID)
	assert.Equal(t, []string{"actual-model", "shared-model"}, response.Data[0].EffectiveModels)
}
