package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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
		"group_model_ratio": {},
		"usable_group": {"plg": "plg"},
		"supported_endpoint": null,
		"auto_groups": null,
		"display_pricing": {
			"plg-model": {"billing_kind":"token","prices":{"input":{"configured":"0","plg":"0"},"output":{"configured":"0","plg":"0"}}},
			"all-model": {"billing_kind":"token","prices":{"input":{"configured":"0","plg":"0"},"output":{"configured":"0","plg":"0"}}}
		},
		"pricing_version": "website-public-plg-v2"
	}`, string(body))
}

func withHiddenPricingModels(t *testing.T, value string) {
	t.Helper()
	setting := operation_setting.GetPricingVisibilitySetting()
	previous := setting.HiddenModels
	t.Cleanup(func() { setting.HiddenModels = previous })
	setting.HiddenModels = value
}

func TestFilterHiddenPricingModels(t *testing.T) {
	withHiddenPricingModels(t, "gpt-4o, *-internal , secret*")

	pricing := []model.Pricing{
		{ModelName: "gpt-4o"},
		{ModelName: "gpt-4o-mini"},
		{ModelName: "foo-internal"},
		{ModelName: "secret-model"},
		{ModelName: "claude-opus-4-8"},
	}

	filtered := filterHiddenPricingModels(pricing)

	require.Len(t, filtered, 2)
	require.Equal(t, "gpt-4o-mini", filtered[0].ModelName)
	require.Equal(t, "claude-opus-4-8", filtered[1].ModelName)
}

func TestFilterHiddenPricingModelsNoConfigKeepsAll(t *testing.T) {
	withHiddenPricingModels(t, "")

	pricing := []model.Pricing{{ModelName: "gpt-4o"}, {ModelName: "claude-opus-4-8"}}

	require.Len(t, filterHiddenPricingModels(pricing), 2)
}

func TestFilterHiddenPricingModelsDoesNotMutateInput(t *testing.T) {
	withHiddenPricingModels(t, "gpt-4o")

	pricing := []model.Pricing{{ModelName: "gpt-4o"}, {ModelName: "claude-opus-4-8"}}

	filterHiddenPricingModels(pricing)

	require.Len(t, pricing, 2)
	require.Equal(t, "gpt-4o", pricing[0].ModelName)
}

func withGroupModelRatio(t *testing.T, value string) {
	t.Helper()
	previous := ratio_setting.GroupModelRatio2JSONString()
	t.Cleanup(func() {
		_ = ratio_setting.UpdateGroupModelRatioByJSONString(previous)
	})
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(value))
}

func withGroupRatio(t *testing.T, value string) {
	t.Helper()
	previous := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previous))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(value))
}

// The public PLG payload must expose per-model group ratios. Without them the
// website falls back to the flat plg ratio and quotes a price the user does
// not actually pay when a model is configured cheaper for plg.
func TestBuildWebsitePublicGroupPricingPayloadExposesGroupModelRatio(t *testing.T) {
	withGroupModelRatio(t, `{"plg":{"glm-5":0.6,"hidden-elsewhere":0.5},"vip":{"glm-5":0.4}}`)

	pricing := []model.Pricing{
		{ModelName: "glm-5", EnableGroup: []string{"plg"}},
		{ModelName: "gpt-4o", EnableGroup: []string{"plg"}},
	}

	payload := buildWebsitePublicGroupPricingPayload(pricing, nil, nil, nil, "plg", 0.9)

	groupModelRatio, ok := payload["group_model_ratio"].(map[string]map[string]float64)
	require.True(t, ok, "group_model_ratio must be present")
	require.Equal(t, map[string]map[string]float64{
		"plg": {"glm-5": 0.6},
	}, groupModelRatio)
}

func TestBuildWebsitePublicGroupPricingPayloadOmitsHiddenModelRatios(t *testing.T) {
	withGroupModelRatio(t, `{"plg":{"glm-5":0.6,"secret-model":0.3}}`)
	withHiddenPricingModels(t, "secret-model")

	pricing := []model.Pricing{
		{ModelName: "glm-5", EnableGroup: []string{"plg"}},
		{ModelName: "secret-model", EnableGroup: []string{"plg"}},
	}

	payload := buildWebsitePublicGroupPricingPayload(pricing, nil, nil, nil, "plg", 0.9)

	require.Equal(t, map[string]map[string]float64{
		"plg": {"glm-5": 0.6},
	}, payload["group_model_ratio"])
}

func withWebsiteDisplayPricingBuilder(
	t *testing.T,
	builder func([]model.Pricing, string) (map[string]service.WebsiteDisplayPricing, error),
) {
	t.Helper()
	previous := buildWebsiteDisplayPricing
	t.Cleanup(func() {
		buildWebsiteDisplayPricing = previous
	})
	buildWebsiteDisplayPricing = builder
}

func withWebsitePricingModelSources(t *testing.T, pricing []model.Pricing) {
	t.Helper()
	previousPricingModels := getPricingModels
	previousPricingVendors := getPricingVendors
	previousSupportedEndpointMap := getSupportedEndpointMap
	t.Cleanup(func() {
		getPricingModels = previousPricingModels
		getPricingVendors = previousPricingVendors
		getSupportedEndpointMap = previousSupportedEndpointMap
	})
	getPricingModels = func() []model.Pricing {
		return append([]model.Pricing(nil), pricing...)
	}
	getPricingVendors = func() []model.PricingVendor {
		return []model.PricingVendor{{ID: 7, Name: "Vendor"}}
	}
	getSupportedEndpointMap = func() map[string]common.EndpointInfo {
		return map[string]common.EndpointInfo{"chat": {Path: "/v1/chat/completions", Method: http.MethodPost}}
	}
}

func withUserUsableGroups(t *testing.T, value string) {
	t.Helper()
	previous := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previous))
	})
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(value))
}

func TestBuildWebsitePublicGroupPricingPayloadIncludesDisplayPricingForVisibleModels(t *testing.T) {
	withHiddenPricingModels(t, "hidden-model")

	pricing := []model.Pricing{
		{ModelName: "visible-model", EnableGroup: []string{"plg"}},
		{ModelName: "hidden-model", EnableGroup: []string{"plg"}},
		{ModelName: "other-group-model", EnableGroup: []string{"vip"}},
	}
	expectedDisplayPricing := map[string]service.WebsiteDisplayPricing{
		"visible-model": {BillingKind: "request"},
	}
	var capturedPricing []model.Pricing
	var capturedGroup string
	withWebsiteDisplayPricingBuilder(t, func(pricing []model.Pricing, group string) (map[string]service.WebsiteDisplayPricing, error) {
		capturedPricing = append([]model.Pricing(nil), pricing...)
		capturedGroup = group
		return expectedDisplayPricing, nil
	})

	payload := buildWebsitePublicGroupPricingPayload(pricing, nil, nil, nil, "plg", 0.9)

	require.Equal(t, "plg", capturedGroup)
	require.Equal(t, []model.Pricing{{ModelName: "visible-model", EnableGroup: []string{"plg"}}}, capturedPricing)
	require.Equal(t, expectedDisplayPricing, payload["display_pricing"])
	require.Contains(t, payload, "data")
	require.Contains(t, payload, "group_ratio")
	require.Contains(t, payload, "group_model_ratio")
	require.Contains(t, payload, "pricing_version")
}

func TestBuildWebsitePricingPayloadDefaultIncludesDisplayPricingForVisibleModels(t *testing.T) {
	withGroupRatio(t, `{"default":1,"plg":0.9}`)
	withUserUsableGroups(t, `{"default":"Default","plg":"PLG"}`)
	withHiddenPricingModels(t, "hidden-model")
	withWebsitePricingModelSources(t, []model.Pricing{
		{ModelName: "captured-model", EnableGroup: []string{"plg", "vip"}},
		{ModelName: "all-model", EnableGroup: []string{"all"}},
		{ModelName: "hidden-model", EnableGroup: []string{"plg"}},
		{ModelName: "other-group-model", EnableGroup: []string{"vip"}},
	})

	expectedDisplayPricing := map[string]service.WebsiteDisplayPricing{
		"captured-model": {BillingKind: "token"},
	}
	var capturedPricing []model.Pricing
	var capturedGroup string
	withWebsiteDisplayPricingBuilder(t, func(pricing []model.Pricing, group string) (map[string]service.WebsiteDisplayPricing, error) {
		capturedPricing = append([]model.Pricing(nil), pricing...)
		capturedGroup = group
		return expectedDisplayPricing, nil
	})

	payload := buildWebsitePricingPayloadDefault()

	require.Equal(t, websitePublicGroup, capturedGroup)
	require.Equal(t, payload["data"], capturedPricing)
	require.Equal(t, []model.Pricing{
		{ModelName: "captured-model", EnableGroup: []string{"plg"}},
		{ModelName: "all-model", EnableGroup: []string{"default", "plg"}},
	}, capturedPricing)
	require.Equal(t, expectedDisplayPricing, payload["display_pricing"])
	require.Contains(t, payload, "data")
	require.Contains(t, payload, "group_ratio")
	require.Contains(t, payload, "group_model_ratio")
	require.Contains(t, payload, "pricing_version")
}

func TestBuildWebsitePublicGroupPricingPayloadKeepsLegacyFieldsWhenDisplayPricingFails(t *testing.T) {
	pricing := []model.Pricing{
		{ModelName: "visible-model", EnableGroup: []string{"plg"}},
	}
	withWebsiteDisplayPricingBuilder(t, func([]model.Pricing, string) (map[string]service.WebsiteDisplayPricing, error) {
		return nil, errors.New("display builder failed")
	})

	payload := buildWebsitePublicGroupPricingPayload(pricing, nil, nil, nil, "plg", 0.9)

	require.Equal(t, map[string]service.WebsiteDisplayPricing{}, payload["display_pricing"])
	require.Contains(t, payload, "data")
	require.Contains(t, payload, "group_ratio")
	require.Contains(t, payload, "group_model_ratio")
	require.Contains(t, payload, "pricing_version")
}
