package controller

import (
	"errors"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxBatchCreateChatModels = 1000

func GetUserChatModels(c *gin.Context) {
	pricingMap, groupRatio, _, err := getUserChatPricingScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	options, err := model.GetEnabledChatModelOptions()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	autoItems := make([]dto.UserChatModelItem, 0, 1)
	items := make([]dto.UserChatModelItem, 0, len(options))
	for _, option := range options {
		pricing, ok := pricingMap[option.ModelName]
		if !ok {
			continue
		}
		item := dto.UserChatModelItem{
			Model: option.ModelName,
			Name:  chatModelDisplayName(option.DisplayName, option.ModelName),
			Price: estimateChatModelPrice(pricing, groupRatio),
		}
		if option.IsAuto {
			autoItem := item
			autoItem.Name = "Auto"
			autoItems = append(autoItems, autoItem)
		}
		items = append(items, item)
	}

	models := append(autoItems, items...)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": dto.UserChatModelsResponse{
			Total:  len(models),
			Models: models,
		},
	})
}

func ListChatModels(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	enabled, ok := parseOptionalBoolQuery(c, "enabled")
	if !ok {
		common.ApiErrorMsg(c, "enabled 参数格式不正确")
		return
	}
	available, ok := parseOptionalBoolQuery(c, "available")
	if !ok {
		common.ApiErrorMsg(c, "available 参数格式不正确")
		return
	}

	options, err := model.GetAllChatModelOptions(c.Query("keyword"), enabled)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pricingMap := getChatPricingMap(model.GetPricing())
	items := make([]dto.AdminChatModelItem, 0, len(options))
	for _, option := range options {
		item := buildAdminChatModelItem(option, pricingMap)
		if available != nil && item.Available != *available {
			continue
		}
		items = append(items, item)
	}

	total := len(items)
	items = paginateChatModelItems(items, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	pageInfo.SetTotal(total)
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func ListChatModelCandidates(c *gin.Context) {
	keyword := strings.ToLower(strings.TrimSpace(c.Query("keyword")))
	configured, err := model.GetChatModelOptionModelMap()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pricingMap := getChatPricingMap(model.GetPricing())
	modelNames := make([]string, 0, len(pricingMap))
	for name := range pricingMap {
		if keyword != "" && !strings.Contains(strings.ToLower(name), keyword) {
			continue
		}
		modelNames = append(modelNames, name)
	}
	sort.Strings(modelNames)

	candidates := make([]dto.ChatModelCandidate, 0, len(modelNames))
	for _, name := range modelNames {
		pricing := pricingMap[name]
		_, isConfigured := configured[name]
		candidates = append(candidates, dto.ChatModelCandidate{
			Model:      name,
			Name:       name,
			Price:      estimateChatModelPrice(pricing, nil),
			Configured: isConfigured,
		})
	}
	common.ApiSuccess(c, gin.H{
		"items": candidates,
		"total": len(candidates),
	})
}

func CreateChatModel(c *gin.Context) {
	var req dto.CreateChatModelRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}

	modelName, err := normalizeChatModelName(req.Model)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	displayName, err := normalizeChatModelDisplayName(req.Name)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if displayName == "" {
		displayName = modelName
	}

	pricingMap := getChatPricingMap(model.GetPricing())
	if _, ok := pricingMap[modelName]; !ok {
		common.ApiErrorMsg(c, "模型当前不可用于对话模型列表")
		return
	}
	if dup, err := model.IsChatModelOptionDuplicated(0, modelName); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "模型已存在")
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	isAuto := false
	if req.IsAuto != nil {
		isAuto = *req.IsAuto
	}
	sortOrder := 0
	if req.Sort != nil {
		sortOrder = *req.Sort
	}

	option := model.ChatModelOption{
		ModelName:   modelName,
		DisplayName: displayName,
		Enabled:     enabled,
		IsAuto:      isAuto,
		Sort:        sortOrder,
	}
	if err := model.CreateChatModelOption(&option); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildAdminChatModelItem(option, pricingMap))
}

