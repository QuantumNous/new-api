package controller

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// parseModelID 解析并验证模型ID
func parseModelID(c *gin.Context) (int, error) {
	idStr := c.Param("id")
	return strconv.Atoi(idStr)
}

// checkModelNameDuplicate 检查模型名称是否重复，返回错误消息
func checkModelNameDuplicate(id int, name string) string {
	if name == "" {
		return "模型名称不能为空"
	}
	if dup, err := model.IsModelNameDuplicated(id, name); err != nil {
		return err.Error()
	} else if dup {
		return "模型名称已存在"
	}
	return ""
}

// GetAllModelsMeta 获取模型列表（分页）
func GetAllModelsMeta(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := c.Query("status")
	syncOfficial := c.Query("sync_official")

	modelsMeta, total, err := model.GetAllModels(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), status, syncOfficial)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	respondWithModels(c, modelsMeta, total, pageInfo, status, syncOfficial)
}

// SearchModelsMeta 搜索模型列表
func SearchModelsMeta(c *gin.Context) {
	keyword := c.Query("keyword")
	vendor := c.Query("vendor")
	status := c.Query("status")
	syncOfficial := c.Query("sync_official")
	pageInfo := common.GetPageQuery(c)

	modelsMeta, total, err := model.SearchModels(keyword, vendor, status, syncOfficial, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	respondWithModels(c, modelsMeta, total, pageInfo, status, syncOfficial)
}

// respondWithModels 统一处理模型列表响应
func respondWithModels(c *gin.Context, models []*model.Model, total int64, pageInfo *common.PageInfo, status, syncOfficial string) {
	enrichModels(models)
	vendorCounts, _ := model.GetVendorModelCounts(status, syncOfficial)

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(models)
	common.ApiSuccess(c, gin.H{
		"items":         models,
		"total":         total,
		"page":          pageInfo.GetPage(),
		"page_size":     pageInfo.GetPageSize(),
		"vendor_counts": vendorCounts,
	})
}

// GetModelMeta 根据 ID 获取单条模型信息
func GetModelMeta(c *gin.Context) {
	id, err := parseModelID(c)
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

	// 验证模型名称
	if errMsg := checkModelNameDuplicate(0, m.ModelName); errMsg != "" {
		common.ApiErrorMsg(c, errMsg)
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
		// 验证模型名称
		if errMsg := checkModelNameDuplicate(m.Id, m.ModelName); errMsg != "" {
			common.ApiErrorMsg(c, errMsg)
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

// DeleteModelMeta 删除模型
func DeleteModelMeta(c *gin.Context) {
	id, err := parseModelID(c)
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

	exactNames, exactIdx, ruleIndices := classifyModels(models)

	// 处理精确匹配模型
	enrichExactModels(models, exactNames, exactIdx)

	// 处理规则匹配模型
	if len(ruleIndices) > 0 {
		enrichRuleModels(models, ruleIndices)
	}
}

// classifyModels 将模型分类为精确匹配和规则匹配
func classifyModels(models []*model.Model) ([]string, map[string][]int, []int) {
	exactNames := make([]string, 0)
	exactIdx := make(map[string][]int)
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

	return exactNames, exactIdx, ruleIndices
}

// enrichExactModels 填充精确匹配模型的信息
func enrichExactModels(models []*model.Model, exactNames []string, exactIdx map[string][]int) {
	if len(exactNames) == 0 {
		return
	}

	channelsByModel, _ := model.GetBoundChannelsByModelsMap(exactNames)

	for name, indices := range exactIdx {
		chs := channelsByModel[name]
		for _, idx := range indices {
			mm := models[idx]
			if mm.Endpoints == "" {
				eps := model.GetModelSupportEndpointTypes(mm.ModelName)
				if b, err := json.Marshal(eps); err == nil {
					mm.Endpoints = string(b)
				}
			}
			mm.BoundChannels = chs
			mm.EnableGroups = model.GetModelEnableGroups(mm.ModelName)
			mm.QuotaTypes = model.GetModelQuotaTypes(mm.ModelName)
		}
	}
}

// enrichRuleModels 填充规则匹配模型的信息
func enrichRuleModels(models []*model.Model, ruleIndices []int) {
	pricings := model.GetPricing()

	// 收集匹配信息
	matchedNamesByIdx, endpointSetByIdx, groupSetByIdx, quotaSetByIdx := collectRuleMatches(models, ruleIndices, pricings)

	// 批量查询渠道信息
	allMatched := extractAllMatchedNames(matchedNamesByIdx)
	matchedChannelsByModel, _ := model.GetBoundChannelsByModelsMap(allMatched)

	// 回填模型信息
	fillRuleModelData(models, ruleIndices, matchedNamesByIdx, endpointSetByIdx, groupSetByIdx, quotaSetByIdx, matchedChannelsByModel)
}

// collectRuleMatches 收集规则模型的匹配信息
func collectRuleMatches(models []*model.Model, ruleIndices []int, pricings []model.Pricing) (
	map[int][]string,
	map[int]map[constant.EndpointType]struct{},
	map[int]map[string]struct{},
	map[int]map[int]struct{},
) {
	matchedNamesByIdx := make(map[int][]string)
	endpointSetByIdx := make(map[int]map[constant.EndpointType]struct{})
	groupSetByIdx := make(map[int]map[string]struct{})
	quotaSetByIdx := make(map[int]map[int]struct{})

	for _, p := range pricings {
		for _, idx := range ruleIndices {
			mm := models[idx]
			if !matchNameRule(p.ModelName, mm.ModelName, mm.NameRule) {
				continue
			}

			matchedNamesByIdx[idx] = append(matchedNamesByIdx[idx], p.ModelName)

			if endpointSetByIdx[idx] == nil {
				endpointSetByIdx[idx] = make(map[constant.EndpointType]struct{})
			}
			for _, et := range p.SupportedEndpointTypes {
				endpointSetByIdx[idx][et] = struct{}{}
			}

			if groupSetByIdx[idx] == nil {
				groupSetByIdx[idx] = make(map[string]struct{})
			}
			for _, g := range p.EnableGroup {
				groupSetByIdx[idx][g] = struct{}{}
			}

			if quotaSetByIdx[idx] == nil {
				quotaSetByIdx[idx] = make(map[int]struct{})
			}
			quotaSetByIdx[idx][p.QuotaType] = struct{}{}
		}
	}

	return matchedNamesByIdx, endpointSetByIdx, groupSetByIdx, quotaSetByIdx
}

// matchNameRule 根据规则匹配模型名称
func matchNameRule(pricingModel, modelName string, nameRule int) bool {
	switch nameRule {
	case model.NameRulePrefix:
		return strings.HasPrefix(pricingModel, modelName)
	case model.NameRuleSuffix:
		return strings.HasSuffix(pricingModel, modelName)
	case model.NameRuleContains:
		return strings.Contains(pricingModel, modelName)
	default:
		return false
	}
}

// extractAllMatchedNames 提取所有匹配的模型名称
func extractAllMatchedNames(matchedNamesByIdx map[int][]string) []string {
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
	return allMatched
}

// fillRuleModelData 回填规则模型的数据
func fillRuleModelData(
	models []*model.Model,
	ruleIndices []int,
	matchedNamesByIdx map[int][]string,
	endpointSetByIdx map[int]map[constant.EndpointType]struct{},
	groupSetByIdx map[int]map[string]struct{},
	quotaSetByIdx map[int]map[int]struct{},
	matchedChannelsByModel map[string][]model.BoundChannel,
) {
	for _, idx := range ruleIndices {
		mm := models[idx]

		// 填充端点
		if es, ok := endpointSetByIdx[idx]; ok && mm.Endpoints == "" {
			eps := make([]constant.EndpointType, 0, len(es))
			for et := range es {
				eps = append(eps, et)
			}
			if b, err := json.Marshal(eps); err == nil {
				mm.Endpoints = string(b)
			}
		}

		// 填充分组
		if gs, ok := groupSetByIdx[idx]; ok {
			groups := make([]string, 0, len(gs))
			for g := range gs {
				groups = append(groups, g)
			}
			mm.EnableGroups = groups
		}

		// 填充配额类型
		if qs, ok := quotaSetByIdx[idx]; ok {
			arr := make([]int, 0, len(qs))
			for k := range qs {
				arr = append(arr, k)
			}
			sort.Ints(arr)
			mm.QuotaTypes = arr
		}

		// 填充渠道
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

		// 填充匹配信息
		mm.MatchedModels = names
		mm.MatchedCount = len(names)
	}
}
