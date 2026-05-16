package controller

import (
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type sensitiveScopeGroupOption struct {
	Value string  `json:"value"`
	Label string  `json:"label"`
	Desc  string  `json:"desc,omitempty"`
	Ratio float64 `json:"ratio"`
}

type sensitiveScopeModelOption struct {
	Value        string   `json:"value"`
	Label        string   `json:"label"`
	EnableGroups []string `json:"enable_groups"`
	Vendor       string   `json:"vendor,omitempty"`
	Endpoints    []string `json:"endpoints,omitempty"`
}

func GetSensitiveScopeOptions(c *gin.Context) {
	groups := buildSensitiveScopeGroupOptions()
	models, err := buildSensitiveScopeModelOptions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"groups": groups,
		"models": models,
	})
}

func buildSensitiveScopeGroupOptions() []sensitiveScopeGroupOption {
	groupRatios := ratio_setting.GetGroupRatioCopy()
	groupDescriptions := setting.GetUserUsableGroupsCopy()
	groupNames := make(map[string]struct{}, len(groupRatios)+len(groupDescriptions))
	for group := range groupRatios {
		if group != "auto" {
			groupNames[group] = struct{}{}
		}
	}
	for group := range groupDescriptions {
		if group != "auto" {
			groupNames[group] = struct{}{}
		}
	}

	options := make([]sensitiveScopeGroupOption, 0, len(groupNames))
	for group := range groupNames {
		ratio, ok := groupRatios[group]
		if !ok {
			ratio = 1
		}
		desc := groupDescriptions[group]
		options = append(options, sensitiveScopeGroupOption{
			Value: group,
			Label: group,
			Desc:  desc,
			Ratio: ratio,
		})
	}
	sort.Slice(options, func(i, j int) bool {
		return options[i].Value < options[j].Value
	})
	return options
}

func buildSensitiveScopeModelOptions() ([]sensitiveScopeModelOption, error) {
	vendorNames := make(map[int]string)
	for _, vendor := range model.GetVendors() {
		vendorNames[vendor.ID] = vendor.Name
	}

	optionMap := make(map[string]sensitiveScopeModelOption)
	for _, pricing := range model.GetPricing() {
		modelName := pricing.ModelName
		if modelName == "" {
			continue
		}
		optionMap[modelName] = sensitiveScopeModelOption{
			Value:        modelName,
			Label:        modelName,
			EnableGroups: append([]string(nil), pricing.EnableGroup...),
			Vendor:       vendorNames[pricing.VendorID],
			Endpoints:    endpointTypesToStrings(pricing.SupportedEndpointTypes),
		}
	}

	models, err := model.GetAllEnabledModels()
	if err != nil {
		return nil, err
	}
	for _, meta := range models {
		if meta == nil || meta.ModelName == "" {
			continue
		}
		if _, ok := optionMap[meta.ModelName]; ok {
			continue
		}
		optionMap[meta.ModelName] = sensitiveScopeModelOption{
			Value:        meta.ModelName,
			Label:        meta.ModelName,
			EnableGroups: []string{},
			Vendor:       vendorNames[meta.VendorID],
			Endpoints:    parseSensitiveScopeEndpointStrings(meta.Endpoints),
		}
	}

	options := make([]sensitiveScopeModelOption, 0, len(optionMap))
	for _, option := range optionMap {
		sort.Strings(option.EnableGroups)
		sort.Strings(option.Endpoints)
		options = append(options, option)
	}
	sort.Slice(options, func(i, j int) bool {
		return options[i].Value < options[j].Value
	})
	return options, nil
}

func endpointTypesToStrings(endpointTypes []constant.EndpointType) []string {
	if len(endpointTypes) == 0 {
		return []string{}
	}
	endpoints := make([]string, 0, len(endpointTypes))
	for _, endpointType := range endpointTypes {
		if endpointType != "" {
			endpoints = append(endpoints, string(endpointType))
		}
	}
	return endpoints
}

func parseSensitiveScopeEndpointStrings(raw string) []string {
	if raw == "" {
		return []string{}
	}

	var endpointTypes []constant.EndpointType
	if err := common.UnmarshalJsonStr(raw, &endpointTypes); err == nil {
		return endpointTypesToStrings(endpointTypes)
	}

	var endpointMap map[string]interface{}
	if err := common.UnmarshalJsonStr(raw, &endpointMap); err != nil {
		return []string{}
	}
	endpoints := make([]string, 0, len(endpointMap))
	for endpoint := range endpointMap {
		if endpoint != "" {
			endpoints = append(endpoints, endpoint)
		}
	}
	sort.Strings(endpoints)
	return endpoints
}
