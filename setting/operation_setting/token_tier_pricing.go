package operation_setting

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/shopspring/decimal"
)

// TokenTierRule 四段计费规则（支持独立的输入/输出价格）
type TokenTierRule struct {
	Name            string `json:"name"`              // 规则名，例如 "T1_input_le_32k_output_le_200"
	MaxInputTokens  int    `json:"max_input_tokens"`  // 最大输入 tokens，0 表示无上限
	MinInputTokens  int    `json:"min_input_tokens"`  // 最小输入 tokens，默认 0
	MaxOutputTokens int    `json:"max_output_tokens"` // 最大输出 tokens，0 表示无上限
	MinOutputTokens int    `json:"min_output_tokens"` // 最小输出 tokens，默认 0
	// 价格模式：直接设置美金价格（USD / 1M tokens）
	InputPrice  float64 `json:"input_price"`  // 输入价格（USD / 1M tokens），0表示使用倍率
	OutputPrice float64 `json:"output_price"` // 输出价格（USD / 1M tokens），0表示使用倍率
	// 倍率模式：基于系统默认倍率（1倍率 = $2/1M tokens）
	InputRatio      float64 `json:"input_ratio"`      // 输入倍率，0表示使用价格
	CompletionRatio float64 `json:"completion_ratio"` // 输出倍率（相对于输入），默认1.0
}

// ModelTierPricing 单个模型的四段计费配置
type ModelTierPricing struct {
	Enabled bool            `json:"enabled"` // 是否启用该模型的四段计费
	Models  string          `json:"models"`  // 模型名称列表，逗号分割，支持通配符
	Rules   []TokenTierRule `json:"rules"`   // 该模型的计费规则
}

// TokenTierPricingConfig 四段计费配置（支持每个模型独立配置）
type TokenTierPricingConfig struct {
	GlobalEnabled bool                        `json:"global_enabled"` // 全局开关
	ModelConfigs  map[string]ModelTierPricing `json:"model_configs"`  // 按配置名存储配置
}

// TokenTierPriceResult 四段计费匹配结果
type TokenTierPriceResult struct {
	Matched         bool    // 是否匹配到规则
	RuleName        string  // 匹配的规则名称
	InputPrice      float64 // 输入价格（USD / 1M tokens）
	OutputPrice     float64 // 输出价格（USD / 1M tokens）
	UseRatio        bool    // 是否使用倍率模式
	InputRatio      float64 // 输入倍率
	CompletionRatio float64 // 输出倍率
}

// 配置锁
var tokenTierPricingMutex sync.RWMutex

// 默认配置
var tokenTierPricingConfig = TokenTierPricingConfig{
	GlobalEnabled: false,
	ModelConfigs:  make(map[string]ModelTierPricing),
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("token_tier_pricing", &tokenTierPricingConfig)
}

// GetTokenTierPricingConfig 获取四段计费配置
func GetTokenTierPricingConfig() *TokenTierPricingConfig {
	tokenTierPricingMutex.RLock()
	defer tokenTierPricingMutex.RUnlock()
	return &tokenTierPricingConfig
}

// SetModelTierPricing 设置单个模型的四段计费配置
func SetModelTierPricing(configName string, pricing ModelTierPricing) {
	tokenTierPricingMutex.Lock()
	defer tokenTierPricingMutex.Unlock()
	if tokenTierPricingConfig.ModelConfigs == nil {
		tokenTierPricingConfig.ModelConfigs = make(map[string]ModelTierPricing)
	}
	tokenTierPricingConfig.ModelConfigs[configName] = pricing
}

// DeleteModelTierPricing 删除单个模型的四段计费配置
func DeleteModelTierPricing(configName string) {
	tokenTierPricingMutex.Lock()
	defer tokenTierPricingMutex.Unlock()
	if tokenTierPricingConfig.ModelConfigs != nil {
		delete(tokenTierPricingConfig.ModelConfigs, configName)
	}
}

// ResolveTokenTierPrice 根据模型名和输入输出token数解析四段计费价格
func ResolveTokenTierPrice(modelName string, inputTokens, outputTokens int) TokenTierPriceResult {
	result := TokenTierPriceResult{}

	tokenTierPricingMutex.RLock()
	defer tokenTierPricingMutex.RUnlock()

	// 1. 检查全局开关是否启用
	if !tokenTierPricingConfig.GlobalEnabled {
		return result
	}

	// 2. 查找模型配置（支持精确匹配和通配符匹配）
	modelPricing, found := findModelPricing(modelName)
	if !found || !modelPricing.Enabled {
		return result
	}

	// 3. 规则按顺序匹配
	for _, rule := range modelPricing.Rules {
		if !matchRule(rule, inputTokens, outputTokens) {
			continue
		}

		result.Matched = true
		result.RuleName = rule.Name

		// 判断使用价格模式还是倍率模式
		if rule.InputPrice > 0 || rule.OutputPrice > 0 {
			// 价格模式
			result.UseRatio = false
			result.InputPrice = rule.InputPrice
			result.OutputPrice = rule.OutputPrice
		} else {
			// 倍率模式
			result.UseRatio = true
			result.InputRatio = rule.InputRatio
			result.CompletionRatio = rule.CompletionRatio
			if result.CompletionRatio == 0 {
				result.CompletionRatio = 1.0
			}
		}
		return result
	}

	return result
}

// findModelPricing 查找模型配置（支持精确匹配和通配符匹配）
func findModelPricing(modelName string) (ModelTierPricing, bool) {
	for _, pricing := range tokenTierPricingConfig.ModelConfigs {
		if matchModels(modelName, pricing.Models) {
			return pricing, true
		}
	}
	return ModelTierPricing{}, false
}

