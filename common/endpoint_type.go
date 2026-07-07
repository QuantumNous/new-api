package common

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
)

// GetEndpointTypesByChannelType 获取渠道最优先端点类型（所有的渠道都支持 OpenAI 端点）
func GetEndpointTypesByChannelType(channelType int, modelName string) []constant.EndpointType {
	var endpointTypes []constant.EndpointType
	switch channelType {
	case constant.ChannelTypeJina:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeJinaRerank}
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
	case constant.ChannelTypeVertexAi:
		fallthrough
	case constant.ChannelTypeGemini:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeGemini, constant.EndpointTypeOpenAI}
	case constant.ChannelTypeOpenRouter: // OpenRouter 只支持 OpenAI 端点
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI}
	case constant.ChannelTypeXai:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}
	case constant.ChannelTypeSora:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIVideo}
	case constant.ChannelTypeGPUStackPlus:
		// 同一渠道两条链路:图片模型(z-image / qwen-image 系)走同步 relay
		// (/v1/images/generations|edits),视频模型(wan i2v/t2v 系)走任务
		// 子系统(/v1/videos)。按模型名区分能力,避免被默认分支标成纯文本模型。
		if isGPUStackPlusImageModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeImageGeneration}
		} else {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIVideo}
		}
	default:
		if IsOpenAIResponseOnlyModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIResponse}
		} else {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI}
		}
	}
	if IsImageGenerationModel(modelName) {
		// add to first
		endpointTypes = append([]constant.EndpointType{constant.EndpointTypeImageGeneration}, endpointTypes...)
	}
	if IsAudioSpeechModel(modelName) {
		endpointTypes = append([]constant.EndpointType{constant.EndpointTypeAudioSpeech}, endpointTypes...)
	}
	return endpointTypes
}

// isGPUStackPlusImageModel 区分 GPUStackPlus 渠道下的图片模型与视频模型:
// LightX2V 图片系 = z-image / qwen-image / qwen-image-edit(t2i/i2i);
// 其余(wan2.2-t2v / wan2.2-i2v 等)按视频处理。
func isGPUStackPlusImageModel(modelName string) bool {
	m := strings.ToLower(modelName)
	return strings.Contains(m, "image") && !strings.Contains(m, "i2v") && !strings.Contains(m, "t2v")
}