func BatchCreateChatModels(c *gin.Context) {
	var req dto.BatchCreateChatModelsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(req.Models) == 0 {
		common.ApiErrorMsg(c, "模型列表不能为空")
		return
	}
	if len(req.Models) > maxBatchCreateChatModels {
		common.ApiErrorMsg(c, "模型数量不能超过 "+strconv.Itoa(maxBatchCreateChatModels)+" 个")
		return
	}

	pricingMap := getChatPricingMap(model.GetPricing())
	configured, err := model.GetChatModelOptionModelMap()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	seen := make(map[string]bool, len(req.Models))
	pending := make([]string, 0, len(req.Models))
	skipped := make([]string, 0)
	for _, rawName := range req.Models {
		modelName, err := normalizeChatModelName(rawName)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if seen[modelName] {
			skipped = append(skipped, modelName)
			continue
		}
		seen[modelName] = true
		if _, ok := pricingMap[modelName]; !ok {
			skipped = append(skipped, modelName)
			continue
		}
		if _, ok := configured[modelName]; ok {
			skipped = append(skipped, modelName)
			continue
		}
		pending = append(pending, modelName)
		configured[modelName] = model.ChatModelOption{}
	}

	created := make([]dto.AdminChatModelItem, 0, len(pending))
	if len(pending) > 0 {
		err = model.DB.Transaction(func(tx *gorm.DB) error {
			now := common.GetTimestamp()
			for _, modelName := range pending {
				option := model.ChatModelOption{
					ModelName:   modelName,
					DisplayName: modelName,
					Enabled:     false,
					IsAuto:      false,
					Sort:        0,
					CreatedTime: now,
					UpdatedTime: now,
				}
				if err := tx.Create(&option).Error; err != nil {
					return err
				}
				created = append(created, buildAdminChatModelItem(option, pricingMap))
			}
			return nil
		})
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	common.ApiSuccess(c, dto.BatchCreateChatModelsResponse{
		Created:      created,
		Skipped:      skipped,
		CreatedCount: len(created),
		SkippedCount: len(skipped),
	})
}

func UpdateChatModel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的模型列表 ID")
		return
	}

	var req dto.UpdateChatModelRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}

	current, err := model.GetChatModelOptionByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "模型列表项不存在")
			return
		}
		common.ApiError(c, err)
		return
	}

	pricingMap := getChatPricingMap(model.GetPricing())
	updates := model.ChatModelOptionUpdates{
		Enabled: req.Enabled,
		IsAuto:  req.IsAuto,
		Sort:    req.Sort,
	}

	effectiveModel := current.ModelName
	if req.Model != nil {
		modelName, err := normalizeChatModelName(*req.Model)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if _, ok := pricingMap[modelName]; !ok {
			common.ApiErrorMsg(c, "模型当前不可用于对话模型列表")
			return
		}
		if dup, err := model.IsChatModelOptionDuplicated(id, modelName); err != nil {
			common.ApiError(c, err)
			return
		} else if dup {
			common.ApiErrorMsg(c, "模型已存在")
			return
		}
		updates.ModelName = &modelName
		effectiveModel = modelName
	}

	if req.Name != nil {
		displayName, err := normalizeChatModelDisplayName(*req.Name)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		updates.DisplayName = &displayName
	}

	if req.IsAuto != nil && *req.IsAuto {
		if _, ok := pricingMap[effectiveModel]; !ok {
			common.ApiErrorMsg(c, "不可将当前不可用模型设为 Auto")
			return
		}
	}

	updated, err := model.UpdateChatModelOption(id, updates)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildAdminChatModelItem(*updated, pricingMap))
}

func DeleteChatModel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的模型列表 ID")
		return
	}
	if _, err := model.GetChatModelOptionByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "模型列表项不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteChatModelOption(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func getUserChatPricingScope(c *gin.Context) (map[string]model.Pricing, map[string]float64, map[string]string, error) {
	user, err := model.GetUserCache(c.GetInt("id"))
	if err != nil {
		return nil, nil, nil, err
	}

	groupRatio := map[string]float64{}
	for group, ratio := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[group] = ratio
	}
	for group := range groupRatio {
		if ratio, ok := ratio_setting.GetGroupGroupRatio(user.Group, group); ok {
			groupRatio[group] = ratio
		}
	}

	usableGroup := service.GetUserUsableGroups(user.Group)
	pricing := filterPricingByUsableGroups(model.GetPricing(), usableGroup)
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}
	return getChatPricingMap(pricing), groupRatio, usableGroup, nil
}

