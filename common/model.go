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
		"prefix:gpt-image-2", // gpt-image-2, gpt-image-2-official
		"prefix:imagen-",
		"flux-",
		"flux.1-",
		"flash-image", // gemini-2.5-flash-image, gemini-3.1-flash-image-preview, …
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
		if strings.HasPrefix(m, "prefix:") {
			if strings.HasPrefix(modelName, strings.TrimPrefix(m, "prefix:")) {
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

// UsesAsyncImageTaskUpstream reports models whose upstream expects task submit + poll
// (APIMart-style: POST /v1/images/generations returns task_id; client or relay polls).
func UsesAsyncImageTaskUpstream(modelName string) bool {
	lower := strings.ToLower(strings.TrimSpace(modelName))
	if strings.HasPrefix(lower, "gpt-image-2") {
		return true
	}
	return strings.Contains(lower, "flash-image")
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
