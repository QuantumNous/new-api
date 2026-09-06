package model

import (
	"strings"
)

// 简化的供应商映射规则。
// 规则顺序有意固定：模型名可能同时命中多个关键词，先命中的规则优先。
type defaultVendorRule struct {
	pattern    string
	vendorName string
}

var defaultVendorRules = []defaultVendorRule{
	{pattern: "gpt", vendorName: "OpenAI"},
	{pattern: "dall-e", vendorName: "OpenAI"},
	{pattern: "whisper", vendorName: "OpenAI"},
	{pattern: "o1", vendorName: "OpenAI"},
	{pattern: "o3", vendorName: "OpenAI"},
	{pattern: "codex", vendorName: "OpenAI"},
	{pattern: "claude", vendorName: "Anthropic"},
	{pattern: "gemini", vendorName: "Google"},
	{pattern: "moonshot", vendorName: "Moonshot"},
	{pattern: "kimi", vendorName: "Moonshot"},
	{pattern: "chatglm", vendorName: "智谱"},
	{pattern: "glm-", vendorName: "智谱"},
	{pattern: "qwen", vendorName: "阿里巴巴"},
	{pattern: "deepseek", vendorName: "DeepSeek"},
	{pattern: "abab", vendorName: "MiniMax"},
	{pattern: "minimax", vendorName: "MiniMax"},
	{pattern: "ernie", vendorName: "百度"},
	{pattern: "command", vendorName: "Cohere"},
	{pattern: "@cf/", vendorName: "Cloudflare"},
	{pattern: "360", vendorName: "360"},
	{pattern: "yi", vendorName: "零一万物"},
	{pattern: "jina", vendorName: "Jina"},
	{pattern: "mistral", vendorName: "Mistral"},
	{pattern: "grok", vendorName: "xAI"},
	{pattern: "llama", vendorName: "Meta"},
	{pattern: "muse", vendorName: "Meta"},
	{pattern: "meta-", vendorName: "Meta"},
	{pattern: "spark-", vendorName: "讯飞"},
	{pattern: "xspark", vendorName: "讯飞"},
	{pattern: "hunyuan", vendorName: "腾讯"},
	{pattern: "hy", vendorName: "腾讯"},
	{pattern: "doubao", vendorName: "字节跳动"},
	{pattern: "kling", vendorName: "快手"},
	{pattern: "jimeng", vendorName: "即梦"},
	{pattern: "vidu", vendorName: "Vidu"},
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
	"Meta":       "Meta.Color",
	"字节跳动":       "Doubao.Color",
	"快手":         "Kling.Color",
	"即梦":         "Jimeng.Color",
	"Vidu":       "Vidu",
	"微软":         "AzureAI",
	"Microsoft":  "AzureAI",
	"Azure":      "AzureAI",
}

// initDefaultVendorMapping 简化的默认供应商映射
func initDefaultVendorMapping(metaMap map[string]*Model, vendorMap map[int]*Vendor, enableAbilities []AbilityWithChannel) {
	for _, ability := range enableAbilities {
		modelName := ability.Model
		if _, exists := metaMap[modelName]; exists {
			continue
		}

		// 匹配供应商
		vendorID := 0
		modelLower := strings.ToLower(modelName)
		for _, rule := range defaultVendorRules {
			if strings.Contains(modelLower, rule.pattern) {
				vendorID = getOrCreateVendor(rule.vendorName, vendorMap)
				break
			}
		}

		// 创建模型元数据
		metaMap[modelName] = &Model{
			ModelName: modelName,
			VendorID:  vendorID,
			Status:    1,
			NameRule:  NameRuleExact,
		}
	}
}

// 查找或创建供应商
func getOrCreateVendor(vendorName string, vendorMap map[int]*Vendor) int {
	// 查找现有供应商
	for id, vendor := range vendorMap {
		if vendor.Name == vendorName {
			return id
		}
	}

	// 创建新供应商
	newVendor := &Vendor{
		Name:   vendorName,
		Status: 1,
		Icon:   getDefaultVendorIcon(vendorName),
	}

	if err := newVendor.Insert(); err != nil {
		return 0
	}

	vendorMap[newVendor.Id] = newVendor
	return newVendor.Id
}

// 获取供应商默认图标
func getDefaultVendorIcon(vendorName string) string {
	if icon, exists := defaultVendorIcons[vendorName]; exists {
		return icon
	}
	return ""
}