func getChatPricingMap(pricing []model.Pricing) map[string]model.Pricing {
	result := make(map[string]model.Pricing, len(pricing))
	for _, item := range pricing {
		if isChatEndpointPricing(item) {
			result[item.ModelName] = item
		}
	}
	return result
}

func isChatEndpointPricing(pricing model.Pricing) bool {
	if len(pricing.SupportedEndpointTypes) == 0 {
		return true
	}

	hasChatEndpoint := false
	for _, endpoint := range pricing.SupportedEndpointTypes {
		switch endpoint {
		case constant.EndpointTypeImageGeneration,
			constant.EndpointTypeEmbeddings,
			constant.EndpointTypeJinaRerank,
			constant.EndpointTypeOpenAIVideo,
			constant.EndpointTypeSeedanceVideoNative:
			return false
		case constant.EndpointTypeOpenAI,
			constant.EndpointTypeOpenAIResponse,
			constant.EndpointTypeOpenAIResponseCompact,
			constant.EndpointTypeAnthropic,
			constant.EndpointTypeGemini:
			hasChatEndpoint = true
		}
	}
	return hasChatEndpoint
}

func buildAdminChatModelItem(option model.ChatModelOption, pricingMap map[string]model.Pricing) dto.AdminChatModelItem {
	pricing, available := pricingMap[option.ModelName]
	price := 0.0
	if available {
		price = estimateChatModelPrice(pricing, nil)
	}
	return dto.AdminChatModelItem{
		Id:          option.Id,
		Model:       option.ModelName,
		Name:        chatModelDisplayName(option.DisplayName, option.ModelName),
		Enabled:     option.Enabled,
		IsAuto:      option.IsAuto,
		Sort:        option.Sort,
		Price:       price,
		Available:   available,
		CreatedTime: option.CreatedTime,
		UpdatedTime: option.UpdatedTime,
	}
}

func estimateChatModelPrice(pricing model.Pricing, groupRatio map[string]float64) float64 {
	ratio := minApplicableGroupRatio(pricing.EnableGroup, groupRatio)
	if pricing.QuotaType == 1 {
		return roundChatModelPrice(pricing.ModelPrice * ratio)
	}
	return roundChatModelPrice(pricing.ModelRatio * 2 * ratio)
}

func minApplicableGroupRatio(enableGroups []string, groupRatio map[string]float64) float64 {
	if len(groupRatio) == 0 {
		return 1
	}
	minRatio := math.Inf(1)
	if common.StringsContains(enableGroups, "all") {
		for _, ratio := range groupRatio {
			if ratio < minRatio {
				minRatio = ratio
			}
		}
	} else {
		for _, group := range enableGroups {
			if ratio, ok := groupRatio[group]; ok && ratio < minRatio {
				minRatio = ratio
			}
		}
	}
	if math.IsInf(minRatio, 1) {
		return 1
	}
	return minRatio
}

func roundChatModelPrice(price float64) float64 {
	return math.Round(price*1_000_000) / 1_000_000
}

func chatModelDisplayName(displayName string, modelName string) string {
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		return modelName
	}
	return displayName
}

func normalizeChatModelName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("模型名称不能为空")
	}
	if len(name) > 255 {
		return "", errors.New("模型名称不能超过 255 个字符")
	}
	return name, nil
}

func normalizeChatModelDisplayName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if len(name) > 255 {
		return "", errors.New("展示名称不能超过 255 个字符")
	}
	return name, nil
}

func parseOptionalBoolQuery(c *gin.Context, name string) (*bool, bool) {
	raw := strings.TrimSpace(c.Query(name))
	if raw == "" {
		return nil, true
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return nil, false
	}
	return &value, true
}

func paginateChatModelItems(items []dto.AdminChatModelItem, start int, pageSize int) []dto.AdminChatModelItem {
	if start >= len(items) {
		return []dto.AdminChatModelItem{}
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	return items[start:end]
}
