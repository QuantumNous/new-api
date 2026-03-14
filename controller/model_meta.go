package controller

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-fuego/fuego"
)

// ModelsMetaListData is a typed version for OpenAPI schema generation.
type ModelsMetaListData struct {
	Items        []*model.Model  `json:"items"`
	Total        int64           `json:"total"`
	Page         int             `json:"page"`
	PageSize     int             `json:"page_size"`
	VendorCounts map[int64]int64 `json:"vendor_counts"`
}

// GetAllModelsMeta 获取模型列表（分页）
func GetAllModelsMeta(c fuego.ContextNoBody) (*dto.Response[ModelsMetaListData], error) {
	pageInfo := dto.PageInfo(c)
	modelsMeta, err := model.GetAllModels(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		return dto.Fail[ModelsMetaListData](err.Error())
	}
	// 批量填充附加字段，提升列表接口性能
	enrichModels(modelsMeta)
	var total int64
	model.DB.Model(&model.Model{}).Count(&total)

	// 统计供应商计数（全部数据，不受分页影响）
	vendorCounts, _ := model.GetVendorModelCounts()

	return dto.Ok(ModelsMetaListData{
		Items:        modelsMeta,
		Total:        total,
		Page:         pageInfo.GetPage(),
		PageSize:     pageInfo.GetPageSize(),
		VendorCounts: vendorCounts,
	})
}

// SearchModelsMeta 搜索模型列表
func SearchModelsMeta(c fuego.ContextWithParams[dto.SearchModelsMetaParams]) (*dto.Response[dto.PageData[*model.Model]], error) {
	p, _ := dto.ParseParams[dto.SearchModelsMetaParams](c)
	pageInfo := dto.PageInfo(c)

	modelsMeta, total, err := model.SearchModels(p.Keyword, p.Vendor, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		return dto.FailPage[*model.Model](err.Error())
	}
	// 批量填充附加字段，提升列表接口性能
	enrichModels(modelsMeta)
	return dto.OkPage(pageInfo, modelsMeta, int(total))
}

// GetModelMeta 根据 ID 获取单条模型信息
func GetModelMeta(c fuego.ContextNoBody) (*dto.Response[model.Model], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[model.Model](err.Error())
	}
	var m model.Model
	if err := model.DB.First(&m, id).Error; err != nil {
		return dto.Fail[model.Model](err.Error())
	}
	enrichModels([]*model.Model{&m})
	return dto.Ok(m)
}

// CreateModelMeta 新建模型
func CreateModelMeta(c fuego.ContextWithBody[model.Model]) (*dto.Response[model.Model], error) {
	m, err := c.Body()
	if err != nil {
		return dto.Fail[model.Model](err.Error())
	}
	if m.ModelName == "" {
		return dto.Fail[model.Model]("模型名称不能为空")
	}
	// 名称冲突检查
	if dup, err := model.IsModelNameDuplicated(0, m.ModelName); err != nil {
		return dto.Fail[model.Model](err.Error())
	} else if dup {
		return dto.Fail[model.Model]("模型名称已存在")
	}

	if err := m.Insert(); err != nil {
		return dto.Fail[model.Model](err.Error())
	}
	model.RefreshPricing()
	return dto.Ok(m)
}

// UpdateModelMeta 更新模型
func UpdateModelMeta(c fuego.Context[model.Model, dto.StatusOnlyParams]) (*dto.Response[model.Model], error) {
	p, _ := dto.ParseParams[dto.StatusOnlyParams](c)

	m, err := c.Body()
	if err != nil {
		return dto.Fail[model.Model](err.Error())
	}
	if m.Id == 0 {
		return dto.Fail[model.Model]("缺少模型 ID")
	}

	if p.StatusOnly == "true" {
		// 只更新状态，防止误清空其他字段
		if err := model.DB.Model(&model.Model{}).Where("id = ?", m.Id).Update("status", m.Status).Error; err != nil {
			return dto.Fail[model.Model](err.Error())
		}
	} else {
		// 名称冲突检查
		if dup, err := model.IsModelNameDuplicated(m.Id, m.ModelName); err != nil {
			return dto.Fail[model.Model](err.Error())
		} else if dup {
			return dto.Fail[model.Model]("模型名称已存在")
		}

		if err := m.Update(); err != nil {
			return dto.Fail[model.Model](err.Error())
		}
	}
	model.RefreshPricing()
	return dto.Ok(m)
}

// DeleteModelMeta 删除模型
func DeleteModelMeta(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if err := model.DB.Delete(&model.Model{}, id).Error; err != nil {
		return dto.FailMsg(err.Error())
	}
	model.RefreshPricing()
	return dto.Msg("")
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
