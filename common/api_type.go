package common

import "one-api/constant"

func ChannelType2APIType(channelType int) (int, bool) {
	apiType := -1
	switch channelType {
	case constant.ChannelTypeOpenAI:
		apiType = constant.APITypeOpenAI
	case constant.ChannelTypeAnthropic:
		apiType = constant.APITypeAnthropic
	case constant.ChannelTypeBaidu:
		apiType = constant.APITypeBaidu
	case constant.ChannelTypePaLM:
		apiType = constant.APITypePaLM
	case constant.ChannelTypeZhipu:
		apiType = constant.APITypeZhipu
	case constant.ChannelTypeAli:
		apiType = constant.APITypeAli
	case constant.ChannelTypeXunfei:
		apiType = constant.APITypeXunfei
	case constant.ChannelTypeAIProxyLibrary:
		apiType = constant.APITypeAIProxyLibrary
	case constant.ChannelTypeTencent:
		apiType = constant.APITypeTencent
	case constant.ChannelTypeGemini:
		apiType = constant.APITypeGemini
	case constant.ChannelTypeZhipu_v4:
		apiType = constant.APITypeZhipuV4
	case constant.ChannelTypeOllama:
		apiType = constant.APITypeOllama
	case constant.ChannelTypePerplexity:
		apiType = constant.APITypePerplexity
	case constant.ChannelTypeAws:
		apiType = constant.APITypeAws
	case constant.ChannelTypeCohere:
		apiType = constant.APITypeCohere
	case constant.ChannelTypeDify:
		apiType = constant.APITypeDify
	case constant.ChannelTypeJina:
		apiType = constant.APITypeJina
	case constant.ChannelCloudflare:
		apiType = constant.APITypeCloudflare
	case constant.ChannelTypeSiliconFlow:
		apiType = constant.APITypeSiliconFlow
	case constant.ChannelTypeVertexAi:
		apiType = constant.APITypeVertexAi
	case constant.ChannelTypeMistral:
		apiType = constant.APITypeMistral
	case constant.ChannelTypeDeepSeek:
		apiType = constant.APITypeDeepSeek
	case constant.ChannelTypeMokaAI:
		apiType = constant.APITypeMokaAI
	case constant.ChannelTypeVolcEngine:
		apiType = constant.APITypeVolcEngine
	case constant.ChannelTypeBaiduV2:
		apiType = constant.APITypeBaiduV2
	case constant.ChannelTypeOpenRouter:
		apiType = constant.APITypeOpenRouter
	case constant.ChannelTypeXinference:
		apiType = constant.APITypeXinference
	case constant.ChannelTypeXai:
		apiType = constant.APITypeXai
	case constant.ChannelTypeCoze:
		apiType = constant.APITypeCoze
	case constant.ChannelTypeJimeng:
		apiType = constant.APITypeJimeng
	case constant.ChannelTypeMoonshot:
		apiType = constant.APITypeMoonshot
	}
	if apiType == -1 {
		return constant.APITypeOpenAI, false
	}
	return apiType, true
}
