package model

import (
	"slices"
	"strings"
)

// 简化的供应商映射规则
var defaultVendorRules = map[string]string{
	"gpt":      "OpenAI",
	"dall-e":   "OpenAI",
	"whisper":  "OpenAI",
	"o1":       "OpenAI",
	"o3":       "OpenAI",
	"claude":   "Anthropic",
	"gemini":   "Google",
	"moonshot": "Moonshot",
	"kimi":     "Moonshot",
	"chatglm":  "智谱",
	"glm-":     "智谱",
	"qwen":     "阿里巴巴",
	"deepseek": "DeepSeek",
	"mimo":     "小米",
	"xiaomi":   "小米",
	"abab":     "MiniMax",
	"minimax":  "MiniMax",
	"ernie":    "百度",
	"spark":    "讯飞",
	"hunyuan":  "腾讯",
	"hy3":      "腾讯",
	"hy4":      "腾讯",
	"stepfun":  "阶跃星辰",
	"step-":    "阶跃星辰",
	"ling-":    "蚂蚁百灵",
	"jt-":      "中国移动",
	"nex-":     "Nex AGI",
	"muse-":    "Meta",
	"command":  "Cohere",
	"@cf/":     "Cloudflare",
	"360":      "360",
	"yi":       "零一万物",
	"jina":     "Jina",
	"mistral":  "Mistral",
	"grok":     "xAI",
	"llama":    "Meta",
	"doubao":   "字节跳动",
	"kling":    "快手",
	"jimeng":   "即梦",
	"vidu":     "Vidu",
}

// 供应商默认图标映射
var defaultVendorIcons = map[string]string{
	"OpenAI":     "OpenAI",
	"Anthropic":  "Claude.Color",
	"Google":     "Gemini.Color",
	"Moonshot":   "Moonshot",
	"智谱":         "Zhipu.Color",
	"阿里巴巴":       "Qwen.Color",
	"DeepSeek":   "DeepSeek.Color",
	"小米":         "XiaomiMiMo",
	"阶跃星辰":       "Stepfun",
	"蚂蚁百灵":       "AntGroup",
	"中国移动":       "",
	"Nex AGI":    "",
	"MiniMax":    "Minimax.Color",
	"百度":         "Wenxin.Color",
	"讯飞":         "Spark.Color",
	"腾讯":         "Hunyuan.Color",
	"Cohere":     "Cohere.Color",
	"Cloudflare": "Cloudflare.Color",
	"360":        "Ai360.Color",
	"零一万物":       "Yi.Color",
	"Jina":       "Jina",
	"Mistral":    "Mistral.Color",
	"xAI":        "XAI",
	"Meta":       "Ollama",
	"字节跳动":       "Doubao.Color",
	"快手":         "Kling.Color",
	"即梦":         "Jimeng.Color",
	"Vidu":       "Vidu",
	"微软":         "AzureAI",
	"Microsoft":  "AzureAI",
	"Azure":      "AzureAI",
}

// sortedDefaultVendorPatterns is the precomputed matching order: longest
// pattern first so that a more specific alias wins over a broader one.
var sortedDefaultVendorPatterns = func() []string {
	patterns := make([]string, 0, len(defaultVendorRules))
	for pattern := range defaultVendorRules {
		patterns = append(patterns, pattern)
	}
	slices.SortFunc(patterns, func(a, b string) int {
		if len(a) != len(b) {
			return len(b) - len(a)
		}
		return strings.Compare(a, b)
	})
	return patterns
}()

// LookupDefaultVendorName resolves a model name to its default vendor name by
// substring matching, or "" when no rule matches. It is pure and does not touch
// the vendor map, so callers (e.g. rankings) can use it as a display fallback
// for model names that no longer have an enabled channel.
func LookupDefaultVendorName(modelName string) string {
	modelLower := strings.ToLower(modelName)
	for _, pattern := range sortedDefaultVendorPatterns {
		if strings.Contains(modelLower, pattern) {
			return defaultVendorRules[pattern]
		}
	}
	return ""
}

// initDefaultVendorMapping 简化的默认供应商映射
func initDefaultVendorMapping(metaMap map[string]*Model, vendorMap map[int]*Vendor, enableAbilities []AbilityWithChannel) {
	for _, ability := range enableAbilities {
		modelName := ability.Model
		if _, exists := metaMap[modelName]; exists {
			continue
		}

		// 创建模型元数据
		metaMap[modelName] = &Model{
			ModelName: modelName,
			VendorID:  getDisplayVendor(LookupDefaultVendorName(modelName), vendorMap),
			Status:    1,
			NameRule:  NameRuleExact,
		}
	}
}

// Default vendor entries are presentation data. Reading pricing must never
// recreate a deleted/merged database record.
var defaultVendorDisplayIDs = map[string]int{
	"360":        -1001,
	"Anthropic":  -1002,
	"Cloudflare": -1003,
	"Cohere":     -1004,
	"DeepSeek":   -1005,
	"Google":     -1006,
	"Jina":       -1007,
	"Meta":       -1008,
	"MiniMax":    -1009,
	"Mistral":    -1010,
	"Moonshot":   -1011,
	"OpenAI":     -1012,
	"Vidu":       -1013,
	"xAI":        -1014,
	"即梦":         -1015,
	"字节跳动":       -1016,
	"快手":         -1017,
	"智谱":         -1018,
	"百度":         -1019,
	"腾讯":         -1020,
	"讯飞":         -1021,
	"阿里巴巴":       -1022,
	"零一万物":       -1023,
	"小米":         -1024,
	"阶跃星辰":       -1025,
	"蚂蚁百灵":       -1026,
	"中国移动":       -1027,
	"Nex AGI":    -1028,
}

// getDisplayVendor returns the display ID for the given vendor name, reusing
// an existing vendor entry when the name matches and registering a new default
// entry otherwise. Returns 0 when the name has no default display ID.
func getDisplayVendor(vendorName string, vendorMap map[int]*Vendor) int {
	for id, vendor := range vendorMap {
		if strings.EqualFold(vendor.Name, vendorName) {
			return id
		}
	}
	id := defaultVendorDisplayIDs[vendorName]
	if id == 0 {
		return 0
	}
	vendorMap[id] = &Vendor{Id: id, Name: vendorName, Status: 1, Icon: GetDefaultVendorIcon(vendorName)}
	return id
}

// GetDefaultVendorIcon 返回供应商默认图标名，无图标时返回空串。
func GetDefaultVendorIcon(vendorName string) string {
	if icon, exists := defaultVendorIcons[vendorName]; exists {
		return icon
	}
	return ""
}
