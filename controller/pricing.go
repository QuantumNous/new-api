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
	websiteMetadataCacheTTL = time.Minute
	websiteMetadataNow      = time.Now
	websiteMetadataCache    = struct {
		sync.RWMutex
		entries map[string]websiteMetadataCacheEntry
	}{entries: make(map[string]websiteMetadataCacheEntry)}
	buildWebsitePricingPayload          = buildWebsitePricingPayloadDefault
	buildWebsiteDisplayPricing          = service.BuildWebsiteDisplayPricing
	getPricingModels                    = model.GetPricing
	getPricingVendors                   = model.GetVendors
	getSupportedEndpointMap             = model.GetSupportedEndpointMap
	getEnabledModelDirectoryMetadataMap = model.GetEnabledModelDirectoryMetadataMap
)

type websiteMetadataCacheEntry struct {
	metadata  map[string]model.ModelDirectoryMetadataView
	expiresAt time.Time
}

func init() {
	operation_setting.OnPricingVisibilityChanged(InvalidateWebsitePricingCache)
	model.SetModelDirectoryMetadataChangedHook(InvalidateWebsitePricingCache)
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
	websitePricingCache.body = nil
	websitePricingCache.expiresAt = time.Time{}
	websitePricingCache.Unlock()
	invalidateWebsiteMetadataCache()
}

func invalidateWebsiteMetadataCache() {
	websiteMetadataCache.Lock()
	websiteMetadataCache.entries = make(map[string]websiteMetadataCacheEntry)
	websiteMetadataCache.Unlock()
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
	filteredPricing = attachModelDirectoryMetadata(filteredPricing)
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

func attachModelDirectoryMetadata(pricing []model.Pricing) []model.Pricing {
	rows := append([]model.Pricing(nil), pricing...)
	if len(rows) == 0 {
		return rows
	}

	modelNames := make([]string, 0, len(rows))
	for _, item := range rows {
		if item.ModelName != "" {
			modelNames = append(modelNames, item.ModelName)
		}
	}
	metadataByName, err := getCachedEnabledModelDirectoryMetadataMap(modelNames)
	if err != nil {
		common.SysLog("failed to load model directory metadata: " + err.Error())
		return rows
	}
	for index := range rows {
		metadata, ok := metadataByName[rows[index].ModelName]
		if !ok {
			continue
		}
		metadataCopy := metadata
		rows[index].DirectoryMetadata = &metadataCopy
	}
	return rows
}

func getCachedEnabledModelDirectoryMetadataMap(modelNames []string) (map[string]model.ModelDirectoryMetadataView, error) {
	keyParts := make([]string, 0, len(modelNames))
	seen := make(map[string]struct{}, len(modelNames))
	for _, name := range modelNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		keyParts = append(keyParts, name)
	}
	sort.Strings(keyParts)
	key := strings.Join(keyParts, "\x00")
	now := websiteMetadataNow()

	websiteMetadataCache.RLock()
	entry, ok := websiteMetadataCache.entries[key]
	if ok && now.Before(entry.expiresAt) {
		metadata := cloneWebsiteMetadataMap(entry.metadata)
		websiteMetadataCache.RUnlock()
		return metadata, nil
	}
	websiteMetadataCache.RUnlock()

	websiteMetadataCache.Lock()
	defer websiteMetadataCache.Unlock()

	// Re-check after acquiring the writer lock. This closes the miss race so a
	// concurrent burst performs one database lookup instead of one per caller.
	now = websiteMetadataNow()
	if entry, ok := websiteMetadataCache.entries[key]; ok && now.Before(entry.expiresAt) {
		return cloneWebsiteMetadataMap(entry.metadata), nil
	}

	metadata, err := getEnabledModelDirectoryMetadataMap(modelNames)
	if err != nil {
		return nil, err
	}
	websiteMetadataCache.entries[key] = websiteMetadataCacheEntry{
		metadata:  cloneWebsiteMetadataMap(metadata),
		expiresAt: now.Add(websiteMetadataCacheTTL),
	}
	return cloneWebsiteMetadataMap(metadata), nil
}

func cloneWebsiteMetadataMap(source map[string]model.ModelDirectoryMetadataView) map[string]model.ModelDirectoryMetadataView {
	clone := make(map[string]model.ModelDirectoryMetadataView, len(source))
	for name, metadata := range source {
		clone[name] = cloneWebsiteMetadataView(metadata)
	}
	return clone
}

func cloneWebsiteMetadataView(source model.ModelDirectoryMetadataView) model.ModelDirectoryMetadataView {
	clone := source
	clone.Providers = append([]string(nil), source.Providers...)
	clone.Modalities = append([]string(nil), source.Modalities...)
	clone.Categories = append([]string(nil), source.Categories...)
	if source.ContextTokens != nil {
		value := *source.ContextTokens
		clone.ContextTokens = &value
	}
	if source.PopularityRank != nil {
		value := *source.PopularityRank
		clone.PopularityRank = &value
	}
	if source.TopTenRank != nil {
		value := *source.TopTenRank
		clone.TopTenRank = &value
	}
	return clone
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
	visiblePricing = attachModelDirectoryMetadata(visiblePricing)

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
