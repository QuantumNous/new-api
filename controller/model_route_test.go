package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type modelRouteMutationResponse struct {
	Success bool   `json:"success"`
	Code    string `json:"code"`
	Data    struct {
		RequestedModel string                            `json:"requested_model"`
		Changed        []model.ModelPolicyPriorityChange `json:"changed"`
		Policies       []model.ChannelModelPolicy        `json:"policies"`
	} `json:"data"`
}

func setupModelRouteControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPolicy{}, &model.User{}, &model.Log{}))
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func performModelRouteMutation(t *testing.T, handler gin.HandlerFunc, body map[string]interface{}) (*httptest.ResponseRecorder, modelRouteMutationResponse) {
	t.Helper()
	payload, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/model_route/policies", bytes.NewReader(payload))
	handler(ctx)

	var response modelRouteMutationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return recorder, response
}

func seedControllerModelPolicies(t *testing.T, requestedModel string, priorities map[int64]int) {
	t.Helper()
	policies := make([]model.ChannelModelPolicy, 0, len(priorities))
	for channelID, priority := range priorities {
		policies = append(policies, model.ChannelModelPolicy{
			ChannelID: channelID, RequestedModel: requestedModel, ManualPriority: priority,
			Enabled: true, Source: model.PolicySourceConfigured,
		})
	}
	require.NoError(t, model.UpsertChannelModelPolicies(policies))
}

func TestUpdateModelRoutePolicyPrioritySwapsAtomically(t *testing.T) {
	db := setupModelRouteControllerTestDB(t)
	seedControllerModelPolicies(t, "gpt-priority", map[int64]int{1: 100, 2: 90})

	recorder, response := performModelRouteMutation(t, UpdateModelRoutePolicyPriority, map[string]interface{}{
		"channel_id": 2, "requested_model": "gpt-priority", "manual_priority": 100,
		"expected_manual_priority": 90, "conflict_strategy": "swap",
	})

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.True(t, response.Success)
	assert.ElementsMatch(t, []model.ModelPolicyPriorityChange{
		{ChannelID: 2, ManualPriority: 100},
		{ChannelID: 1, ManualPriority: 90},
	}, response.Data.Changed)
	require.Len(t, response.Data.Policies, 2)
	var auditCount int64
	require.NoError(t, db.Model(&model.Log{}).Where("type = ?", model.LogTypeManage).Count(&auditCount).Error)
	assert.Equal(t, int64(1), auditCount)
}

func TestUpdateModelRoutePolicyPriorityRejectsStaleSnapshot(t *testing.T) {
	setupModelRouteControllerTestDB(t)
	seedControllerModelPolicies(t, "gpt-priority", map[int64]int{1: 100, 2: 80})

	recorder, response := performModelRouteMutation(t, UpdateModelRoutePolicyPriority, map[string]interface{}{
		"channel_id": 2, "requested_model": "gpt-priority", "manual_priority": 100,
		"expected_manual_priority": 90, "conflict_strategy": "swap",
	})

	assert.Equal(t, http.StatusConflict, recorder.Code)
	assert.False(t, response.Success)
	assert.Equal(t, "stale_policy_snapshot", response.Code)
}

func TestReorderModelRoutePoliciesValidatesCompleteModelGroup(t *testing.T) {
	setupModelRouteControllerTestDB(t)
	seedControllerModelPolicies(t, "gpt-priority", map[int64]int{1: 100, 2: 90})
	seedControllerModelPolicies(t, "other-model", map[int64]int{3: 80})

	tests := []struct {
		name     string
		ordered  []int64
		expected []map[string]interface{}
	}{
		{
			name:    "duplicate id",
			ordered: []int64{1, 1},
			expected: []map[string]interface{}{
				{"channel_id": 1, "manual_priority": 100},
				{"channel_id": 2, "manual_priority": 90},
			},
		},
		{
			name:    "incomplete group",
			ordered: []int64{1},
			expected: []map[string]interface{}{
				{"channel_id": 1, "manual_priority": 100},
			},
		},
		{
			name:    "policy from another model",
			ordered: []int64{1, 3},
			expected: []map[string]interface{}{
				{"channel_id": 1, "manual_priority": 100},
				{"channel_id": 3, "manual_priority": 80},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder, response := performModelRouteMutation(t, ReorderModelRoutePolicies, map[string]interface{}{
				"requested_model": "gpt-priority", "ordered_channel_ids": test.ordered,
				"expected": test.expected, "moved_channel_id": test.ordered[0],
			})
			assert.Equal(t, http.StatusBadRequest, recorder.Code)
			assert.Equal(t, "invalid_order", response.Code)
		})
	}
}

func TestReorderModelRoutePoliciesReturnsAuthoritativeGroup(t *testing.T) {
	setupModelRouteControllerTestDB(t)
	seedControllerModelPolicies(t, "gpt-priority", map[int64]int{1: 100, 2: 90, 3: 0})

	recorder, response := performModelRouteMutation(t, ReorderModelRoutePolicies, map[string]interface{}{
		"requested_model": "gpt-priority", "ordered_channel_ids": []int64{1, 3, 2},
		"moved_channel_id": 3,
		"expected": []map[string]interface{}{
			{"channel_id": 1, "manual_priority": 100},
			{"channel_id": 2, "manual_priority": 90},
			{"channel_id": 3, "manual_priority": 0},
		},
	})

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.True(t, response.Success)
	assert.Equal(t, "gpt-priority", response.Data.RequestedModel)
	assert.Equal(t, []model.ModelPolicyPriorityChange{{ChannelID: 3, ManualPriority: 95}}, response.Data.Changed)
	require.Len(t, response.Data.Policies, 3)
	assert.Equal(t, []int64{1, 3, 2}, []int64{
		response.Data.Policies[0].ChannelID,
		response.Data.Policies[1].ChannelID,
		response.Data.Policies[2].ChannelID,
	})
}
