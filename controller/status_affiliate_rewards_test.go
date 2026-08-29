package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetStatusIncludesAffiliateRewardsEnabled(t *testing.T) {
	originalEnabled := common.AffiliateRewardsEnabled
	originalOptionMap := common.OptionMap
	t.Cleanup(func() {
		common.AffiliateRewardsEnabled = originalEnabled
		common.OptionMap = originalOptionMap
	})

	common.AffiliateRewardsEnabled = false
	common.OptionMap = map[string]string{
		"HeaderNavModules":    "[]",
		"SidebarModulesAdmin": "[]",
	}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(context)

	require.Equal(t, http.StatusOK, recorder.Code)

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			AffiliateRewardsEnabled bool `json:"affiliate_rewards_enabled"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	assert.False(t, payload.Data.AffiliateRewardsEnabled)
}

func TestGetTopUpInfoIncludesAffiliateRewardsEnabled(t *testing.T) {
	originalEnabled := common.AffiliateRewardsEnabled
	t.Cleanup(func() {
		common.AffiliateRewardsEnabled = originalEnabled
	})

	common.AffiliateRewardsEnabled = false

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)

	GetTopUpInfo(context)

	require.Equal(t, http.StatusOK, recorder.Code)

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			AffiliateRewardsEnabled bool `json:"affiliate_rewards_enabled"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	assert.False(t, payload.Data.AffiliateRewardsEnabled)
}
