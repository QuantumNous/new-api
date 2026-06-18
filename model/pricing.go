package model

import (
	"fmt"
	"math"
	"strings"

	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
)

type Pricing struct {
	Id                     int                                `json:"id,omitempty"`
	ModelName              string                             `json:"model_name"`
	Description            string                             `json:"description,omitempty"`
	Icon                   string                             `json:"icon,omitempty"`
	Tags                   string                             `json:"tags,omitempty"`
	VendorID               int                                `json:"vendor_id,omitempty"`
	QuotaType              int                                `json:"quota_type"`
	ModelRatio             float64                            `json:"model_ratio"`
	ModelPrice             float64                            `json:"model_price"`
	OwnerBy                string                             `json:"owner_by"`
	CompletionRatio        float64                            `json:"completion_ratio"`
	CacheRatio             *float64                           `json:"cache_ratio,omitempty"`
	CreateCacheRatio       *float64                           `json:"create_cache_ratio,omitempty"`
	ImageRatio             *float64                           `json:"image_ratio,omitempty"`
	AudioRatio             *float64                           `json:"audio_ratio,omitempty"`
	AudioCompletionRatio   *float64                           `json:"audio_completion_ratio,omitempty"`
	EnableGroup            []string                           `json:"enable_groups"`
	SupportedEndpointTypes []constant.EndpointType            `json:"supported_endpoint_types"`
	BillingMode            string                             `json:"billing_mode,omitempty"`
	BillingExpr            string                             `json:"billing_expr,omitempty"`
	GroupPricing           map[string]types.ModelGroupPricing `json:"group_pricing,omitempty"`
	PricingVersion         string                             `json:"pricing_version,omitempty"`
	ModelMinFee            float64                            `json:"model_min_fee,omitempty"`
}

type PricingVendor struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
}

var (
	pricingMap           []Pricing
	vendorsList          []PricingVendor
	supportedEndpointMap map[string]common.EndpointInfo
	lastGetPricingTime   time.Time
	updatePricingLock    sync.Mutex

	// 缓存映射：模型名 -> 启用分组 / 计费类型
	modelEnableGroups     = make(map[string][]string)
	modelQuotaTypeMap     = make(map[string]int)
	modelGroupPricingMap  = make(map[string]map[string]types.ModelGroupPricing)
	modelEnableGroupsLock = sync.RWMutex{}
)

var (
	modelSupportEndpointTypes = make(map[string][]constant.EndpointType)
	modelSupportEndpointsLock = sync.RWMutex{}
)

func GetPricing() []Pricing {
	if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
		updatePricingLock.Lock()
		defer updatePricingLock.Unlock()
		// Double check after acquiring the lock
		if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
			modelSupportEndpointsLock.Lock()
			defer modelSupportEndpointsLock.Unlock()
			updatePricing()
		}
	}
	return pricingMap
}

func InvalidatePricingCache() {
	updatePricingLock.Lock()
	defer updatePricingLock.Unlock()

	pricingMap = nil
	vendorsList = nil
	lastGetPricingTime = time.Time{}
}

// GetVendors 返回当前定价接口使用到的供应商信息
func GetVendors() []PricingVendor {
	if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
		// 保证先刷新一次
		GetPricing()
	}
	return vendorsList
}

func GetModelSupportEndpointTypes(model string) []constant.EndpointType {
	if model == "" {
		return make([]constant.EndpointType, 0)
	}
	modelSupportEndpointsLock.RLock()
	defer modelSupportEndpointsLock.RUnlock()
	if endpoints, ok := modelSupportEndpointTypes[model]; ok {
		return endpoints
	}
	return make([]constant.EndpointType, 0)
}

func isFiniteNonNegative(value float64) bool {
	return value >= 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}

