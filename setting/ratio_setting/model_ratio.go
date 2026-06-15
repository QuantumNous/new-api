package ratio_setting

import (
	_ "embed"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

// from songquanpeng/one-api
const (
	USD2RMB = 7.3 // 暂定 1 USD = 7.3 RMB
	USD     = 500 // $0.002 = 1 -> $1 = 500
	RMB     = USD / USD2RMB
)

// USD 与 common.QuotaPerUnit 是同一计费基准的两个表达：
//   - common.QuotaPerUnit = 500 * 1000 = 500000（1 倍率单位对应的 quota 数）
//   - USD = 500（$0.002 = 1 倍率单位，即 $1 = 500 倍率单位）
//
// 关系恒等式：USD * 1000 == QuotaPerUnit。基准真源放在 common（协议级常量），
// 此处保留字面量但用 init 断言锁死二者一致，避免任一处单独改动造成静默漂移。
// 注意：不能让 common 反向 import ratio_setting（会造成包初始化循环依赖），故
// 由依赖方 ratio_setting 做断言。
func init() {
	if USD*1000 != int(common.QuotaPerUnit) {
		panic(fmt.Sprintf(
			"ratio_setting.USD(%d)*1000 != common.QuotaPerUnit(%v): 计费基准漂移，必须保持一致",
			USD, common.QuotaPerUnit,
		))
	}
}

// defaultUnknownModelRatio 未知模型的保护性高价兜底倍率。
// 当模型既无价格也无倍率配置时返回该值，避免以过低价格放行未知模型。
const defaultUnknownModelRatio = 37.5

// modelRatio
// https://platform.openai.com/docs/models/model-endpoint-compatibility
// https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf
// https://openai.com/pricing
// TODO: when a new api is enabled, check the pricing here
// 1 === $0.002 / 1K tokens
// 1 === ￥0.014 / 1k tokens

// 默认倍率/价格表已外置为 setting/ratio_setting/data/*.json，通过 go:embed 在
// init() 中解析回同名包级 map 变量。这样保证：
//   - 不改变任何计费数值（生成 JSON 时由原 Go 字面量 dump，逐条等价，见 *_externalize_test.go）；
//   - GetDefaultModelRatioMap() / DefaultModelRatio2JSONString() / ResetModelRatio 语义字节级不变；
//   - hasCustomModelRatio() 判定基准（完整默认表）不变。
//
// 注：联网同步（ratio_sync 从 basellm.github.io/models.dev 拉取）与「缩为极小兜底集」
// 属营收/语义敏感，本阶段不做，作为后续方向。
//
//go:embed data/default_model_ratio.json
var defaultModelRatioJSON []byte

//go:embed data/default_model_price.json
var defaultModelPriceJSON []byte

//go:embed data/default_audio_ratio.json
var defaultAudioRatioJSON []byte

//go:embed data/default_audio_completion_ratio.json
var defaultAudioCompletionRatioJSON []byte

//go:embed data/default_completion_ratio.json
var defaultCompletionRatioJSON []byte

//go:embed data/default_image_ratio.json
var defaultImageRatioJSON []byte

// 解析后的默认表（包级变量，类型与外置前一致，均为 map[string]float64）。
var (
	defaultModelRatio           = mustParseRatioTable("default_model_ratio.json", defaultModelRatioJSON)
	defaultModelPrice           = mustParseRatioTable("default_model_price.json", defaultModelPriceJSON)
	defaultAudioRatio           = mustParseRatioTable("default_audio_ratio.json", defaultAudioRatioJSON)
	defaultAudioCompletionRatio = mustParseRatioTable("default_audio_completion_ratio.json", defaultAudioCompletionRatioJSON)
	defaultCompletionRatio      = mustParseRatioTable("default_completion_ratio.json", defaultCompletionRatioJSON)
	defaultImageRatio           = mustParseRatioTable("default_image_ratio.json", defaultImageRatioJSON)
)

// mustParseRatioTable 解析 embed 的默认表 JSON。任何解析失败都是构建期数据损坏，
// 直接 panic（与改前字面量缺失等价：包无法初始化）。使用 common.Unmarshal 遵守
// 「禁止业务代码直接调用 encoding/json」硬规则。
func mustParseRatioTable(name string, data []byte) map[string]float64 {
	m := make(map[string]float64)
	if err := common.Unmarshal(data, &m); err != nil {
		panic(fmt.Sprintf("ratio_setting: failed to parse embedded %s: %v", name, err))
	}
	return m
}

var modelPriceMap = types.NewRWMap[string, float64]()
var modelRatioMap = types.NewRWMap[string, float64]()
var completionRatioMap = types.NewRWMap[string, float64]()

// InitRatioSettings initializes all model related settings maps
func InitRatioSettings() {
	modelPriceMap.AddAll(defaultModelPrice)
	modelRatioMap.AddAll(defaultModelRatio)
	completionRatioMap.AddAll(defaultCompletionRatio)
	cacheRatioMap.AddAll(defaultCacheRatio)
	createCacheRatioMap.AddAll(defaultCreateCacheRatio)
	imageRatioMap.AddAll(defaultImageRatio)
	audioRatioMap.AddAll(defaultAudioRatio)
	audioCompletionRatioMap.AddAll(defaultAudioCompletionRatio)
}

func GetModelPriceMap() map[string]float64 {
	return modelPriceMap.ReadAll()
}

func ModelPrice2JSONString() string {
	return modelPriceMap.MarshalJSONString()
}

func UpdateModelPriceByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(modelPriceMap, jsonStr, InvalidateExposedDataCache)
}

