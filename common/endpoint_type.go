package common

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
)

func IsClaudeCompatibleModel(modelName string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(modelName)), "claude-")
}

// GetEndpointTypesByChannelType 获取渠道最优先端点类型（所有的渠道都支持 OpenAI 端点）
func GetEndpointTypesByChannelType(channelType int, modelName string) []constant.EndpointType {
	if channelType == constant.ChannelTypeXunfeiMaaSImage {
		return []constant.EndpointType{constant.EndpointTypeImageGeneration}
	}
	if IsOpenAIResponseCompactModel(modelName) {
		return []constant.EndpointType{constant.EndpointTypeOpenAIResponseCompact}
	}

	var endpointTypes []constant.EndpointType
	switch channelType {
	case constant.ChannelTypeCohere:
		if IsCohereRerankModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeCohereRerank}
		} else if IsCohereEmbeddingModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeCohereEmbeddings}
		} else {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeCohereChat}
		}
	case constant.ChannelTypeJina:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeJinaRerank}
	case constant.ChannelTypeTypeSafe:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeTypeSafe}
	//case constant.ChannelTypeMidjourney, constant.ChannelTypeMidjourneyPlus:
	//	endpointTypes = []constant.EndpointType{constant.EndpointTypeMidjourney}
	//case constant.ChannelTypeSunoAPI:
	//	endpointTypes = []constant.EndpointType{constant.EndpointTypeSuno}
	//case constant.ChannelTypeKling:
	//	endpointTypes = []constant.EndpointType{constant.EndpointTypeKling}
	//case constant.ChannelTypeJimeng:
	//	endpointTypes = []constant.EndpointType{constant.EndpointTypeJimeng}
	case constant.ChannelTypeAws:
		fallthrough
	case constant.ChannelTypeAnthropic:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeAnthropic, constant.EndpointTypeOpenAI}
	case constant.ChannelTypeZhipu:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI}
		if IsClaudeCompatibleModel(modelName) {
			endpointTypes = append([]constant.EndpointType{constant.EndpointTypeAnthropic}, endpointTypes...)
		}
	case constant.ChannelTypeZhipu_v4:
		endpointTypes = []constant.EndpointType{
			constant.EndpointTypeOpenAI,
			constant.EndpointTypeOpenAIResponse,
		}
		if IsClaudeCompatibleModel(modelName) {
			endpointTypes = append([]constant.EndpointType{constant.EndpointTypeAnthropic}, endpointTypes...)
		}
	case constant.ChannelTypeDeepSeek:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeAnthropic}
	case constant.ChannelTypeVertexAi:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeGemini, constant.EndpointTypeOpenAI}
	case constant.ChannelTypeGemini:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeGemini, constant.EndpointTypeOpenAI}
	case constant.ChannelTypeGeminiInteractions:
		// 独立渠道:仅 Interactions 端点(另含 OpenAI 兼容入站转换)
		endpointTypes = []constant.EndpointType{constant.EndpointTypeGeminiInteractions, constant.EndpointTypeOpenAI}
	case constant.ChannelTypeSub2API, constant.ChannelTypeNewAPI:
		endpointTypes = []constant.EndpointType{
			constant.EndpointTypeOpenAI,
			constant.EndpointTypeOpenAIResponse,
			constant.EndpointTypeOpenAIResponseCompact,
			constant.EndpointTypeAnthropic,
			constant.EndpointTypeGemini,
		}
	case constant.ChannelTypePoe:
		if IsOpenAIResponseOnlyModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIResponse}
			break
		}
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}
		if IsClaudeCompatibleModel(modelName) {
			endpointTypes = append([]constant.EndpointType{constant.EndpointTypeAnthropic}, endpointTypes...)
		}
	case constant.ChannelTypeOpenRouter, constant.ChannelTypeKilo: // 只支持 OpenAI 端点
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI}
	case constant.ChannelTypeXai:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}
	case constant.ChannelTypeStepFun:
		endpointTypes = getStepFunEndpointTypes(modelName)
	case constant.ChannelTypeMoark:
		endpointTypes = getMoarkEndpointTypes(modelName)
	case constant.ChannelTypeVolcEngine:
		if IsVolcEngineContentGenerationTaskModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIVideo}
		} else if IsVolcEngineEmbeddingModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeEmbeddings}
		} else {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}
		}
	case constant.ChannelTypeOpenCode:
		endpointTypes = getOpenCodeEndpointTypes(modelName)
	case constant.ChannelTypeGMICloud:
		modelName := strings.ToLower(strings.TrimSpace(modelName))
		if strings.HasPrefix(modelName, "minimax-tts-") || strings.HasPrefix(modelName, "minimax-audio-voice-clone-") {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeAudioSpeech}
		} else if strings.HasPrefix(modelName, "minimax-music-") {
			// 音乐生成使用 MiniMax 原生端点，当前没有可对应的端点类型标注。
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI}
		} else {
			endpointTypes = []constant.EndpointType{
				constant.EndpointTypeOpenAI,
				constant.EndpointTypeOpenAIResponse,
				constant.EndpointTypeAnthropic,
			}
		}
	case constant.ChannelTypeQwenTokenPlan:
		endpointTypes = []constant.EndpointType{
			constant.EndpointTypeOpenAI,
			constant.EndpointTypeOpenAIResponse,
			constant.EndpointTypeAnthropic,
		}
	case constant.ChannelTypeAgnesAI:
		// agnes 原生支持 OpenAI / Responses / Anthropic 三种端点
		endpointTypes = []constant.EndpointType{
			constant.EndpointTypeOpenAI,
			constant.EndpointTypeOpenAIResponse,
			constant.EndpointTypeAnthropic,
		}
	case constant.ChannelTypeCLIProxyAPI:
		// CLIProxyAPI 原生透传五种端点,embeddings/audio/rerank 上游不存在
		endpointTypes = []constant.EndpointType{
			constant.EndpointTypeOpenAI,
			constant.EndpointTypeOpenAIResponse,
			constant.EndpointTypeAnthropic,
			constant.EndpointTypeGemini,
			constant.EndpointTypeGeminiInteractions,
		}
	case constant.ChannelTypeSora:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIVideo}
	default:
		if IsOpenAIResponseOnlyModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIResponse}
		} else {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI}
		}
	}
	if IsImageGenerationModel(modelName) ||
		(channelType == constant.ChannelTypeMoark && isMoarkImageGenerationModel(modelName)) ||
		(channelType == constant.ChannelTypeVolcEngine && IsVolcEngineImageGenerationModel(modelName)) {
		// add to first
		endpointTypes = prependEndpointType(endpointTypes, constant.EndpointTypeImageGeneration)
	}
	return endpointTypes
}

