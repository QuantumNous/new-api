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
		"gpt-image-1",
		"gpt-image-2",
		"prefix:imagen-",
		"flux-",
		"flux.1-",
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