// GetModelPrice 返回模型的价格，如果模型不存在则返回-1，false
func GetModelPrice(name string, printErr bool) (float64, bool) {
	name = FormatMatchingModelName(name)

	if price, ok := modelPriceMap.Get(name); ok {
		return price, true
	}

	if strings.HasSuffix(name, CompactModelSuffix) {
		price, ok := modelPriceMap.Get(CompactWildcardModelKey)
		if !ok {
			if printErr {
				common.SysError("model price not found: " + name)
			}
			return -1, false
		}
		return price, true
	}

	if printErr {
		common.SysError("model price not found: " + name)
	}
	return -1, false
}

func UpdateModelRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(modelRatioMap, jsonStr, InvalidateExposedDataCache)
}

// 处理带有思考预算的模型名称，方便统一定价
func handleThinkingBudgetModel(name, prefix, wildcard string) string {
	if strings.HasPrefix(name, prefix) && strings.Contains(name, "-thinking-") {
		return wildcard
	}
	return name
}

func GetModelRatio(name string) (float64, bool, string) {
	name = FormatMatchingModelName(name)

	ratio, ok := modelRatioMap.Get(name)
	if !ok {
		if strings.HasSuffix(name, CompactModelSuffix) {
			if wildcardRatio, ok := modelRatioMap.Get(CompactWildcardModelKey); ok {
				return wildcardRatio, true, name
			}
			//return 0, true, name
		}
		return defaultUnknownModelRatio, operation_setting.SelfUseModeEnabled, name
	}
	return ratio, true, name
}

func DefaultModelRatio2JSONString() string {
	jsonBytes, err := common.Marshal(defaultModelRatio)
	if err != nil {
		common.SysError("error marshalling model ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func GetDefaultModelRatioMap() map[string]float64 {
	return defaultModelRatio
}

func GetDefaultModelPriceMap() map[string]float64 {
	return defaultModelPrice
}

func CompletionRatio2JSONString() string {
	return completionRatioMap.MarshalJSONString()
}

func UpdateCompletionRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(completionRatioMap, jsonStr, InvalidateExposedDataCache)
}

func GetCompletionRatio(name string) float64 {
	name = FormatMatchingModelName(name)
	if ratio, ok := completionRatioMap.Get(name); ok {
		return ratio
	}
	return 1
}

func GetAudioRatio(name string) float64 {
	name = FormatMatchingModelName(name)
	if ratio, ok := audioRatioMap.Get(name); ok {
		return ratio
	}
	return 1
}

func GetAudioCompletionRatio(name string) float64 {
	name = FormatMatchingModelName(name)
	if ratio, ok := audioCompletionRatioMap.Get(name); ok {
		return ratio
	}
	return 1
}

func ContainsAudioRatio(name string) bool {
	name = FormatMatchingModelName(name)
	_, ok := audioRatioMap.Get(name)
	return ok
}

func ContainsAudioCompletionRatio(name string) bool {
	name = FormatMatchingModelName(name)
	_, ok := audioCompletionRatioMap.Get(name)
	return ok
}

func ModelRatio2JSONString() string {
	return modelRatioMap.MarshalJSONString()
}

var imageRatioMap = types.NewRWMap[string, float64]()
var audioRatioMap = types.NewRWMap[string, float64]()
var audioCompletionRatioMap = types.NewRWMap[string, float64]()

func ImageRatio2JSONString() string {
	return imageRatioMap.MarshalJSONString()
}

func UpdateImageRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(imageRatioMap, jsonStr)
}

func GetImageRatio(name string) (float64, bool) {
	ratio, ok := imageRatioMap.Get(name)
	if !ok {
		return 1, false // Default to 1 if not found
	}
	return ratio, true
}

func AudioRatio2JSONString() string {
	return audioRatioMap.MarshalJSONString()
}

func UpdateAudioRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(audioRatioMap, jsonStr, InvalidateExposedDataCache)
}

func AudioCompletionRatio2JSONString() string {
	return audioCompletionRatioMap.MarshalJSONString()
}

func UpdateAudioCompletionRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(audioCompletionRatioMap, jsonStr, InvalidateExposedDataCache)
}

func GetModelRatioCopy() map[string]float64 {
	return modelRatioMap.ReadAll()
}

func GetModelPriceCopy() map[string]float64 {
	return modelPriceMap.ReadAll()
}

func GetCompletionRatioCopy() map[string]float64 {
	return completionRatioMap.ReadAll()
}

func GetImageRatioCopy() map[string]float64 {
	return imageRatioMap.ReadAll()
}

func GetAudioRatioCopy() map[string]float64 {
	return audioRatioMap.ReadAll()
}

func GetAudioCompletionRatioCopy() map[string]float64 {
	return audioCompletionRatioMap.ReadAll()
}

// 转换模型名，减少渠道必须配置各种带参数模型
func FormatMatchingModelName(name string) string {

	if strings.HasPrefix(name, "gemini-2.5-flash-lite") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-flash-lite", "gemini-2.5-flash-lite-thinking-*")
	} else if strings.HasPrefix(name, "gemini-2.5-flash") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-flash", "gemini-2.5-flash-thinking-*")
	} else if strings.HasPrefix(name, "gemini-2.5-pro") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-pro", "gemini-2.5-pro-thinking-*")
	}

	if strings.HasPrefix(name, "gpt-4-gizmo") {
		name = "gpt-4-gizmo-*"
	}
	if strings.HasPrefix(name, "gpt-4o-gizmo") {
		name = "gpt-4o-gizmo-*"
	}
	return name
}

// result: 倍率or价格， usePrice， exist
func GetModelRatioOrPrice(model string) (float64, bool, bool) { // price or ratio
	price, usePrice := GetModelPrice(model, false)
	if usePrice {
		return price, true, true
	}
	modelRatio, success, _ := GetModelRatio(model)
	if success {
		return modelRatio, false, true
	}
	return defaultUnknownModelRatio, false, false
}