// matchModels 检查模型名是否匹配配置中的模型列表（逗号分割，支持通配符）
func matchModels(modelName, modelsStr string) bool {
	if modelsStr == "" {
		return false
	}

	// 按逗号分割模型列表
	models := strings.Split(modelsStr, ",")
	for _, pattern := range models {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		if matchModelPattern(modelName, pattern) {
			return true
		}
	}
	return false
}

// matchRule 检查规则是否匹配
func matchRule(rule TokenTierRule, inputTokens, outputTokens int) bool {
	// 检查输入 tokens 范围
	if inputTokens < rule.MinInputTokens {
		return false
	}
	if rule.MaxInputTokens > 0 && inputTokens > rule.MaxInputTokens {
		return false
	}

	// 检查输出 tokens 范围
	if outputTokens < rule.MinOutputTokens {
		return false
	}
	if rule.MaxOutputTokens > 0 && outputTokens > rule.MaxOutputTokens {
		return false
	}

	return true
}

// matchModelPattern 模型名称匹配（支持 * 通配符）
func matchModelPattern(modelName, pattern string) bool {
	// 完全匹配
	if modelName == pattern {
		return true
	}

	// 通配符匹配：支持 * 作为后缀
	if strings.HasSuffix(pattern, "*") {
		prefix := strings.TrimSuffix(pattern, "*")
		return strings.HasPrefix(modelName, prefix)
	}

	return false
}

// CalcQuotaByTierPrice 根据四段计费规则计算额度（价格模式，USD）
func CalcQuotaByTierPrice(
	inputTokens, outputTokens int,
	inputPriceUSD, outputPriceUSD float64,
	quotaPerUnit decimal.Decimal,
	groupRatio decimal.Decimal,
) decimal.Decimal {
	dInputTokens := decimal.NewFromInt(int64(inputTokens))
	dOutputTokens := decimal.NewFromInt(int64(outputTokens))
	dInputPrice := decimal.NewFromFloat(inputPriceUSD)
	dOutputPrice := decimal.NewFromFloat(outputPriceUSD)
	dMillion := decimal.NewFromInt(1_000_000)

	// 输入quota = 输入tokens * (输入价格USD / 1M) * QuotaPerUnit * GroupRatio
	inputQuota := dInputTokens.
		Mul(dInputPrice).
		Div(dMillion).
		Mul(quotaPerUnit).
		Mul(groupRatio)

	// 输出quota = 输出tokens * (输出价格USD / 1M) * QuotaPerUnit * GroupRatio
	outputQuota := dOutputTokens.
		Mul(dOutputPrice).
		Div(dMillion).
		Mul(quotaPerUnit).
		Mul(groupRatio)

	totalQuota := inputQuota.Add(outputQuota)

	// 确保最小消耗为1（如果有消耗的话）
	if (inputTokens > 0 || outputTokens > 0) && totalQuota.LessThan(decimal.NewFromInt(1)) {
		return decimal.NewFromInt(1)
	}

	return totalQuota
}

// CalcQuotaByTierRatio 根据四段计费规则计算额度（倍率模式）
func CalcQuotaByTierRatio(
	inputTokens, outputTokens int,
	inputRatio, completionRatio float64,
	groupRatio decimal.Decimal,
) decimal.Decimal {
	dInputTokens := decimal.NewFromInt(int64(inputTokens))
	dOutputTokens := decimal.NewFromInt(int64(outputTokens))
	dInputRatio := decimal.NewFromFloat(inputRatio)
	dCompletionRatio := decimal.NewFromFloat(completionRatio)

	// 输入quota = 输入tokens * 输入倍率 * GroupRatio
	inputQuota := dInputTokens.Mul(dInputRatio).Mul(groupRatio)

	// 输出quota = 输出tokens * 输入倍率 * 输出倍率 * GroupRatio
	outputQuota := dOutputTokens.Mul(dInputRatio).Mul(dCompletionRatio).Mul(groupRatio)

	totalQuota := inputQuota.Add(outputQuota)

	// 确保最小消耗为1（如果有消耗的话）
	if (inputTokens > 0 || outputTokens > 0) && totalQuota.LessThan(decimal.NewFromInt(1)) {
		return decimal.NewFromInt(1)
	}

	return totalQuota
}

// GetUSDExchangeRate 获取USD兑CNY汇率
func GetUSDExchangeRate() float64 {
	return USDExchangeRate
}

// GetDefaultTierRules 获取默认的四段计费规则模板（使用倍率模式）
func GetDefaultTierRules() []TokenTierRule {
	return []TokenTierRule{
		{
			Name:            "T1_input_le_32k_output_le_200",
			MinInputTokens:  0,
			MaxInputTokens:  32000,
			MinOutputTokens: 0,
			MaxOutputTokens: 200,
			InputRatio:      0.4,
			CompletionRatio: 1.0,
		},
		{
			Name:            "T2_input_le_32k_output_gt_200",
			MinInputTokens:  0,
			MaxInputTokens:  32000,
			MinOutputTokens: 201,
			MaxOutputTokens: 0,
			InputRatio:      0.4,
			CompletionRatio: 1.5,
		},
		{
			Name:            "T3_input_32k_to_128k",
			MinInputTokens:  32001,
			MaxInputTokens:  128000,
			MinOutputTokens: 0,
			MaxOutputTokens: 0,
			InputRatio:      0.6,
			CompletionRatio: 1.0,
		},
		{
			Name:            "T4_input_gt_128k",
			MinInputTokens:  128001,
			MaxInputTokens:  0,
			MinOutputTokens: 0,
			MaxOutputTokens: 0,
			InputRatio:      1.2,
			CompletionRatio: 1.0,
		},
	}
}
