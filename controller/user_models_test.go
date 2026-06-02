package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type userModelsResponse struct {
	Success bool     `json:"success"`
	Data    []string `json:"data"`
}

func decodeUserModelsResponse(t *testing.T, recorder *httptest.ResponseRecorder) []string {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	return payload.Data
}

func requestUserModels(t *testing.T, target string, userId int) []string {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	ctx.Set("id", userId)

	GetUserModels(ctx)

	return decodeUserModelsResponse(t, recorder)
}

func TestGetUserModelsFiltersByGroup(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	originalUserGroups := setting.UserUsableGroups2JSONString()
	originalAutoGroups := setting.AutoGroups2JsonString()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUserGroups))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
	})

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{
		"default": "Default group",
		"vip": "VIP group",
		"auto": "Auto group"
	}`))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default","vip"]`))

	require.NoError(t, db.Create(&model.User{
		Id:       3001,
		Username: "playground-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "default-model", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "shared-model", ChannelId: 1, Enabled: true},
		{Group: "vip", Model: "vip-model", ChannelId: 2, Enabled: true},
		{Group: "vip", Model: "shared-model", ChannelId: 2, Enabled: true},
		{Group: "blocked", Model: "blocked-model", ChannelId: 3, Enabled: true},
		{Group: "default", Model: "disabled-model", ChannelId: 4, Enabled: false},
	}).Error)

	require.ElementsMatch(t, []string{"default-model", "shared-model"}, requestUserModels(t, "/api/user/models?group=default", 3001))
	require.ElementsMatch(t, []string{"vip-model", "shared-model"}, requestUserModels(t, "/api/user/models?group=vip", 3001))
	require.ElementsMatch(t, []string{"default-model", "shared-model", "vip-model"}, requestUserModels(t, "/api/user/models?group=auto", 3001))
	require.Empty(t, requestUserModels(t, "/api/user/models?group=blocked", 3001))
	require.ElementsMatch(t, []string{"default-model", "shared-model", "vip-model"}, requestUserModels(t, "/api/user/models", 3001))
}