func sanitizeModelGroupPricingItem(item types.ModelGroupPricing) (types.ModelGroupPricing, bool) {
	cleaned := types.ModelGroupPricing{}
	if item.Ratio != nil && isFiniteNonNegative(*item.Ratio) {
		value := *item.Ratio
		cleaned.Ratio = &value
	}
	for _, pair := range []struct {
		source *float64
		assign func(float64)
	}{
		{item.ModelPrice, func(value float64) { cleaned.ModelPrice = &value }},
		{item.PromptPrice, func(value float64) { cleaned.PromptPrice = &value }},
		{item.CompletionPrice, func(value float64) { cleaned.CompletionPrice = &value }},
		{item.CachePrice, func(value float64) { cleaned.CachePrice = &value }},
		{item.CreateCachePrice, func(value float64) { cleaned.CreateCachePrice = &value }},
		{item.ImagePrice, func(value float64) { cleaned.ImagePrice = &value }},
		{item.AudioPrice, func(value float64) { cleaned.AudioPrice = &value }},
		{item.AudioCompletionPrice, func(value float64) { cleaned.AudioCompletionPrice = &value }},
		{item.MinFee, func(value float64) { cleaned.MinFee = &value }},
	} {
		if pair.source != nil && isFiniteNonNegative(*pair.source) {
			pair.assign(*pair.source)
		}
	}
	if item.BillingMode != nil {
		mode := strings.TrimSpace(*item.BillingMode)
		switch mode {
		case types.GroupBillingModePerToken, types.GroupBillingModePerRequest:
			cleaned.BillingMode = &mode
		case types.GroupBillingModeTieredExpr:
			if item.BillingExpr != nil {
				expr := strings.TrimSpace(*item.BillingExpr)
				if expr != "" {
					cleaned.BillingMode = &mode
					cleaned.BillingExpr = &expr
				}
			}
			// tiered_expr with empty expr: drop the mode (treated as inherit)
		}
		// any other value: invalid -> dropped (inherit)
	}
	return cleaned, !cleaned.IsEmpty()
}

func parseModelGroupPricing(raw string) map[string]types.ModelGroupPricing {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	values := make(map[string]types.ModelGroupPricing)
	if err := common.Unmarshal([]byte(raw), &values); err != nil {
		return nil
	}

	cleaned := make(map[string]types.ModelGroupPricing, len(values))
	for group, item := range values {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		if sanitized, ok := sanitizeModelGroupPricingItem(item); ok {
			cleaned[group] = sanitized
		}
	}
	if len(cleaned) == 0 {
		return nil
	}
	return cleaned
}

func GetModelGroupPricing(modelName, group string) (types.ModelGroupPricing, bool) {
	if strings.TrimSpace(modelName) == "" || strings.TrimSpace(group) == "" {
		return types.ModelGroupPricing{}, false
	}
	rawModelName := strings.TrimSpace(modelName)
	if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
		if DB == nil {
			return types.ModelGroupPricing{}, false
		}
		GetPricing()
	}

	modelName = ratio_setting.FormatMatchingModelName(rawModelName)
	modelEnableGroupsLock.RLock()
	defer modelEnableGroupsLock.RUnlock()

	if groups, ok := modelGroupPricingMap[modelName]; ok {
		pricing, exists := groups[group]
		return pricing, exists
	}
	if modelName != rawModelName {
		if groups, ok := modelGroupPricingMap[rawModelName]; ok {
			pricing, exists := groups[group]
			return pricing, exists
		}
	}
	return types.ModelGroupPricing{}, false
}

func GetModelGroupRatio(modelName, group string) (float64, bool) {
	pricing, ok := GetModelGroupPricing(modelName, group)
	if !ok || pricing.Ratio == nil {
		return 0, false
	}
	return *pricing.Ratio, true
}

func GetModelGroupPriceOverrides(modelName, group string) (types.ModelGroupPricing, bool) {
	pricing, ok := GetModelGroupPricing(modelName, group)
	if !ok || (!pricing.HasPriceOverride() && !pricing.HasBillingMode() && !pricing.HasMinFee()) {
		return types.ModelGroupPricing{}, false
	}
	return pricing, true
}

