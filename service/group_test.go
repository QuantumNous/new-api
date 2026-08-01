package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserAutoGroupForRequestFiltersFreeGroupsOnOptimizedRoute(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	groupRatios := ratio_setting.GetGroupRatioSetting().GroupRatio
	groupSpecialRatios := ratio_setting.GetGroupRatioSetting().GroupGroupRatio
	originalGroupRatios := groupRatios.ReadAll()
	originalGroupSpecialRatios := groupSpecialRatios.ReadAll()
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		groupRatios.Clear()
		groupRatios.AddAll(originalGroupRatios)
		groupSpecialRatios.Clear()
		groupSpecialRatios.AddAll(originalGroupSpecialRatios)
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})

	groupRatios.Clear()
	groupRatios.AddAll(map[string]float64{"free": 0, "paid": 1, "premium": 2})
	groupSpecialRatios.Clear()
	groupSpecialRatios.Set("sponsored", map[string]float64{"paid": 0, "premium": 0.5})
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["free","paid","premium"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"free":"Free","paid":"Paid","premium":"Premium"}`))

	ordinaryContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	assert.Equal(t, []string{"free", "paid", "premium"}, GetUserAutoGroupForRequest(ordinaryContext, "default"))

	optimizedContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(optimizedContext, constant.ContextKeyPaidOptimizedRoute, true)
	assert.Equal(t, []string{"paid", "premium"}, GetUserAutoGroupForRequest(optimizedContext, "default"))
	assert.Equal(t, []string{"premium"}, GetUserAutoGroupForRequest(optimizedContext, "sponsored"))
}
