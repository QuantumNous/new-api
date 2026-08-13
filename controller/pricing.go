package controller

import (
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

var (
	websitePricingCacheTTL = 5 * time.Minute
	websitePricingNow      = time.Now
	websitePricingCache    = struct {
		sync.RWMutex
		body      []byte
		expiresAt time.Time
	}{}
	buildWebsitePricingPayload = buildWebsitePricingPayloadDefault
	buildWebsiteDisplayPricing = service.BuildWebsiteDisplayPricing
	getPricingModels           = model.GetPricing
	getPricingVendors          = model.GetVendors
	getSupportedEndpointMap    = model.GetSupportedEndpointMap
)

func init() {
	operation_setting.OnPricingVisibilityChanged(InvalidateWebsitePricingCache)
}

// filterHiddenPricingModels 按后台配置的隐藏名单过滤定价列表。
// 只影响定价接口的展示，不影响模型可用性与实际调用。
func filterHiddenPricingModels(pricing []model.Pricing) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(operation_setting.GetPricingHiddenModelPatterns()) == 0 {
		return pricing
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		if operation_setting.IsPricingHiddenModel(item.ModelName) {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func getSortedUsableGroupNames(usableGroup map[string]string) []string {
	groups := make([]string, 0, len(usableGroup))
	for group := range usableGroup {
		if group != "" {
			groups = append(groups, group)
		}
	}
	sort.Strings(groups)
	return groups
}

func filterEnableGroupsByUsableGroups(enableGroups []string, usableGroup map[string]string, usableGroupNames []string) []string {
	if common.StringsContains(enableGroups, "all") {
		return append([]string(nil), usableGroupNames...)
	}

	groups := make([]string, 0, len(enableGroups))
	seen := make(map[string]struct{}, len(enableGroups))
	for _, group := range enableGroups {
		if group == "" {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		if _, ok := usableGroup[group]; !ok {
			continue
		}
		seen[group] = struct{}{}
		groups = append(groups, group)
	}
	return groups
}

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	usableGroupNames := getSortedUsableGroupNames(usableGroup)
	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		enableGroups := filterEnableGroupsByUsableGroups(item.EnableGroup, usableGroup, usableGroupNames)
		if len(enableGroups) == 0 {
			continue
		}
		item.EnableGroup = enableGroups
		filtered = append(filtered, item)
	}
	return filtered
}

func filterGroupModelRatioByUsableGroupsAndModels(source map[string]map[string]float64, usableGroup map[string]string, pricing []model.Pricing) map[string]map[string]float64 {
	if len(source) == 0 || len(usableGroup) == 0 {
		return map[string]map[string]float64{}
	}
	visibleModels := make(map[string]struct{}, len(pricing))
	for _, item := range pricing {
		if item.ModelName != "" {
			visibleModels[item.ModelName] = struct{}{}
			visibleModels[ratio_setting.FormatMatchingModelName(item.ModelName)] = struct{}{}
		}
	}
	if len(visibleModels) == 0 {
		return map[string]map[string]float64{}
	}

	filtered := make(map[string]map[string]float64)
	for group, modelRatios := range source {
		if _, ok := usableGroup[group]; !ok || len(modelRatios) == 0 {
			continue
		}
		groupRatios := make(map[string]float64, len(modelRatios))
		for modelName, ratio := range modelRatios {
			if _, ok := visibleModels[modelName]; ok {
				groupRatios[modelName] = ratio
			}
		}
		if len(groupRatios) > 0 {
			filtered[group] = groupRatios
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}
	var group string
	if exists {
		user, err := model.GetUserCache(userId.(int))
		if err == nil {
			group = user.Group
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
				if ok {
					groupRatio[g] = ratio
				}
			}
		}
	}

	usableGroup = service.GetUserUsableGroups(group)
	pricing = filterPricingByUsableGroups(pricing, usableGroup)
	pricing = filterHiddenPricingModels(pricing)
	// check groupRatio contains usableGroup
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"group_model_ratio":  filterGroupModelRatioByUsableGroupsAndModels(ratio_setting.GetGroupModelRatioCopy(), usableGroup, pricing),
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"pricing_version":    "group-model-ratio-v1",
	})
}

func GetWebsitePricing(c *gin.Context) {
	if group := strings.TrimSpace(c.Query("group")); group != "" {
		if group != websitePublicGroup {
			c.JSON(400, gin.H{
				"success": false,
				"message": "unsupported website pricing group",
			})
			return
		}
		ratio, ok := ratio_setting.GetGroupRatioCopy()[websitePublicGroup]
		if !ok {
			c.JSON(503, gin.H{
				"success": false,
				"message": "public website group is not configured",
			})
			return
		}

		body, err := common.Marshal(buildWebsitePublicGroupPricingPayload(
			getPricingModels(),
			getPricingVendors(),
			getSupportedEndpointMap(),
			service.GetUserAutoGroup(""),
			websitePublicGroup,
			ratio,
		))
		if err != nil {
			common.ApiError(c, err)
			return
		}

		c.Header("Cache-Control", "no-store")
		c.Data(200, "application/json; charset=utf-8", body)
		return
	}

	body, err := getCachedWebsitePricingJSON()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.Header("Cache-Control", "no-store, max-age=0")
	c.Data(200, "application/json; charset=utf-8", body)
}

