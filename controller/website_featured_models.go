package controller

import (
	"errors"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type websiteFeaturedModelRequest struct {
	ModelNames []string `json:"model_names"`
}

type websiteFeaturedModelResponse struct {
	ModelName  string `json:"model_name"`
	SortOrder  int    `json:"sort_order"`
	VendorName string `json:"vendor_name,omitempty"`
	Available  bool   `json:"available"`
}

type websiteFeaturedCandidateResponse struct {
	ModelName  string `json:"model_name"`
	VendorName string `json:"vendor_name,omitempty"`
	Icon       string `json:"icon,omitempty"`
	Available  bool   `json:"available"`
}

// GetWebsiteFeaturedModels returns current featured rows and the public model
// candidates that can be selected by an administrator.
func GetWebsiteFeaturedModels(c *gin.Context) {
	rows, err := model.ListWebsiteFeaturedModels()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	publicModels := publicWebsitePricingModels()
	vendorNames := websiteVendorNames(model.GetVendors())
	available := make(map[string]model.Pricing, len(publicModels))
	candidates := make([]websiteFeaturedCandidateResponse, 0, len(publicModels))
	for _, item := range publicModels {
		available[item.ModelName] = item
		candidates = append(candidates, websiteFeaturedCandidateResponse{
			ModelName:  item.ModelName,
			VendorName: vendorNames[item.VendorID],
			Icon:       item.Icon,
			Available:  true,
		})
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].ModelName < candidates[j].ModelName })

	featured := make([]websiteFeaturedModelResponse, 0, len(rows))
	for _, row := range rows {
		item, ok := available[row.ModelName]
		featured = append(featured, websiteFeaturedModelResponse{
			ModelName:  row.ModelName,
			SortOrder:  row.SortOrder,
			VendorName: vendorNames[item.VendorID],
			Available:  ok,
		})
	}

	common.ApiSuccess(c, gin.H{"featured": featured, "candidates": candidates})
}

// UpdateWebsiteFeaturedModels replaces the complete public website featured
// order in one transaction.
func UpdateWebsiteFeaturedModels(c *gin.Context) {
	var request websiteFeaturedModelRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}

	modelNames, err := normalizeWebsiteFeaturedModelNames(request.ModelNames)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	available := make(map[string]struct{})
	for _, item := range publicWebsitePricingModels() {
		available[item.ModelName] = struct{}{}
	}
	for _, modelName := range modelNames {
		if _, ok := available[modelName]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "model is not available on the public website: " + modelName})
			return
		}
	}

	if err := model.ReplaceWebsiteFeaturedModels(modelNames); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	InvalidateWebsitePricingCache()
	common.ApiSuccess(c, gin.H{"model_names": modelNames})
}

func normalizeWebsiteFeaturedModelNames(raw []string) ([]string, error) {
	seen := make(map[string]struct{}, len(raw))
	modelNames := make([]string, 0, len(raw))
	for _, rawName := range raw {
		modelName := strings.TrimSpace(rawName)
		if modelName == "" {
			return nil, errors.New("model names must not be empty")
		}
		if _, ok := seen[modelName]; ok {
			return nil, errors.New("model names must be unique")
		}
		seen[modelName] = struct{}{}
		modelNames = append(modelNames, modelName)
	}
	return modelNames, nil
}

func getWebsiteFeaturedModelNames() []string {
	if model.DB == nil {
		return nil
	}
	rows, err := model.ListWebsiteFeaturedModels()
	if err != nil {
		common.SysLog("failed to load website featured model order: " + err.Error())
		return nil
	}
	modelNames := make([]string, 0, len(rows))
	for _, row := range rows {
		modelNames = append(modelNames, row.ModelName)
	}
	return modelNames
}

func applyWebsiteFeaturedOrder(pricing []model.Pricing, featuredNames []string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	featuredOrder := make(map[string]int, len(featuredNames))
	for order, modelName := range featuredNames {
		if _, exists := featuredOrder[modelName]; !exists {
			featuredOrder[modelName] = order
		}
	}

	featured := make([]model.Pricing, 0, len(featuredNames))
	remaining := make([]model.Pricing, 0, len(pricing))
	byName := make(map[string]model.Pricing, len(pricing))
	for _, item := range pricing {
		item.WebsiteFeaturedOrder = nil
		byName[item.ModelName] = item
	}
	for _, modelName := range featuredNames {
		item, ok := byName[modelName]
		if !ok {
			continue
		}
		order := featuredOrder[modelName]
		item.WebsiteFeaturedOrder = &order
		featured = append(featured, item)
		delete(byName, modelName)
	}
	for _, item := range pricing {
		if remainingItem, ok := byName[item.ModelName]; ok {
			remaining = append(remaining, remainingItem)
			delete(byName, item.ModelName)
		}
	}
	return append(featured, remaining...)
}

func publicWebsitePricingModels() []model.Pricing {
	if _, ok := ratio_setting.GetGroupRatioCopy()[websitePublicGroup]; !ok {
		return nil
	}
	description := setting.GetUsableGroupDescription(websitePublicGroup)
	if strings.TrimSpace(description) == "" {
		description = websitePublicGroup
	}
	return filterPricingByUsableGroups(model.GetPricing(), map[string]string{websitePublicGroup: description})
}

func websiteVendorNames(vendors []model.PricingVendor) map[int]string {
	result := make(map[int]string, len(vendors))
	for _, vendor := range vendors {
		result[vendor.ID] = vendor.Name
	}
	return result
}