func prependEndpointType(endpointTypes []constant.EndpointType, endpointType constant.EndpointType) []constant.EndpointType {
	for _, existing := range endpointTypes {
		if existing == endpointType {
			return endpointTypes
		}
	}
	return append([]constant.EndpointType{endpointType}, endpointTypes...)
}

// getStepFunEndpointTypes 依据上游协议能力快照推导 StepFun 渠道的模型端点类型。
// 音频系模型标注语音/转写端点；确认仅支持 chat 的模型不再标注 Anthropic/Responses。
func getStepFunEndpointTypes(modelName string) []constant.EndpointType {
	normalized := strings.ToLower(strings.TrimSpace(modelName))
	if stringListContainsFold(constant.StepFunSpeechModels, normalized) {
		return []constant.EndpointType{constant.EndpointTypeAudioSpeech}
	}
	if stringListContainsFold(constant.StepFunTranscriptionModels, normalized) {
		return []constant.EndpointType{constant.EndpointTypeAudioTranscription}
	}
	if stringListContainsFold(constant.StepFunChatOnlyModels, normalized) {
		return []constant.EndpointType{constant.EndpointTypeOpenAI}
	}
	if !constant.StepFunModelSupportsMessages(normalized) {
		return []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}
	}
	if !constant.StepFunModelSupportsResponses(normalized) {
		return []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeAnthropic}
	}
	return []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeAnthropic, constant.EndpointTypeOpenAIResponse}
}

func getMoarkEndpointTypes(modelName string) []constant.EndpointType {
	if isMoarkRerankModel(modelName) {
		return []constant.EndpointType{constant.EndpointTypeJinaRerank}
	}
	if isMoarkEmbeddingModel(modelName) {
		return []constant.EndpointType{constant.EndpointTypeEmbeddings}
	}
	return []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse, constant.EndpointTypeAnthropic}
}

func isMoarkRerankModel(modelName string) bool {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	return strings.Contains(modelName, "rerank") || strings.Contains(modelName, "reranker")
}

func isMoarkEmbeddingModel(modelName string) bool {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	return strings.Contains(modelName, "embed") ||
		strings.Contains(modelName, "embedding") ||
		strings.HasPrefix(modelName, "bge-") ||
		strings.HasPrefix(modelName, "jina-clip") ||
		strings.HasPrefix(modelName, "jina-embeddings") ||
		strings.HasPrefix(modelName, "all-mpnet") ||
		strings.HasPrefix(modelName, "bce-embedding")
}

func isMoarkImageGenerationModel(modelName string) bool {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	return strings.Contains(modelName, "image") ||
		strings.Contains(modelName, "flux") ||
		strings.Contains(modelName, "kolors") ||
		strings.Contains(modelName, "stable-diffusion") ||
		strings.Contains(modelName, "hidream") ||
		strings.Contains(modelName, "cogview") ||
		strings.Contains(modelName, "dreamo") ||
		strings.Contains(modelName, "animesharp")
}

func getOpenCodeEndpointTypes(modelName string) []constant.EndpointType {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	if stringListContainsFold(constant.OpenCodeZenSystemOneModels, modelName) {
		return []constant.EndpointType{constant.EndpointTypeTypeSafe}
	}
	endpointTypes := make([]constant.EndpointType, 0, 4)
	add := func(endpointType constant.EndpointType) {
		for _, existing := range endpointTypes {
			if existing == endpointType {
				return
			}
		}
		endpointTypes = append(endpointTypes, endpointType)
	}

	if stringListContainsFold(constant.OpenCodeZenResponsesModels, modelName) {
		add(constant.EndpointTypeOpenAIResponse)
	}
	if stringListContainsFold(constant.OpenCodeZenClaudeModels, modelName) ||
		stringListContainsFold(constant.OpenCodeGoClaudeModels, modelName) {
		add(constant.EndpointTypeAnthropic)
	}
	if stringListContainsFold(constant.OpenCodeZenGeminiModels, modelName) {
		add(constant.EndpointTypeGemini)
	}
	if stringListContainsFold(constant.OpenCodeZenChatModels, modelName) ||
		stringListContainsFold(constant.OpenCodeGoChatModels, modelName) {
		add(constant.EndpointTypeOpenAI)
	}
	if len(endpointTypes) == 0 {
		add(constant.EndpointTypeOpenAI)
	}
	return endpointTypes
}

func stringListContainsFold(list []string, target string) bool {
	for _, item := range list {
		if strings.EqualFold(strings.TrimSpace(item), target) {
			return true
		}
	}
	return false
}
