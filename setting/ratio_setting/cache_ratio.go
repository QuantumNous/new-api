package ratio_setting

import (
	_ "embed"
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

// 默认缓存倍率表外置为 embed JSON，值采用 top（tln-special-1）线上 DB option，
// 与其余默认表同源（任务 06-15-default-pricing-from-top）。claude-* 全系缓存读取
// 倍率仍由 GetCacheRatio 的 claude- 前缀回退（claudeCacheRatioDefault=0.1）兜底，
// 默认表只列 top 现役模型的显式值；如个别型号需非默认特例，加进 JSON（精确命中优先）。
//
//go:embed data/default_cache_ratio.json
var defaultCacheRatioJSON []byte

//go:embed data/default_create_cache_ratio.json
var defaultCreateCacheRatioJSON []byte

var defaultCacheRatio = mustParseRatioTable("default_cache_ratio.json", defaultCacheRatioJSON)
var defaultCreateCacheRatio = mustParseRatioTable("default_create_cache_ratio.json", defaultCreateCacheRatioJSON)

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
