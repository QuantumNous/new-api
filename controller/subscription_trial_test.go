package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetSubscriptionPlansExcludesGPTTrial(t *testing.T) {
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}))

	trial := model.SubscriptionPlan{
		Id:          701,
		Title:       "APIMaster $20 GPT Trial",
		TotalAmount: 100,
		Enabled:     true,
	}
	standard := model.SubscriptionPlan{
		Id:          702,
		Title:       "Standard plan",
		PlanType:    model.SubscriptionPlanTypeStandard,
		TotalAmount: 100,
		Enabled:     true,
	}
	require.NoError(t, db.Create(&trial).Error)
	require.NoError(t, db.Create(&standard).Error)

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/plans", nil)
	GetSubscriptionPlans(context)

	var response struct {
		Success bool                  `json:"success"`
		Data    []SubscriptionPlanDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data, 1)
	require.Equal(t, standard.Id, response.Data[0].Plan.Id)
}

func TestAdminListSubscriptionPlansLabelsLegacyGPTTrial(t *testing.T) {
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}))

	legacyTrial := model.SubscriptionPlan{
		Id:          703,
		Title:       "APIMaster $20 GPT Trial",
		TotalAmount: 100,
		Enabled:     true,
	}
	require.NoError(t, db.Create(&legacyTrial).Error)

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/admin/plans", nil)
	AdminListSubscriptionPlans(context)

	var response struct {
		Success bool                  `json:"success"`
		Data    []SubscriptionPlanDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data, 1)
	require.Equal(t, model.SubscriptionPlanTypeGPTTrial, response.Data[0].Plan.PlanType)
}
