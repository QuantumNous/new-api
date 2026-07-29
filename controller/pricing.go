package controller

import (
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		enabledGroups := make(map[string]struct{}, len(item.EnableGroup))
		for _, group := range item.EnableGroup {
			enabledGroups[group] = struct{}{}
		}
		publicIntegrations := make([]model.ModelIntegration, 0, len(item.Integrations))
		for _, integration := range item.Integrations {
			if !integration.Verified || integration.Source != "explicit" {
				continue
			}
			groupsSet := make(map[string]struct{}, len(integration.Groups))
			for _, group := range integration.Groups {
				_, modelEnabled := enabledGroups[group]
				if _, allEnabled := enabledGroups["all"]; allEnabled {
					modelEnabled = true
				}
				if group == "all" && modelEnabled {
					for usable := range usableGroup {
						groupsSet[usable] = struct{}{}
					}
					continue
				}
				_, callerCanUse := usableGroup[group]
				if modelEnabled && callerCanUse {
					groupsSet[group] = struct{}{}
				}
			}
			groups := make([]string, 0, len(groupsSet))
			for group := range groupsSet {
				groups = append(groups, group)
			}
			sort.Strings(groups)
			if len(groups) > 0 {
				integration.Groups = groups
				publicIntegrations = append(publicIntegrations, integration)
			}
		}
		item.Integrations = publicIntegrations
		item.SupportedEndpointTypes = nil
		if common.StringsContains(item.EnableGroup, "all") {
			filtered = append(filtered, item)
			continue
		}
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok {
				filtered = append(filtered, item)
				break
			}
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
	// check groupRatio contains usableGroup
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	c.JSON(200, gin.H{
		"success":              true,
		"data":                 pricing,
		"vendors":              model.GetVendors(),
		"group_ratio":          groupRatio,
		"usable_group":         usableGroup,
		"supported_endpoint":   model.GetSupportedEndpointMap(),
		"integration_profiles": model.GetIntegrationProfiles(),
		"auto_groups":          service.GetUserAutoGroup(group),
		"pricing_version":      "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

func GetIntegrationProfiles(c *gin.Context) {
	common.ApiSuccess(c, model.GetIntegrationProfiles())
}
