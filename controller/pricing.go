package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/go-fuego/fuego"
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

func GetPricing(c fuego.ContextNoBody) (dto.PricingData, error) {
	pricing := model.GetPricing()
	userId, exists := dto.GinCtx(c).Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}
	var group string
	if exists {
		userID, ok := userId.(int)
		if !ok {
			return dto.PricingData{}, nil
		}
		user, err := model.GetUserCache(userID)
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
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	return dto.PricingData{
		Success:           true,
		Data:              toPricingModels(pricing),
		Vendors:           toPricingVendors(model.GetVendors()),
		GroupRatio:        groupRatio,
		UsableGroup:       usableGroup,
		SupportedEndpoint: toEndpointInfoMap(model.GetSupportedEndpointMap()),
		AutoGroups:        service.GetUserAutoGroup(group),
		PricingVersion:    "a42d372ccf0b5dd13ecf71203521f9d2",
	}, nil
}

func toPricingModels(src []model.Pricing) []dto.PricingModel {
	out := make([]dto.PricingModel, len(src))
	for i, m := range src {
		out[i] = dto.PricingModel{
			ModelName:              m.ModelName,
			Description:            m.Description,
			Icon:                   m.Icon,
			Tags:                   m.Tags,
			VendorID:               m.VendorID,
			QuotaType:              m.QuotaType,
			ModelRatio:             m.ModelRatio,
			ModelPrice:             m.ModelPrice,
			OwnerBy:                m.OwnerBy,
			CompletionRatio:        m.CompletionRatio,
			EnableGroup:            m.EnableGroup,
			SupportedEndpointTypes: m.SupportedEndpointTypes,
			PricingVersion:         m.PricingVersion,
		}
	}
	return out
}

func toPricingVendors(src []model.PricingVendor) []dto.PricingVendor {
	out := make([]dto.PricingVendor, len(src))
	for i, v := range src {
		out[i] = dto.PricingVendor{
			ID:          v.ID,
			Name:        v.Name,
			Description: v.Description,
			Icon:        v.Icon,
		}
	}
	return out
}

func toEndpointInfoMap(src map[string]common.EndpointInfo) map[string]dto.EndpointInfo {
	out := make(map[string]dto.EndpointInfo, len(src))
	for k, v := range src {
		out[k] = dto.EndpointInfo{Path: v.Path, Method: v.Method}
	}
	return out
}

func ResetModelRatio(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("重置模型倍率成功")
}