func getPricingRatio(item types.ModelGroupPricing) (float64, bool) {
	if item.Ratio == nil {
		return 0, false
	}
	return *item.Ratio, true
}

func modelGroupPricingRatioView(values map[string]types.ModelGroupPricing) map[string]interface{} {
	if len(values) == 0 {
		return nil
	}
	result := make(map[string]interface{}, len(values))
	for group, item := range values {
		if !item.HasPriceOverride() && !item.HasBillingMode() && !item.HasMinFee() {
			if ratio, ok := getPricingRatio(item); ok {
				result[group] = ratio
				continue
			}
		}
		result[group] = item
	}
	return result
}

func legacyModelGroupPricingRatios(values map[string]types.ModelGroupPricing) map[string]float64 {
	if len(values) == 0 {
		return nil
	}
	result := make(map[string]float64, len(values))
	for group, item := range values {
		if ratio, ok := getPricingRatio(item); ok {
			result[group] = ratio
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func legacyParseModelGroupPricing(raw string) map[string]float64 {
	values := parseModelGroupPricing(raw)
	return legacyModelGroupPricingRatios(values)
}

func NormalizeModelGroupPricing(values map[string]types.ModelGroupPricing) map[string]types.ModelGroupPricing {
	cleaned := make(map[string]types.ModelGroupPricing)
	for group, item := range values {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		if sanitized, ok := sanitizeModelGroupPricingItem(item); ok {
			cleaned[group] = sanitized
		}
	}
	return cleaned
}

func ModelGroupPricingJSON(values map[string]types.ModelGroupPricing) (string, error) {
	cleaned := NormalizeModelGroupPricing(values)
	raw, err := common.Marshal(cleaned)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func updatePricing() {
	//modelRatios := common.GetModelRatios()
	enableAbilities, err := GetAllEnableAbilityWithChannels()
	if err != nil {
		common.SysLog(fmt.Sprintf("GetAllEnableAbilityWithChannels error: %v", err))
		return
	}
	// 预加载模型元数据与供应商一次，避免循环查询
	var allMeta []Model
	_ = DB.Find(&allMeta).Error
	metaMap := make(map[string]*Model)
	prefixList := make([]*Model, 0)
	suffixList := make([]*Model, 0)
	containsList := make([]*Model, 0)
	for i := range allMeta {
		m := &allMeta[i]
		if m.NameRule == NameRuleExact {
			metaMap[m.ModelName] = m
		} else {
			switch m.NameRule {
			case NameRulePrefix:
				prefixList = append(prefixList, m)
			case NameRuleSuffix:
				suffixList = append(suffixList, m)
			case NameRuleContains:
				containsList = append(containsList, m)
			}
		}
	}

	// 将非精确规则模型匹配到 metaMap
	for _, m := range prefixList {
		for _, pricingModel := range enableAbilities {
			if strings.HasPrefix(pricingModel.Model, m.ModelName) {
				if _, exists := metaMap[pricingModel.Model]; !exists {
					metaMap[pricingModel.Model] = m
				}
			}
		}
	}
	for _, m := range suffixList {
		for _, pricingModel := range enableAbilities {
			if strings.HasSuffix(pricingModel.Model, m.ModelName) {
				if _, exists := metaMap[pricingModel.Model]; !exists {
					metaMap[pricingModel.Model] = m
				}
			}
		}
	}
	for _, m := range containsList {
		for _, pricingModel := range enableAbilities {
			if strings.Contains(pricingModel.Model, m.ModelName) {
				if _, exists := metaMap[pricingModel.Model]; !exists {
					metaMap[pricingModel.Model] = m
				}
			}
		}
	}

	// 预加载供应商
	var vendors []Vendor
	_ = DB.Find(&vendors).Error
	vendorMap := make(map[int]*Vendor)
	for i := range vendors {
		vendorMap[vendors[i].Id] = &vendors[i]
	}

	// 初始化默认供应商映射
	initDefaultVendorMapping(metaMap, vendorMap, enableAbilities)

	// 构建对前端友好的供应商列表
	vendorsList = make([]PricingVendor, 0, len(vendorMap))
	for _, v := range vendorMap {
		vendorsList = append(vendorsList, PricingVendor{
			ID:          v.Id,
			Name:        v.Name,
			Description: v.Description,
			Icon:        v.Icon,
		})
	}

	modelGroupsMap := make(map[string]*types.Set[string])

	for _, ability := range enableAbilities {
		groups, ok := modelGroupsMap[ability.Model]
		if !ok {
			groups = types.NewSet[string]()
			modelGroupsMap[ability.Model] = groups
		}
		groups.Add(ability.Group)
	}

	//这里使用切片而不是Set，因为一个模型可能支持多个端点类型，并且第一个端点是优先使用端点
	modelSupportEndpointsStr := make(map[string][]string)

	// 先根据已有能力填充原生端点
	for _, ability := range enableAbilities {
		endpoints := modelSupportEndpointsStr[ability.Model]
		channelTypes := common.GetEndpointTypesByChannelType(ability.ChannelType, ability.Model)
		for _, channelType := range channelTypes {
			if !common.StringsContains(endpoints, string(channelType)) {
				endpoints = append(endpoints, string(channelType))
			}
		}
		modelSupportEndpointsStr[ability.Model] = endpoints
	}

	// 再补充模型自定义端点：若配置有效则替换默认端点，不做合并
	for modelName, meta := range metaMap {
		if strings.TrimSpace(meta.Endpoints) == "" {
			continue
		}
		var raw map[string]interface{}
		if err := common.Unmarshal([]byte(meta.Endpoints), &raw); err == nil {
			endpoints := make([]string, 0, len(raw))
			for k, v := range raw {
				switch v.(type) {
				case string, map[string]interface{}:
					if !common.StringsContains(endpoints, k) {
						endpoints = append(endpoints, k)
					}
				}
			}
			if len(endpoints) > 0 {
				modelSupportEndpointsStr[modelName] = endpoints
			}
		}
	}

	modelSupportEndpointTypes = make(map[string][]constant.EndpointType)
	for model, endpoints := range modelSupportEndpointsStr {
		supportedEndpoints := make([]constant.EndpointType, 0)
		for _, endpointStr := range endpoints {
			endpointType := constant.EndpointType(endpointStr)
			supportedEndpoints = append(supportedEndpoints, endpointType)
		}
		modelSupportEndpointTypes[model] = supportedEndpoints
	}

	// 构建全局 supportedEndpointMap（默认 + 自定义覆盖）
	supportedEndpointMap = make(map[string]common.EndpointInfo)
	// 1. 默认端点
	for _, endpoints := range modelSupportEndpointTypes {
		for _, et := range endpoints {
			if info, ok := common.GetDefaultEndpointInfo(et); ok {
				if _, exists := supportedEndpointMap[string(et)]; !exists {
					supportedEndpointMap[string(et)] = info
				}
			}
		}
	}
	// 2. 自定义端点（models 表）覆盖默认
	for _, meta := range metaMap {
		if strings.TrimSpace(meta.Endpoints) == "" {
			continue
		}
		var raw map[string]interface{}
		if err := common.Unmarshal([]byte(meta.Endpoints), &raw); err == nil {
			for k, v := range raw {
				switch val := v.(type) {
				case string:
					supportedEndpointMap[k] = common.EndpointInfo{Path: val, Method: "POST"}
				case map[string]interface{}:
					ep := common.EndpointInfo{Method: "POST"}
					if p, ok := val["path"].(string); ok {
						ep.Path = p
					}
					if m, ok := val["method"].(string); ok {
						ep.Method = strings.ToUpper(m)
					}
					supportedEndpointMap[k] = ep
				default:
					// ignore unsupported types
				}
			}
		}
	}

	pricingMap = make([]Pricing, 0)
	for model, groups := range modelGroupsMap {
		pricing := Pricing{
			ModelName:              model,
			EnableGroup:            groups.Items(),
			SupportedEndpointTypes: modelSupportEndpointTypes[model],
		}

		// 补充模型元数据（描述、标签、供应商、状态）
		if meta, ok := metaMap[model]; ok {
			// 若模型被禁用(status!=1)，则直接跳过，不返回给前端
			if meta.Status != 1 {
				continue
			}
			pricing.Id = meta.Id
			pricing.Description = meta.Description
			pricing.Icon = meta.Icon
			pricing.Tags = meta.Tags
			pricing.VendorID = meta.VendorID
			pricing.GroupPricing = parseModelGroupPricing(meta.GroupPricing)
		}
		modelPrice, findPrice := ratio_setting.GetModelPrice(model, false)
		if findPrice {
			pricing.ModelPrice = modelPrice
			pricing.QuotaType = 1
		} else {
			modelRatio, _, _ := ratio_setting.GetModelRatio(model)
			pricing.ModelRatio = modelRatio
			pricing.CompletionRatio = ratio_setting.GetCompletionRatio(model)
			pricing.QuotaType = 0
		}
		if minFee, ok := ratio_setting.GetModelMinFee(model); ok {
			pricing.ModelMinFee = minFee
		}
		if cacheRatio, ok := ratio_setting.GetCacheRatio(model); ok {
			pricing.CacheRatio = &cacheRatio
		}
		if createCacheRatio, ok := ratio_setting.GetCreateCacheRatio(model); ok {
			pricing.CreateCacheRatio = &createCacheRatio
		}
		if imageRatio, ok := ratio_setting.GetImageRatio(model); ok {
			pricing.ImageRatio = &imageRatio
		}
		if ratio_setting.ContainsAudioRatio(model) {
			audioRatio := ratio_setting.GetAudioRatio(model)
			pricing.AudioRatio = &audioRatio
		}
		if ratio_setting.ContainsAudioCompletionRatio(model) {
			audioCompletionRatio := ratio_setting.GetAudioCompletionRatio(model)
			pricing.AudioCompletionRatio = &audioCompletionRatio
		}
		if billingMode := billing_setting.GetBillingMode(model); billingMode == "tiered_expr" {
			if expr, ok := billing_setting.GetBillingExpr(model); ok && strings.TrimSpace(expr) != "" {
				pricing.BillingMode = billingMode
				pricing.BillingExpr = expr
			}
		}
		pricingMap = append(pricingMap, pricing)
	}

	// 防止大更新后数据不通用
	if len(pricingMap) > 0 {
		pricingMap[0].PricingVersion = "5a90f2b86c08bd983a9a2e6d66c255f4eaef9c4bc934386d2b6ae84ef0ff1f1f"
	}

	// 刷新缓存映射，供高并发快速查询
	modelEnableGroupsLock.Lock()
	modelEnableGroups = make(map[string][]string)
	modelQuotaTypeMap = make(map[string]int)
	modelGroupPricingMap = make(map[string]map[string]types.ModelGroupPricing)
	for _, p := range pricingMap {
		modelEnableGroups[p.ModelName] = p.EnableGroup
		modelQuotaTypeMap[p.ModelName] = p.QuotaType
		if len(p.GroupPricing) > 0 {
			modelGroupPricingMap[p.ModelName] = p.GroupPricing
		}
	}
	modelEnableGroupsLock.Unlock()

	lastGetPricingTime = time.Now()
}

// GetSupportedEndpointMap 返回全局端点到路径的映射
func GetSupportedEndpointMap() map[string]common.EndpointInfo {
	return supportedEndpointMap
}
