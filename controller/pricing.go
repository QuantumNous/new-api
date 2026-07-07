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
)

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
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"pricing_version":    "a42d372ccf0b5dd13ecf71203521f9d2",
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
			model.GetPricing(),
			model.GetVendors(),
			model.GetSupportedEndpointMap(),
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

	c.Header("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
	c.Data(200, "application/json; charset=utf-8", body)
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
	pricing := model.GetPricing()
	usableGroup := service.GetUserUsableGroups("")
	groupRatio := map[string]float64{}
	for group, ratio := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; ok {
			groupRatio[group] = ratio
		}
	}

	return gin.H{
		"success":            true,
		"data":               filterPricingByUsableGroups(pricing, usableGroup),
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(""),
		"pricing_version":    "website-public-v1",
	}
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

	return gin.H{
		"success":            true,
		"data":               filterPricingByUsableGroups(pricing, usableGroup),
		"vendors":            vendors,
		"group_ratio":        map[string]float64{group: ratio},
		"usable_group":       usableGroup,
		"supported_endpoint": supportedEndpoint,
		"auto_groups":        autoGroups,
		"pricing_version":    "website-public-plg-v1",
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
