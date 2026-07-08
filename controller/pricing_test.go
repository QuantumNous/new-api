package controller

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
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

func TestFilterGroupModelRatioByUsableGroupsAndModels(t *testing.T) {
	source := map[string]map[string]float64{
		"default":  {"gpt-5.5": 0.3, "hidden-model": 0.1},
		"internal": {"gpt-5.5": 0.2},
		"empty":    {},
	}
	usableGroup := map[string]string{
		"default": "Default",
	}
	pricing := []model.Pricing{
		{ModelName: "gpt-5.5", EnableGroup: []string{"default"}},
	}

	filtered := filterGroupModelRatioByUsableGroupsAndModels(source, usableGroup, pricing)

	require.Equal(t, map[string]map[string]float64{
		"default": {"gpt-5.5": 0.3},
	}, filtered)
}

func TestFilteredPricingDrivesVisibleGroupModelRatio(t *testing.T) {
	source := map[string]map[string]float64{
		"default": {
			"visible-model": 0.3,
			"hidden-model":  0.2,
		},
	}
	usableGroup := map[string]string{
		"default": "Default",
	}
	rawPricing := []model.Pricing{
		{ModelName: "visible-model", EnableGroup: []string{"default"}},
		{ModelName: "hidden-model", EnableGroup: []string{"internal"}},
	}
	filteredPricing := filterPricingByUsableGroups(rawPricing, usableGroup)

	filtered := filterGroupModelRatioByUsableGroupsAndModels(source, usableGroup, filteredPricing)

	require.Equal(t, map[string]map[string]float64{
		"default": {"visible-model": 0.3},
	}, filtered)
}

func TestPricingDisplayOptionKeysIncludeBillingSettings(t *testing.T) {
	require.True(t, isPricingDisplayOptionKey("billing_setting.billing_mode"))
	require.True(t, isPricingDisplayOptionKey("billing_setting.billing_expr"))
	require.True(t, isPricingDisplayOptionKey("UserUsableGroups"))
	require.False(t, isPricingDisplayOptionKey("billing_setting.model_billing_mode"))
	require.False(t, isPricingDisplayOptionKey("billing_setting.model_billing_expr"))
}

func TestWebsitePricingJSONUsesCache(t *testing.T) {
	previousBuilder := buildWebsitePricingPayload
	previousNow := websitePricingNow
	previousTTL := websitePricingCacheTTL
	t.Cleanup(func() {
		buildWebsitePricingPayload = previousBuilder
		websitePricingNow = previousNow
		websitePricingCacheTTL = previousTTL
		InvalidateWebsitePricingCache()
	})

	now := time.Unix(100, 0)
	websitePricingNow = func() time.Time { return now }
	websitePricingCacheTTL = time.Minute
	InvalidateWebsitePricingCache()

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

func TestInvalidateWebsitePricingCacheClearsCachedPayload(t *testing.T) {
	previousBuilder := buildWebsitePricingPayload
	previousNow := websitePricingNow
	previousTTL := websitePricingCacheTTL
	t.Cleanup(func() {
		buildWebsitePricingPayload = previousBuilder
		websitePricingNow = previousNow
		websitePricingCacheTTL = previousTTL
		InvalidateWebsitePricingCache()
	})

	now := time.Unix(100, 0)
	websitePricingNow = func() time.Time { return now }
	websitePricingCacheTTL = time.Hour
	InvalidateWebsitePricingCache()

	buildWebsitePricingPayload = func() gin.H {
		return gin.H{"version": "old"}
	}
	first, err := getCachedWebsitePricingJSON()
	require.NoError(t, err)

	buildWebsitePricingPayload = func() gin.H {
		return gin.H{"version": "new"}
	}
	second, err := getCachedWebsitePricingJSON()
	require.NoError(t, err)
	require.JSONEq(t, string(first), string(second))

	InvalidateWebsitePricingCache()
	third, err := getCachedWebsitePricingJSON()
	require.NoError(t, err)
	require.Contains(t, string(third), "new")
}

func TestGetWebsitePricingDisablesHTTPCache(t *testing.T) {
	previousBuilder := buildWebsitePricingPayload
	t.Cleanup(func() {
		buildWebsitePricingPayload = previousBuilder
		InvalidateWebsitePricingCache()
	})
	InvalidateWebsitePricingCache()
	buildWebsitePricingPayload = func() gin.H {
		return gin.H{"success": true}
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	GetWebsitePricing(ctx)

	require.Equal(t, "no-store, max-age=0", recorder.Header().Get("Cache-Control"))
}
