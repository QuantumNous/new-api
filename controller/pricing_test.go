package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGuestPricingUsesDefaultGroupWhenSelectableGroupsEmpty(t *testing.T) {
	originalUserUsableGroups := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUserUsableGroups))
	})

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	group := getPricingUserGroup(ctx)
	require.Equal(t, "default", group)

	usableGroup := service.GetUserUsableGroups(group)
	require.Contains(t, usableGroup, "default")

	pricing := []model.Pricing{
		{ModelName: "default-model", EnableGroup: []string{"default"}},
		{ModelName: "vip-model", EnableGroup: []string{"vip"}},
		{ModelName: "all-model", EnableGroup: []string{"all"}},
	}

	filtered := filterPricingByUsableGroups(pricing, usableGroup)
	names := make([]string, 0, len(filtered))
	for _, item := range filtered {
		names = append(names, item.ModelName)
	}

	require.ElementsMatch(t, []string{"default-model", "all-model"}, names)
}
