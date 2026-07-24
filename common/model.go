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
	// BedrockOpenAIResponsesModels use the model-specific /openai/v1/responses
	// path on the Bedrock Mantle endpoint and do not support Chat Completions.
	BedrockOpenAIResponsesModels = []string{
		"openai.gpt-5.6-sol",
		"openai.gpt-5.6-terra",
		"openai.gpt-5.6-luna",
		"openai.gpt-5.5",
		"openai.gpt-5.4",
	}
	// BedrockOpenAIMantleChatModels support both Chat Completions and Responses
	// through the standard /v1 path on the Bedrock Mantle endpoint.
	BedrockOpenAIMantleChatModels = []string{
		"openai.gpt-oss-120b",
		"openai.gpt-oss-20b",
	}
	// BedrockOpenAIChatOnlyModels support Chat Completions through both the
	// Bedrock Mantle and Runtime endpoints.
	BedrockOpenAIChatOnlyModels = []string{
		"openai.gpt-oss-safeguard-120b",
		"openai.gpt-oss-safeguard-20b",
	}
	// BedrockOpenAIRuntimeChatModels use the OpenAI-compatible Chat Completions
	// endpoint exposed by bedrock-runtime.
	BedrockOpenAIRuntimeChatModels = []string{
		"openai.gpt-oss-120b-1:0",
		"openai.gpt-oss-20b-1:0",
	}
)

func modelNameInList(modelName string, models []string) bool {
	for _, model := range models {
		if strings.EqualFold(modelName, model) {
			return true
		}
	}
	return false
}

func normalizeBedrockOpenAIModelName(modelName string) string {
	for _, suffix := range []string{"-xhigh", "-medium", "-minimal", "-high", "-low", "-none"} {
		if strings.HasSuffix(modelName, suffix) {
			return strings.TrimSuffix(modelName, suffix)
		}
	}
	return modelName
}

func IsBedrockOpenAIResponsesModel(modelName string) bool {
	return modelNameInList(normalizeBedrockOpenAIModelName(modelName), BedrockOpenAIResponsesModels)
}

func IsBedrockOpenAIMantleChatModel(modelName string) bool {
	return modelNameInList(normalizeBedrockOpenAIModelName(modelName), BedrockOpenAIMantleChatModels)
}

func IsBedrockOpenAIRuntimeChatModel(modelName string) bool {
	return modelNameInList(normalizeBedrockOpenAIModelName(modelName), BedrockOpenAIRuntimeChatModels)
}

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
