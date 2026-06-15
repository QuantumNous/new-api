package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/types"
)

// claudeCacheRatioPrefix 与 claudeCacheRatioDefault：Claude 全系缓存读取倍率统一为 0.1。
// 之前 defaultCacheRatio 对每个 claude-* 型号逐条枚举 0.1，新增型号易漏配 → 漏配回退
// 到兜底 1（少收）。改为前缀规则后，未精确命中的 claude-* 型号回退到 0.1。
const (
	claudeCacheRatioPrefix  = "claude-"
	claudeCacheRatioDefault = 0.1
)

var defaultCacheRatio = map[string]float64{
	"gemini-3-flash-preview":       0.1,
	"gemini-3-pro-preview":         0.1,
	"gemini-3.1-pro-preview":       0.1,
	"gpt-4":                        0.5,
	"o1":                           0.5,
	"o1-2024-12-17":                0.5,
	"o1-preview-2024-09-12":        0.5,
	"o1-preview":                   0.5,
	"o1-mini-2024-09-12":           0.5,
	"o1-mini":                      0.5,
	"o3-mini":                      0.5,
	"o3-mini-2025-01-31":           0.5,
	"gpt-4o-2024-11-20":            0.5,
	"gpt-4o-2024-08-06":            0.5,
	"gpt-4o":                       0.5,
	"gpt-4o-mini-2024-07-18":       0.5,
	"gpt-4o-mini":                  0.5,
	"gpt-4o-realtime-preview":      0.5,
	"gpt-4o-mini-realtime-preview": 0.5,
	"gpt-4.5-preview":              0.5,
	"gpt-4.5-preview-2025-02-27":   0.5,
	"gpt-4.1":                      0.25,
	"gpt-4.1-mini":                 0.25,
	"gpt-4.1-nano":                 0.25,
	"gpt-5":                        0.1,
	"gpt-5-2025-08-07":             0.1,
	"gpt-5-chat-latest":            0.1,
	"gpt-5-mini":                   0.1,
	"gpt-5-mini-2025-08-07":        0.1,
	"gpt-5-nano":                   0.1,
	"gpt-5-nano-2025-08-07":        0.1,
	"deepseek-chat":                0.25,
	"deepseek-reasoner":            0.25,
	"deepseek-coder":               0.25,
	// claude-* 全系缓存倍率统一为 0.1，已由 GetCacheRatio 的 claude- 前缀回退覆盖，
	// 不再逐条枚举（避免新型号漏配）。如个别 claude 型号需要非 0.1 的特例，
	// 在此显式列出即可（精确命中优先于前缀回退）。
}

var defaultCreateCacheRatio = map[string]float64{
	"claude-3-sonnet-20240229":            1.25,
	"claude-3-opus-20240229":              1.25,
	"claude-3-haiku-20240307":             1.25,
	"claude-3-5-haiku-20241022":           1.25,
	"claude-haiku-4-5-20251001":           1.25,
	"claude-3-5-sonnet-20240620":          1.25,
	"claude-3-5-sonnet-20241022":          1.25,
	"claude-3-7-sonnet-20250219":          1.25,
	"claude-3-7-sonnet-20250219-thinking": 1.25,
	"claude-sonnet-4-20250514":            1.25,
	"claude-sonnet-4-20250514-thinking":   1.25,
	"claude-opus-4-20250514":              1.25,
	"claude-opus-4-20250514-thinking":     1.25,
	"claude-opus-4-1-20250805":            1.25,
	"claude-opus-4-1-20250805-thinking":   1.25,
	"claude-sonnet-4-5-20250929":          1.25,
	"claude-sonnet-4-5-20250929-thinking": 1.25,
	"claude-opus-4-5-20251101":            1.25,
	"claude-opus-4-5-20251101-thinking":   1.25,
	"claude-opus-4-6":                     1.25,
	"claude-opus-4-6-thinking":            1.25,
	"claude-opus-4-6-max":                 1.25,
	"claude-opus-4-6-high":                1.25,
	"claude-opus-4-6-medium":              1.25,
	"claude-opus-4-6-low":                 1.25,
	"claude-opus-4-7":                     1.25,
	"claude-opus-4-7-thinking":            1.25,
	"claude-opus-4-7-max":                 1.25,
	"claude-opus-4-7-xhigh":               1.25,
	"claude-opus-4-7-high":                1.25,
	"claude-opus-4-7-medium":              1.25,
	"claude-opus-4-7-low":                 1.25,
}

// 缓存倍率兜底：未配置=不打折(1)；创建缓存兜底=1.25
const (
	defaultCacheRatioFallback       = 1.0  // 未配置缓存倍率时不打折
	defaultCreateCacheRatioFallback = 1.25 // 未配置创建缓存倍率时的默认值
)

var cacheRatioMap = types.NewRWMap[string, float64]()
var createCacheRatioMap = types.NewRWMap[string, float64]()

// GetCacheRatioMap returns a copy of the cache ratio map
func GetCacheRatioMap() map[string]float64 {
	return cacheRatioMap.ReadAll()
}

// CacheRatio2JSONString converts the cache ratio map to a JSON string
func CacheRatio2JSONString() string {
	return cacheRatioMap.MarshalJSONString()
}

// CreateCacheRatio2JSONString converts the create cache ratio map to a JSON string
func CreateCacheRatio2JSONString() string {
	return createCacheRatioMap.MarshalJSONString()
}

// UpdateCacheRatioByJSONString updates the cache ratio map from a JSON string
func UpdateCacheRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(cacheRatioMap, jsonStr, InvalidateExposedDataCache)
}

// UpdateCreateCacheRatioByJSONString updates the create cache ratio map from a JSON string
func UpdateCreateCacheRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(createCacheRatioMap, jsonStr, InvalidateExposedDataCache)
}

// GetCacheRatio returns the cache ratio for a model.
//
// 查找顺序：
//  1. 精确命中（运行期 cacheRatioMap，含默认值与管理员覆盖）；
//  2. 前缀回退：未精确命中且模型名匹配已知前缀（claude-*）时返回该前缀默认值，
//     避免新 claude 型号漏配后回退到兜底 1（少收）；
//  3. 兜底：返回 defaultCacheRatioFallback(=1)，bool=false。
//
// bool 表示「命中了有意义的缓存倍率」（精确或前缀），用于决定是否对外暴露该值。
func GetCacheRatio(name string) (float64, bool) {
	if ratio, ok := cacheRatioMap.Get(name); ok {
		return ratio, true
	}
	if ratio, ok := cacheRatioPrefixFallback(name); ok {
		return ratio, true
	}
	return defaultCacheRatioFallback, false // Default to 1 if not found
}

// cacheRatioPrefixFallback 按已知前缀规则回退缓存倍率。目前仅 claude-* → 0.1。
func cacheRatioPrefixFallback(name string) (float64, bool) {
	if strings.HasPrefix(name, claudeCacheRatioPrefix) {
		return claudeCacheRatioDefault, true
	}
	return 0, false
}

func GetCreateCacheRatio(name string) (float64, bool) {
	ratio, ok := createCacheRatioMap.Get(name)
	if !ok {
		return defaultCreateCacheRatioFallback, false // Default to 1.25 if not found
	}
	return ratio, true
}

func GetCacheRatioCopy() map[string]float64 {
	return cacheRatioMap.ReadAll()
}

func GetCreateCacheRatioCopy() map[string]float64 {
	return createCacheRatioMap.ReadAll()
}
