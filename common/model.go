package common

import "strings"

var (
	// OpenAIResponseOnlyModels is a list of models that are only available for OpenAI responses.
	OpenAIResponseOnlyModels = []string{
		"o3-pro",
		"o3-deep-research",
		"o4-mini-deep-research",
	}
	ImageGenerationModels = []string{
		"dall-e-3",
		"dall-e-2",
		"prefix:gpt-image-",
		"prefix:chatgpt-image",
		"prefix:imagen-",
		"nano-banana",
		"black-forest-labs/flux",
		"flux-",
		"flux.1-",
		"prefix:grok-imagine-image",
		"prefix:grok-2-image-",
		"prefix:image-01",
		"prefix:seedream-",
		"prefix:doubao-seedream-",
		"qwen-image",
		"prefix:z-image",
		"prefix:wanx-v1",
		"prefix:wan2.6-t2i",
		"prefix:jimeng_",
		"instantx/instantid",
		"bytedance/sdxl-lightning",
	}
	OpenAITextModels = []string{
		"gpt-",
		"o1",
		"o3",
		"o4",
		"chatgpt",
	}
)

func IsOpenAIResponseOnlyModel(modelName string) bool {
	for _, m := range OpenAIResponseOnlyModels {
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}

func IsImageGenerationModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range ImageGenerationModels {
		if strings.Contains(modelName, m) {
			return true
		}
		if strings.HasPrefix(m, "prefix:") && strings.HasPrefix(modelName, strings.TrimPrefix(m, "prefix:")) {
			return true
		}
	}
	return false
}

func IsOpenAITextModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range OpenAITextModels {
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}
