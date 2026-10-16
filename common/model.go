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
		"prefix:dall-e", // Deprecated upstream models; retained for compatible routes.
		"gpt-image-",
		"qwen-image",
		"z-image",
		"wan2.7-image-pro",
		"wan2.7-image",
		"wan2.6-image",
		"wan2.6-t2i",
		"wan2.5-t2i-preview",
		"wan2.2-t2i-flash",
		"wan2.2-t2i-plus",
		"wanx2.1-t2i-turbo",
		"wanx2.1-t2i-plus",
		"wanx2.0-t2i-turbo",
		"prefix:imagen-",
		"flux-",
		"flux.1-",
		"nano-banana",
		"flash-image",
		"pro-image",
		"image-generation",
	}
)

func IsOpenAIResponseOnlyModel(modelName string) bool {
	modelName = modelBaseName(modelName)
	for _, model := range OpenAIResponseOnlyModels {
		if modelName == model || strings.HasPrefix(modelName, model+"-") {
			return true
		}
	}
	return false
}

// IsOpenAIGPTModel reports whether the mapped upstream model belongs to the
// gpt-* family. Provider namespaces such as "openai/gpt-5" are ignored and
// matching is case-insensitive.
func IsOpenAIGPTModel(modelName string) bool {
	modelName = modelBaseName(modelName)
	return modelName == "gpt" || strings.HasPrefix(modelName, "gpt-")
}

// IsOpenAIChatAndResponsesModel identifies model families exposed through both
// standard OpenAI entrypoints by CLIProxyAPI's Codex-backed proxy.
func IsOpenAIChatAndResponsesModel(modelName string) bool {
	modelName = modelBaseName(modelName)
	return strings.HasPrefix(modelName, "gpt-5") ||
		strings.HasPrefix(modelName, "codex-") ||
		strings.Contains(modelName, "-codex")
}

// IsOpenAICodexImageModel identifies CLIProxyAPI's standalone image models.
// GPT-5.6 image generation itself remains a built-in Chat/Responses tool.
func IsOpenAICodexImageModel(modelName string) bool {
	modelName = modelBaseName(modelName)
	return modelName == "gpt-image-1.5" || modelName == "gpt-image-2"
}

// IsXAIVideoModel reports whether a model uses xAI's asynchronous video API.
func IsXAIVideoModel(modelName string) bool {
	modelName = modelBaseName(modelName)
	return strings.HasPrefix(modelName, "grok-imagine-video")
}

func modelBaseName(modelName string) string {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	if separator := strings.LastIndex(modelName, "/"); separator >= 0 {
		return modelName[separator+1:]
	}
	return modelName
}

func IsImageGenerationModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range ImageGenerationModels {
		if prefix, ok := strings.CutPrefix(m, "prefix:"); ok {
			if strings.HasPrefix(modelName, prefix) {
				return true
			}
			continue
		}
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}
