package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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
		// The pricing cache is shared by all viewers.
		groups := make([]string, 0, len(item.EnableGroup))
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok || group == "all" {
				groups = append(groups, group)
			}
		}
		if len(groups) > 0 {
			item.EnableGroup = groups
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	usableGroup := service.GetUserUsableGroups(userGroup)
	pricing := filterPricingByUsableGroups(model.GetPricing(), usableGroup)
	groupRatio := ratio_setting.GetGroupRatioCopy()
	for group := range groupRatio {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
			continue
		}
		if userGroup != "" {
			if ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, group); ok {
				groupRatio[group] = ratio
			}
		}
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(userGroup),
		"model_order":        service.BuildModelSquareOrder(pricing),
		"pricing_version":    "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

type modelSquareUsage struct {
	ModelName  string `json:"model_name"`
	Icon       string `json:"icon,omitempty"`
	VendorName string `json:"vendor_name,omitempty"`
	VendorIcon string `json:"vendor_icon,omitempty"`
	Requests   int64  `json:"requests"`
	Tokens     int64  `json:"tokens"`
}

// GetModelSquareUsage lists every model of the model square, whichever group
// can see it, with its usage for the order preview.
func GetModelSquareUsage(c *gin.Context) {
	days := c.DefaultQuery("days", "7")
	if err := operation_setting.ValidateModelSquareOption("model_square_setting.sort_days", days); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, err)
		return
	}
	dayCount, _ := strconv.Atoi(days)
	totals, err := service.GetModelUsageTotals(dayCount)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	usage := make(map[string]model.ModelUsageTotal, len(totals))
	for _, total := range totals {
		usage[total.ModelName] = total
	}
	pricing := model.GetPricing()
	vendors := make(map[int]model.PricingVendor)
	for _, vendor := range model.GetVendors() {
		vendors[vendor.ID] = vendor
	}
	rows := make([]modelSquareUsage, 0, len(pricing))
	for _, item := range pricing {
		vendor := vendors[item.VendorID]
		total := usage[item.ModelName]
		rows = append(rows, modelSquareUsage{
			ModelName:  item.ModelName,
			Icon:       item.Icon,
			VendorName: vendor.Name,
			VendorIcon: vendor.Icon,
			Requests:   total.Requests,
			Tokens:     total.Tokens,
		})
	}
	common.ApiSuccess(c, rows)
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Model ratios reset", nil)
}
