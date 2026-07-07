package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestFilterPricingByUsableGroupsPrunesEnableGroups(t *testing.T) {
	usableGroup := map[string]string{
		"default": "Default",
		"vip":     "VIP",
	}
	pricing := []model.Pricing{
		{ModelName: "mixed", EnableGroup: []string{"default", "internal", "vip"}},
		{ModelName: "hidden", EnableGroup: []string{"internal"}},
		{ModelName: "all", EnableGroup: []string{"all"}},
	}

	filtered := filterPricingByUsableGroups(pricing, usableGroup)

	require.Len(t, filtered, 2)
	require.Equal(t, "mixed", filtered[0].ModelName)
	require.Equal(t, []string{"default", "vip"}, filtered[0].EnableGroup)
	require.Equal(t, "all", filtered[1].ModelName)
	require.Equal(t, []string{"default", "vip"}, filtered[1].EnableGroup)
}

func TestWebsitePricingJSONUsesCache(t *testing.T) {
	previousBuilder := buildWebsitePricingPayload
	previousNow := websitePricingNow
	previousTTL := websitePricingCacheTTL
	t.Cleanup(func() {
		buildWebsitePricingPayload = previousBuilder
		websitePricingNow = previousNow
		websitePricingCacheTTL = previousTTL
		websitePricingCache.Lock()
		websitePricingCache.body = nil
		websitePricingCache.expiresAt = time.Time{}
		websitePricingCache.Unlock()
	})

	now := time.Unix(100, 0)
	websitePricingNow = func() time.Time { return now }
	websitePricingCacheTTL = time.Minute
	websitePricingCache.Lock()
	websitePricingCache.body = nil
	websitePricingCache.expiresAt = time.Time{}
	websitePricingCache.Unlock()

	buildCount := 0
	buildWebsitePricingPayload = func() gin.H {
		buildCount++
		return gin.H{"success": true, "data": []string{"cached"}}
	}

	first, err := getCachedWebsitePricingJSON()
	require.NoError(t, err)
	second, err := getCachedWebsitePricingJSON()
	require.NoError(t, err)

	require.JSONEq(t, string(first), string(second))
	require.Equal(t, 1, buildCount)
}

func TestGetWebsitePricingRejectsUnsupportedExplicitGroupBeforeCache(t *testing.T) {
	previousBuilder := buildWebsitePricingPayload
	t.Cleanup(func() {
		buildWebsitePricingPayload = previousBuilder
	})

	buildWebsitePricingPayload = func() gin.H {
		t.Fatal("default cached pricing builder must not run for unsupported explicit groups")
		return nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/website/pricing?group=company-employees", nil)

	GetWebsitePricing(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.JSONEq(t, `{"success":false,"message":"unsupported website pricing group"}`, recorder.Body.String())
}

func TestGetWebsitePricingFailsClosedWhenPublicGroupRatioMissing(t *testing.T) {
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio))
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/website/pricing?group=plg", nil)

	GetWebsitePricing(ctx)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.JSONEq(t, `{"success":false,"message":"public website group is not configured"}`, recorder.Body.String())
}

func TestBuildWebsitePublicGroupPricingPayloadIncludesHiddenPLGOnly(t *testing.T) {
	pricing := []model.Pricing{
		{ModelName: "plg-model", EnableGroup: []string{"plg", "vip"}},
		{ModelName: "all-model", EnableGroup: []string{"all"}},
		{ModelName: "enterprise-only", EnableGroup: []string{"company-employees"}},
	}

	payload := buildWebsitePublicGroupPricingPayload(pricing, nil, nil, nil, "plg", 0.9)
	body, err := common.Marshal(payload)
	require.NoError(t, err)

	require.JSONEq(t, `{
		"success": true,
		"data": [
			{"model_name":"plg-model","quota_type":0,"model_ratio":0,"model_price":0,"owner_by":"","completion_ratio":0,"enable_groups":["plg"],"supported_endpoint_types":null},
			{"model_name":"all-model","quota_type":0,"model_ratio":0,"model_price":0,"owner_by":"","completion_ratio":0,"enable_groups":["plg"],"supported_endpoint_types":null}
		],
		"vendors": null,
		"group_ratio": {"plg": 0.9},
		"usable_group": {"plg": "plg"},
		"supported_endpoint": null,
		"auto_groups": null,
		"pricing_version": "website-public-plg-v1"
	}`, string(body))
}
