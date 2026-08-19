package model

import (
	"strings"

	"github.com/QuantumNous/new-api/pkg/modellab"
)

type defaultVendorRule struct {
	pattern string
	vendor  string
}

// These rules only cover legacy vendors absent from the Model Lab catalog.
// Their order is part of the compatibility contract.
var legacyDefaultVendorRules = []defaultVendorRule{
	{pattern: "@cf/", vendor: "Cloudflare"},
	{pattern: "ernie", vendor: "百度"},
	{pattern: "spark", vendor: "讯飞"},
	{pattern: "abab", vendor: "MiniMax"},
	{pattern: "360", vendor: "360"},
	{pattern: "yi", vendor: "零一万物"},
	{pattern: "jina", vendor: "Jina"},
	{pattern: "kling", vendor: "快手"},
	{pattern: "jimeng", vendor: "即梦"},
	{pattern: "vidu", vendor: "Vidu"},
}

// 供应商默认图标映射
var defaultVendorIcons = map[string]string{
	"OpenAI":         "OpenAI",
	"Anthropic":      "Claude.Color",
	"Google":         "Gemini.Color",
	"Moonshot":       "Moonshot",
	"Moonshot AI":    "Moonshot",
	"智谱":             "Zhipu.Color",
	"Zhipu AI":       "Zhipu.Color",
	"阿里巴巴":           "Qwen.Color",
	"Alibaba":        "Qwen.Color",
	"DeepSeek":       "DeepSeek.Color",
	"MiniMax":        "Minimax.Color",
	"百度":             "Wenxin.Color",
	"讯飞":             "Spark.Color",
	"腾讯":             "Hunyuan.Color",
	"Tencent":        "Hunyuan.Color",
	"Cohere":         "Cohere.Color",
	"Cloudflare":     "Cloudflare.Color",
	"360":            "Ai360.Color",
	"零一万物":           "Yi.Color",
	"Jina":           "Jina",
	"Mistral":        "Mistral.Color",
	"xAI":            "XAI",
	"Meta":           "Ollama",
	"字节跳动":           "Doubao.Color",
	"Bytedance Seed": "Doubao.Color",
	"快手":             "Kling.Color",
	"即梦":             "Jimeng.Color",
	"Vidu":           "Vidu",
	"微软":             "AzureAI",
	"Microsoft":      "AzureAI",
	"Azure":          "AzureAI",
}

func inferDefaultVendorName(modelName string) string {
	resolution := modellab.Resolve(modelName, "")
	if resolution.GroupSlug == modellab.GroupMixed {
		return ""
	}
	if resolution.GroupSlug != modellab.GroupUnknown && len(resolution.Labs) == 1 {
		return resolution.Labs[0].Name
	}

	modelLower := strings.ToLower(modelName)
	for _, rule := range legacyDefaultVendorRules {
		if strings.Contains(modelLower, rule.pattern) {
			return rule.vendor
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

		vendorID := 0
		if vendorName := inferDefaultVendorName(modelName); vendorName != "" {
			vendorID = getOrCreateVendor(vendorName, vendorMap)
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
