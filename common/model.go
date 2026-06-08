package common

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
)

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
		"prefix:imagen-",
		"flux-",
		"flux.1-",
	}
	XAIImageGenerationModels = []string{
		"prefix:grok-imagine-image",
		"prefix:grok-2-image-",
	}
	ImageGenerationExcludedModels = []string{
		"prefix:grok-imagine-image-edit",
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
	for _, m := range ImageGenerationExcludedModels {
		if matchesModelRule(modelName, m) {
			return false
		}
	}
	for _, m := range ImageGenerationModels {
		if matchesModelRule(modelName, m) {
			return true
		}
	}
	return IsXAIImageGenerationModel(modelName)
}

func IsXAIImageGenerationModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range ImageGenerationExcludedModels {
		if matchesModelRule(modelName, m) {
			return false
		}
	}
	for _, m := range XAIImageGenerationModels {
		if matchesModelRule(modelName, m) {
			return true
		}
	}
	return false
}

func IsChannelImageGenerationModel(channelType int, modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range ImageGenerationExcludedModels {
		if matchesModelRule(modelName, m) {
			return false
		}
	}
	if IsXAIImageGenerationModel(modelName) {
		return channelType == constant.ChannelTypeXai
	}
	for _, m := range ImageGenerationModels {
		if matchesModelRule(modelName, m) {
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

func matchesModelRule(modelName string, rule string) bool {
	if strings.HasPrefix(rule, "prefix:") {
		return strings.HasPrefix(modelName, strings.TrimPrefix(rule, "prefix:"))
	}
	return strings.Contains(modelName, rule)
}
