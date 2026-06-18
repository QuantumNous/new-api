package controller

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UpdateModelGroupPricingRequest struct {
	ModelName    string                             `json:"model_name"`
	GroupPricing map[string]types.ModelGroupPricing `json:"group_pricing"`
}

type UpdateModelPricingRequest struct {
	ModelName            string   `json:"model_name"`
	BillingMode          string   `json:"billing_mode"`
	ModelPrice           *float64 `json:"model_price"`
	ModelRatio           *float64 `json:"model_ratio"`
	CompletionRatio      *float64 `json:"completion_ratio"`
	CacheRatio           *float64 `json:"cache_ratio"`
	CreateCacheRatio     *float64 `json:"create_cache_ratio"`
	ImageRatio           *float64 `json:"image_ratio"`
	AudioRatio           *float64 `json:"audio_ratio"`
	AudioCompletionRatio *float64 `json:"audio_completion_ratio"`
	BillingExpr          string   `json:"billing_expr"`
	MinFee               *float64 `json:"min_fee"`
}

func writeFloatMapOption(key string, values map[string]float64) error {
	bytes, err := common.Marshal(values)
	if err != nil {
		return err
	}
	return model.UpdateOption(key, string(bytes))
}

func writeStringMapOption(key string, values map[string]string) error {
	bytes, err := common.Marshal(values)
	if err != nil {
		return err
	}
	return model.UpdateOption(key, string(bytes))
}

func setOptionalRatio(values map[string]float64, modelName string, value *float64) error {
	delete(values, modelName)
	if value == nil {
		return nil
	}
	if *value < 0 || math.IsNaN(*value) || math.IsInf(*value, 0) {
		return fmt.Errorf("价格倍率必须是不小于 0 的有效数字")
	}
	values[modelName] = *value
	return nil
}

func getOrCreateExactModelMeta(modelName string) (*model.Model, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return nil, fmt.Errorf("模型名称不能为空")
	}

	var m model.Model
	err := model.DB.Where("model_name = ?", modelName).First(&m).Error
	if err == nil {
		return &m, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	m = model.Model{
		ModelName:    modelName,
		VendorID:     model.InferDefaultVendorIDForModel(modelName),
		Status:       1,
		SyncOfficial: 0,
		NameRule:     model.NameRuleExact,
	}
	if err := m.Insert(); err != nil {
		return nil, err
	}
	return &m, nil
}