func InvalidateWebsitePricingCache() {
	websitePricingCache.Lock()
	defer websitePricingCache.Unlock()

	websitePricingCache.body = nil
	websitePricingCache.expiresAt = time.Time{}
}

func getCachedWebsitePricingJSON() ([]byte, error) {
	now := websitePricingNow()

	websitePricingCache.RLock()
	if len(websitePricingCache.body) > 0 && now.Before(websitePricingCache.expiresAt) {
		body := append([]byte(nil), websitePricingCache.body...)
		websitePricingCache.RUnlock()
		return body, nil
	}
	websitePricingCache.RUnlock()

	websitePricingCache.Lock()
	defer websitePricingCache.Unlock()

	now = websitePricingNow()
	if len(websitePricingCache.body) > 0 && now.Before(websitePricingCache.expiresAt) {
		return append([]byte(nil), websitePricingCache.body...), nil
	}

	body, err := common.Marshal(buildWebsitePricingPayload())
	if err != nil {
		return nil, err
	}
	websitePricingCache.body = append([]byte(nil), body...)
	websitePricingCache.expiresAt = now.Add(websitePricingCacheTTL)
	return append([]byte(nil), body...), nil
}

func buildWebsitePricingPayloadDefault() gin.H {
	pricing := getPricingModels()
	usableGroup := service.GetUserUsableGroups("")
	filteredPricing := filterHiddenPricingModels(filterPricingByUsableGroups(pricing, usableGroup))
	filteredPricing = applyWebsiteFeaturedOrder(filteredPricing, getWebsiteFeaturedModelNames())
	groupRatio := map[string]float64{}
	for group, ratio := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; ok {
			groupRatio[group] = ratio
		}
	}

	return gin.H{
		"success":            true,
		"data":               filteredPricing,
		"vendors":            getPricingVendors(),
		"group_ratio":        groupRatio,
		"group_model_ratio":  filterGroupModelRatioByUsableGroupsAndModels(ratio_setting.GetGroupModelRatioCopy(), usableGroup, filteredPricing),
		"usable_group":       usableGroup,
		"supported_endpoint": getSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(""),
		"display_pricing":    buildWebsiteDisplayPricingOrEmpty(filteredPricing, websitePublicGroup),
		"pricing_version":    "website-public-v2",
	}
}

func buildWebsiteDisplayPricingOrEmpty(pricing []model.Pricing, group string) map[string]service.WebsiteDisplayPricing {
	displayPricing, err := buildWebsiteDisplayPricing(pricing, group)
	if err != nil {
		common.SysError("failed to build website display pricing: " + err.Error())
		return map[string]service.WebsiteDisplayPricing{}
	}
	return displayPricing
}

func buildWebsitePublicGroupPricingPayload(
	pricing []model.Pricing,
	vendors []model.PricingVendor,
	supportedEndpoint map[string]common.EndpointInfo,
	autoGroups []string,
	group string,
	ratio float64,
) gin.H {
	description := setting.GetUsableGroupDescription(group)
	if strings.TrimSpace(description) == "" {
		description = group
	}
	usableGroup := map[string]string{group: description}
	visiblePricing := filterHiddenPricingModels(filterPricingByUsableGroups(pricing, usableGroup))
	visiblePricing = applyWebsiteFeaturedOrder(visiblePricing, getWebsiteFeaturedModelNames())

	return gin.H{
		"success":     true,
		"data":        visiblePricing,
		"vendors":     vendors,
		"group_ratio": map[string]float64{group: ratio},
		// Per-model overrides beat the flat group ratio during billing
		// (ratio_setting.GetEffectiveGroupRatio), so the public payload has to
		// carry them too — otherwise a model priced below the group ratio is
		// quoted higher than it is actually charged.
		"group_model_ratio":  filterGroupModelRatioByUsableGroupsAndModels(ratio_setting.GetGroupModelRatioCopy(), usableGroup, visiblePricing),
		"usable_group":       usableGroup,
		"supported_endpoint": supportedEndpoint,
		"auto_groups":        autoGroups,
		"display_pricing":    buildWebsiteDisplayPricingOrEmpty(visiblePricing, group),
		"pricing_version":    "website-public-plg-v2",
	}
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
