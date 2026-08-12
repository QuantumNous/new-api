package operation_setting

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

// PricingVisibilitySetting 控制定价接口对外暴露哪些模型。
// 仅影响 /api/pricing 与 /api/website/pricing 的展示，不影响模型可用性与实际调用。
type PricingVisibilitySetting struct {
	// HiddenModels 逗号分隔的模型名，支持 * 通配符，例如 "gpt-4o,claude-*,*-internal"
	HiddenModels string `json:"hidden_models"`
}

var pricingVisibilitySetting = PricingVisibilitySetting{
	HiddenModels: "",
}

func init() {
	config.GlobalConfig.Register("pricing_visibility_setting", &pricingVisibilitySetting)
}

func GetPricingVisibilitySetting() *PricingVisibilitySetting {
	return &pricingVisibilitySetting
}

var (
	pricingVisibilityListeners     []func()
	pricingVisibilityListenersLock sync.RWMutex
)

// OnPricingVisibilityChanged 注册配置变更回调。
// controller 层用它清理官网定价接口的响应缓存（model/controller 不能被 setting 反向引用）。
func OnPricingVisibilityChanged(listener func()) {
	if listener == nil {
		return
	}
	pricingVisibilityListenersLock.Lock()
	defer pricingVisibilityListenersLock.Unlock()
	pricingVisibilityListeners = append(pricingVisibilityListeners, listener)
}

// NotifyPricingVisibilityChanged 在隐藏名单更新后触发所有回调。
func NotifyPricingVisibilityChanged() {
	pricingVisibilityListenersLock.RLock()
	listeners := append([]func(){}, pricingVisibilityListeners...)
	pricingVisibilityListenersLock.RUnlock()

	for _, listener := range listeners {
		listener()
	}
}

// GetPricingHiddenModelPatterns 返回规范化后的隐藏规则（小写、去空、去重）。
func GetPricingHiddenModelPatterns() []string {
	raw := strings.FieldsFunc(pricingVisibilitySetting.HiddenModels, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r'
	})
	patterns := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, item := range raw {
		pattern := strings.ToLower(strings.TrimSpace(item))
		if pattern == "" {
			continue
		}
		if _, ok := seen[pattern]; ok {
			continue
		}
		seen[pattern] = struct{}{}
		patterns = append(patterns, pattern)
	}
	return patterns
}

// IsPricingHiddenModel 判断模型是否应从定价接口中隐藏。
func IsPricingHiddenModel(modelName string) bool {
	name := strings.ToLower(strings.TrimSpace(modelName))
	if name == "" {
		return false
	}
	for _, pattern := range GetPricingHiddenModelPatterns() {
		if matchPricingHiddenPattern(pattern, name) {
			return true
		}
	}
	return false
}

// matchPricingHiddenPattern 支持前缀/后缀/包含三种通配形式，其余按精确匹配。
func matchPricingHiddenPattern(pattern, name string) bool {
	if !strings.Contains(pattern, "*") {
		return pattern == name
	}
	if pattern == "*" {
		return true
	}

	hasPrefixWildcard := strings.HasPrefix(pattern, "*")
	hasSuffixWildcard := strings.HasSuffix(pattern, "*")
	core := strings.Trim(pattern, "*")
	if core == "" {
		return true
	}

	switch {
	case hasPrefixWildcard && hasSuffixWildcard:
		return strings.Contains(name, core)
	case hasPrefixWildcard:
		return strings.HasSuffix(name, core)
	case hasSuffixWildcard:
		return strings.HasPrefix(name, core)
	default:
		return pattern == name
	}
}