func updateModelPricingForMeta(c *gin.Context, m model.Model, req UpdateModelPricingRequest) {
	modelName := m.ModelName
	billingMode := strings.TrimSpace(req.BillingMode)
	if billingMode == "" {
		if strings.TrimSpace(req.BillingExpr) != "" {
			billingMode = billing_setting.BillingModeTieredExpr
		} else if req.ModelPrice != nil {
			billingMode = "per-request"
		} else {
			billingMode = billing_setting.BillingModeRatio
		}
	}

	modelPrices := ratio_setting.GetModelPriceCopy()
	modelMinFees := ratio_setting.GetModelMinFeeCopy()
	modelRatios := ratio_setting.GetModelRatioCopy()
	completionRatios := ratio_setting.GetCompletionRatioCopy()
	cacheRatios := ratio_setting.GetCacheRatioCopy()
	createCacheRatios := ratio_setting.GetCreateCacheRatioCopy()
	imageRatios := ratio_setting.GetImageRatioCopy()
	audioRatios := ratio_setting.GetAudioRatioCopy()
	audioCompletionRatios := ratio_setting.GetAudioCompletionRatioCopy()
	billingModes := billing_setting.GetBillingModeCopy()
	billingExprs := billing_setting.GetBillingExprCopy()

	delete(modelPrices, modelName)
	delete(modelMinFees, modelName)
	delete(modelRatios, modelName)
	delete(completionRatios, modelName)
	delete(cacheRatios, modelName)
	delete(createCacheRatios, modelName)
	delete(imageRatios, modelName)
	delete(audioRatios, modelName)
	delete(audioCompletionRatios, modelName)
	delete(billingModes, modelName)
	delete(billingExprs, modelName)

	switch billingMode {
	case "per-request":
		if req.ModelPrice == nil {
			common.ApiErrorMsg(c, "按次计费需要填写模型价格")
			return
		}
		if err := setOptionalRatio(modelPrices, modelName, req.ModelPrice); err != nil {
			common.ApiError(c, err)
			return
		}
	case billing_setting.BillingModeRatio, "per-token":
		if req.ModelRatio == nil {
			common.ApiErrorMsg(c, "按量计费需要填写输入价格")
			return
		}
		if err := setOptionalRatio(modelRatios, modelName, req.ModelRatio); err != nil {
			common.ApiError(c, err)
			return
		}
		if err := setOptionalRatio(modelMinFees, modelName, req.MinFee); err != nil {
			common.ApiError(c, err)
			return
		}
		for _, item := range []struct {
			values map[string]float64
			ratio  *float64
		}{
			{completionRatios, req.CompletionRatio},
			{cacheRatios, req.CacheRatio},
			{createCacheRatios, req.CreateCacheRatio},
			{imageRatios, req.ImageRatio},
			{audioRatios, req.AudioRatio},
			{audioCompletionRatios, req.AudioCompletionRatio},
		} {
			if err := setOptionalRatio(item.values, modelName, item.ratio); err != nil {
				common.ApiError(c, err)
				return
			}
		}
	case billing_setting.BillingModeTieredExpr:
		expr := strings.TrimSpace(req.BillingExpr)
		if expr == "" {
			common.ApiErrorMsg(c, "表达式计费需要填写计费表达式")
			return
		}
		if err := billing_setting.SmokeTestExpr(expr); err != nil {
			common.ApiErrorMsg(c, "计费表达式校验失败: "+err.Error())
			return
		}
		billingModes[modelName] = billing_setting.BillingModeTieredExpr
		billingExprs[modelName] = expr
	default:
		common.ApiErrorMsg(c, "不支持的计费方式: "+billingMode)
		return
	}

	for _, item := range []struct {
		key    string
		values map[string]float64
	}{
		{"ModelPrice", modelPrices},
		{"ModelMinFee", modelMinFees},
		{"ModelRatio", modelRatios},
		{"CompletionRatio", completionRatios},
		{"CacheRatio", cacheRatios},
		{"CreateCacheRatio", createCacheRatios},
		{"ImageRatio", imageRatios},
		{"AudioRatio", audioRatios},
		{"AudioCompletionRatio", audioCompletionRatios},
	} {
		if err := writeFloatMapOption(item.key, item.values); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := writeStringMapOption("billing_setting.billing_mode", billingModes); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := writeStringMapOption("billing_setting.billing_expr", billingExprs); err != nil {
		common.ApiError(c, err)
		return
	}

	model.RefreshPricing()
	common.ApiSuccess(c, nil)
}

func validateGroupBillingModes(groupPricing map[string]types.ModelGroupPricing) error {
	for group, item := range groupPricing {
		if item.BillingMode == nil {
			continue
		}
		mode := strings.TrimSpace(*item.BillingMode)
		switch mode {
		case "", types.GroupBillingModePerToken:
			// ok (empty == inherit)
		case types.GroupBillingModePerRequest:
			// 按次计费必须显式填写模型价格（哪怕 0=免费）。
			// 留空会让 GetModelPrice 返回 -1 哨兵，旧逻辑曾据此负扣费（资损）。
			if item.ModelPrice == nil {
				return fmt.Errorf("分组 %s 按次计费需要填写模型价格", group)
			}
		case types.GroupBillingModeTieredExpr:
			if item.BillingExpr == nil || strings.TrimSpace(*item.BillingExpr) == "" {
				return fmt.Errorf("分组 %s 表达式计费需要填写计费表达式", group)
			}
			if err := billing_setting.SmokeTestExpr(strings.TrimSpace(*item.BillingExpr)); err != nil {
				return fmt.Errorf("分组 %s 计费表达式校验失败: %s", group, err.Error())
			}
		default:
			return fmt.Errorf("分组 %s 不支持的计费方式: %s", group, mode)
		}
	}
	return nil
}

func updateModelGroupPricingForMeta(c *gin.Context, m model.Model, req UpdateModelGroupPricingRequest) {
	if err := validateGroupBillingModes(req.GroupPricing); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	cleaned := model.NormalizeModelGroupPricing(req.GroupPricing)
	raw, err := model.ModelGroupPricingJSON(cleaned)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Model(&model.Model{}).Where("id = ?", m.Id).Updates(map[string]interface{}{
		"group_pricing": string(raw),
		"updated_time":  common.GetTimestamp(),
	}).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	model.RefreshPricing()
	common.ApiSuccess(c, gin.H{"group_pricing": cleaned})
}

// GetAllModelsMeta 获取模型列表（分页）
func GetAllModelsMeta(c *gin.Context) {

	pageInfo := common.GetPageQuery(c)
	modelsMeta, err := model.GetAllModels(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 批量填充附加字段，提升列表接口性能
	enrichModels(modelsMeta)
	var total int64
	model.DB.Model(&model.Model{}).Count(&total)

	// 统计供应商计数（全部数据，不受分页影响）
	vendorCounts, _ := model.GetVendorModelCounts()

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(modelsMeta)
	common.ApiSuccess(c, gin.H{
		"items":         modelsMeta,
		"total":         total,
		"page":          pageInfo.GetPage(),
		"page_size":     pageInfo.GetPageSize(),
		"vendor_counts": vendorCounts,
	})
}

// SearchModelsMeta 搜索模型列表
func SearchModelsMeta(c *gin.Context) {

	keyword := c.Query("keyword")
	vendor := c.Query("vendor")
	pageInfo := common.GetPageQuery(c)

	modelsMeta, total, err := model.SearchModels(keyword, vendor, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 批量填充附加字段，提升列表接口性能
	enrichModels(modelsMeta)
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(modelsMeta)
	common.ApiSuccess(c, pageInfo)
}

// GetModelMeta 根据 ID 获取单条模型信息
func GetModelMeta(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var m model.Model
	if err := model.DB.First(&m, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	enrichModels([]*model.Model{&m})
	common.ApiSuccess(c, &m)
}

// CreateModelMeta 新建模型
func CreateModelMeta(c *gin.Context) {
	var m model.Model
	if err := c.ShouldBindJSON(&m); err != nil {
		common.ApiError(c, err)
		return
	}
	if m.ModelName == "" {
		common.ApiErrorMsg(c, "模型名称不能为空")
		return
	}
	// 名称冲突检查
	if dup, err := model.IsModelNameDuplicated(0, m.ModelName); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "模型名称已存在")
		return
	}

	if err := m.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RefreshPricing()
	common.ApiSuccess(c, &m)
}

// UpdateModelMeta 更新模型
func UpdateModelMeta(c *gin.Context) {
	statusOnly := c.Query("status_only") == "true"

	var m model.Model
	if err := c.ShouldBindJSON(&m); err != nil {
		common.ApiError(c, err)
		return
	}
	if m.Id == 0 {
		common.ApiErrorMsg(c, "缺少模型 ID")
		return
	}

	if statusOnly {
		// 只更新状态，防止误清空其他字段
		if err := model.DB.Model(&model.Model{}).Where("id = ?", m.Id).Update("status", m.Status).Error; err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		// 名称冲突检查
		if dup, err := model.IsModelNameDuplicated(m.Id, m.ModelName); err != nil {
			common.ApiError(c, err)
			return
		} else if dup {
			common.ApiErrorMsg(c, "模型名称已存在")
			return
		}

		if err := m.Update(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	model.RefreshPricing()
	common.ApiSuccess(c, &m)
}

// UpdateModelPricing 更新单个模型的基础计费配置。
func UpdateModelPricing(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var m model.Model
	if err := model.DB.First(&m, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	var req UpdateModelPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	updateModelPricingForMeta(c, m, req)
}

// UpdateModelPricingByName 更新模型广场中的自动模型价格，并在首次修改时创建精确模型元数据。
func UpdateModelPricingByName(c *gin.Context) {
	var req UpdateModelPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	m, err := getOrCreateExactModelMeta(req.ModelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	updateModelPricingForMeta(c, *m, req)
}

// UpdateModelGroupPricing 更新单个模型在不同令牌分组下的专属倍率。
func UpdateModelGroupPricing(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var m model.Model
	if err := model.DB.First(&m, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	var req UpdateModelGroupPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	updateModelGroupPricingForMeta(c, m, req)
}

// UpdateModelGroupPricingByName 更新模型广场中的自动模型分组倍率，并在首次修改时创建精确模型元数据。
func UpdateModelGroupPricingByName(c *gin.Context) {
	var req UpdateModelGroupPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	m, err := getOrCreateExactModelMeta(req.ModelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	updateModelGroupPricingForMeta(c, *m, req)
}

// DeleteModelMeta 删除模型
func DeleteModelMeta(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Delete(&model.Model{}, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	model.RefreshPricing()
	common.ApiSuccess(c, nil)
}

// enrichModels 批量填充附加信息：端点、渠道、分组、计费类型，避免 N+1 查询
func enrichModels(models []*model.Model) {
	if len(models) == 0 {
		return
	}

	// 1) 拆分精确与规则匹配
	exactNames := make([]string, 0)
	exactIdx := make(map[string][]int) // modelName -> indices in models
	ruleIndices := make([]int, 0)
	for i, m := range models {
		if m == nil {
			continue
		}
		if m.NameRule == model.NameRuleExact {
			exactNames = append(exactNames, m.ModelName)
			exactIdx[m.ModelName] = append(exactIdx[m.ModelName], i)
		} else {
			ruleIndices = append(ruleIndices, i)
		}
	}

	// 2) 批量查询精确模型的绑定渠道
	channelsByModel, _ := model.GetBoundChannelsByModelsMap(exactNames)

	// 3) 精确模型：端点从缓存、渠道批量映射、分组/计费类型从缓存
	for name, indices := range exactIdx {
		chs := channelsByModel[name]
		for _, idx := range indices {
			mm := models[idx]
			if mm.Endpoints == "" {
				eps := model.GetModelSupportEndpointTypes(mm.ModelName)
				if b, err := common.Marshal(eps); err == nil {
					mm.Endpoints = string(b)
				}
			}
			mm.BoundChannels = chs
			mm.EnableGroups = model.GetModelEnableGroups(mm.ModelName)
			mm.QuotaTypes = model.GetModelQuotaTypes(mm.ModelName)
		}
	}

	if len(ruleIndices) == 0 {
		return
	}

	// 4) 一次性读取定价缓存，内存匹配所有规则模型
	pricings := model.GetPricing()

	// 为全部规则模型收集匹配名集合、端点并集、分组并集、配额集合
	matchedNamesByIdx := make(map[int][]string)
	endpointSetByIdx := make(map[int]map[constant.EndpointType]struct{})
	groupSetByIdx := make(map[int]map[string]struct{})
	quotaSetByIdx := make(map[int]map[int]struct{})

	for _, p := range pricings {
		for _, idx := range ruleIndices {
			mm := models[idx]
			var matched bool
			switch mm.NameRule {
			case model.NameRulePrefix:
				matched = strings.HasPrefix(p.ModelName, mm.ModelName)
			case model.NameRuleSuffix:
				matched = strings.HasSuffix(p.ModelName, mm.ModelName)
			case model.NameRuleContains:
				matched = strings.Contains(p.ModelName, mm.ModelName)
			}
			if !matched {
				continue
			}
			matchedNamesByIdx[idx] = append(matchedNamesByIdx[idx], p.ModelName)

			es := endpointSetByIdx[idx]
			if es == nil {
				es = make(map[constant.EndpointType]struct{})
				endpointSetByIdx[idx] = es
			}
			for _, et := range p.SupportedEndpointTypes {
				es[et] = struct{}{}
			}

			gs := groupSetByIdx[idx]
			if gs == nil {
				gs = make(map[string]struct{})
				groupSetByIdx[idx] = gs
			}
			for _, g := range p.EnableGroup {
				gs[g] = struct{}{}
			}

			qs := quotaSetByIdx[idx]
			if qs == nil {
				qs = make(map[int]struct{})
				quotaSetByIdx[idx] = qs
			}
			qs[p.QuotaType] = struct{}{}
		}
	}

	// 5) 汇总所有匹配到的模型名称，批量查询一次渠道
	allMatchedSet := make(map[string]struct{})
	for _, names := range matchedNamesByIdx {
		for _, n := range names {
			allMatchedSet[n] = struct{}{}
		}
	}
	allMatched := make([]string, 0, len(allMatchedSet))
	for n := range allMatchedSet {
		allMatched = append(allMatched, n)
	}
	matchedChannelsByModel, _ := model.GetBoundChannelsByModelsMap(allMatched)

	// 6) 回填每个规则模型的并集信息
	for _, idx := range ruleIndices {
		mm := models[idx]

		// 端点并集 -> 序列化
		if es, ok := endpointSetByIdx[idx]; ok && mm.Endpoints == "" {
			eps := make([]constant.EndpointType, 0, len(es))
			for et := range es {
				eps = append(eps, et)
			}
			if b, err := common.Marshal(eps); err == nil {
				mm.Endpoints = string(b)
			}
		}

		// 分组并集
		if gs, ok := groupSetByIdx[idx]; ok {
			groups := make([]string, 0, len(gs))
			for g := range gs {
				groups = append(groups, g)
			}
			mm.EnableGroups = groups
		}

		// 配额类型集合（保持去重并排序）
		if qs, ok := quotaSetByIdx[idx]; ok {
			arr := make([]int, 0, len(qs))
			for k := range qs {
				arr = append(arr, k)
			}
			sort.Ints(arr)
			mm.QuotaTypes = arr
		}

		// 渠道并集
		names := matchedNamesByIdx[idx]
		channelSet := make(map[string]model.BoundChannel)
		for _, n := range names {
			for _, ch := range matchedChannelsByModel[n] {
				key := ch.Name + "_" + strconv.Itoa(ch.Type)
				channelSet[key] = ch
			}
		}
		if len(channelSet) > 0 {
			chs := make([]model.BoundChannel, 0, len(channelSet))
			for _, ch := range channelSet {
				chs = append(chs, ch)
			}
			mm.BoundChannels = chs
		}

		// 匹配信息
		mm.MatchedModels = names
		mm.MatchedCount = len(names)
	}
}
