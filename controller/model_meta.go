package controller

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetAllModelsMeta 获取模型列表（分页）
func GetAllModelsMeta(c *gin.Context) {

	pageInfo := common.GetPageQuery(c)
	status := c.Query("status")
	syncOfficial := c.Query("sync_official")
	modelsMeta, total, err := model.SearchModels("", "", status, syncOfficial, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 批量填充附加字段，提升列表接口性能
	enrichModels(modelsMeta)

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
	status := c.Query("status")
	syncOfficial := c.Query("sync_official")
	pageInfo := common.GetPageQuery(c)

	modelsMeta, total, err := model.SearchModels(keyword, vendor, status, syncOfficial, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 批量填充附加字段，提升列表接口性能
	enrichModels(modelsMeta)
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
	res := service.SyncModelChannelAvailabilityAfterMutation("model.create")
	if !res.PricingRefreshed {
		model.RefreshPricing()
	}
	if err := reloadModelMetaAfterMutation(&m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, &m)
}

func reloadModelMetaAfterMutation(current *model.Model) error {
	if current == nil || current.Id == 0 {
		return nil
	}
	var persisted model.Model
	if err := model.DB.First(&persisted, current.Id).Error; err != nil {
		common.SysError(fmt.Sprintf("failed to reload model metadata after mutation: id=%d err=%v", current.Id, err))
		return fmt.Errorf("reload model metadata after mutation: %w", err)
	}
	*current = persisted
	return nil
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
		updateResult := model.DB.Model(&model.Model{}).Where("id = ?", m.Id).Updates(map[string]interface{}{
			"status":                m.Status,
			"auto_disabled_by_rule": false,
			"updated_time":          common.GetTimestamp(),
		})
		if updateResult.Error != nil {
			common.ApiError(c, updateResult.Error)
			return
		}
		if updateResult.RowsAffected == 0 {
			var count int64
			if err := model.DB.Model(&model.Model{}).Where("id = ?", m.Id).Count(&count).Error; err != nil {
				common.ApiError(c, err)
				return
			}
			if count == 0 {
				common.ApiError(c, gorm.ErrRecordNotFound)
				return
			}
		}
		// Re-evaluate immediately so auto-disable can correct a manual enable without channels.
		res := service.SyncModelChannelAvailabilityAfterMutation("model.status_update")
		if !res.PricingRefreshed {
			model.RefreshPricing()
		}
		if err := reloadModelMetaAfterMutation(&m); err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, &m)
		return
	}

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
	res := service.SyncModelChannelAvailabilityAfterMutation("model.update")
	if !res.PricingRefreshed {
		model.RefreshPricing()
	}
	if err := reloadModelMetaAfterMutation(&m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, &m)
}

type batchUpdateModelStatusRequest struct {
	Ids    []int `json:"ids"`
	Status int   `json:"status"`
}

// BatchUpdateModelStatus updates selected models and reconciles channel
// availability once for the whole batch.
func BatchUpdateModelStatus(c *gin.Context) {
	req := batchUpdateModelStatusRequest{}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Ids) == 0 || (req.Status != 0 && req.Status != 1) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if len(req.Ids) > 100 {
		common.ApiErrorI18n(c, i18n.MsgBatchTooMany, map[string]any{"Max": 100})
		return
	}

	ids := make([]int, 0, len(req.Ids))
	seen := make(map[int]struct{}, len(req.Ids))
	for _, id := range req.Ids {
		if id <= 0 {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	if err := model.DB.Model(&model.Model{}).
		Where("id IN ?", ids).
		Updates(map[string]interface{}{
			"status":                req.Status,
			"auto_disabled_by_rule": false,
			"updated_time":          common.GetTimestamp(),
		}).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	res := service.SyncModelChannelAvailabilityAfterMutation("model.status_update_batch")
	if !res.PricingRefreshed {
		model.RefreshPricing()
	}

	var persisted []model.Model
	if err := model.DB.Select("id", "status").Where("id IN ?", ids).Find(&persisted).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	statusByID := make(map[int]int, len(persisted))
	for i := range persisted {
		statusByID[persisted[i].Id] = persisted[i].Status
	}
	updated := 0
	failedIds := make([]int, 0)
	for _, id := range ids {
		if status, ok := statusByID[id]; ok && status == req.Status {
			updated++
			continue
		}
		failedIds = append(failedIds, id)
	}

	common.ApiSuccess(c, gin.H{
		"updated":    updated,
		"failed_ids": failedIds,
	})
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
	res := service.SyncModelChannelAvailabilityAfterMutation("model.delete")
	if !res.PricingRefreshed {
		model.RefreshPricing()
	}
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
				if b, err := json.Marshal(eps); err == nil {
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
			if b, err := json.Marshal(eps); err == nil {
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

// BatchDisableModelsNoChannels 批量禁用无可用渠道的模型
func BatchDisableModelsNoChannels(c *gin.Context) {
	result, err := service.ManualDisableModelsWithoutChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"disabled": result.Disabled,
		"enabled":  result.Enabled,
		"skipped":  result.Skipped,
		"reason":   result.Reason,
	})
}

// BatchEnableModelsWithChannels 批量启用：仅恢复被渠道可用性规则自动禁用、且现已有可用渠道的模型
func BatchEnableModelsWithChannels(c *gin.Context) {
	result, err := service.ManualEnableModelsWithChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"disabled": result.Disabled,
		"enabled":  result.Enabled,
		"skipped":  result.Skipped,
		"reason":   result.Reason,
	})
}
