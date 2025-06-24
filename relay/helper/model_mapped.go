package helper

import (
	"encoding/json"
	"errors"
	"fmt"
	common2 "one-api/common"
	"one-api/dto"
	"one-api/relay/common"

	"github.com/gin-gonic/gin"
)

func ModelMappedHelper(c *gin.Context, info *common.RelayInfo, request any) error {
	// map model name
	modelMapping := c.GetString("model_mapping")
	if modelMapping != "" && modelMapping != "{}" {
		modelMap := make(map[string]string)
		err := json.Unmarshal([]byte(modelMapping), &modelMap)
		if err != nil {
			return fmt.Errorf("unmarshal_model_mapping_failed")
		}

		// 支持链式模型重定向，最终使用链尾的模型
		currentModel := info.OriginModelName
		visitedModels := map[string]bool{
			currentModel: true,
		}
		for {
			if mappedModel, exists := modelMap[currentModel]; exists && mappedModel != "" {
				// 模型重定向循环检测，避免无限循环
				if visitedModels[mappedModel] {
					if mappedModel == currentModel {
						if currentModel == info.OriginModelName {
							info.IsModelMapped = false
							return nil
						} else {
							info.IsModelMapped = true
							break
						}
					}
					return errors.New("model_mapping_contains_cycle")
				}
				visitedModels[mappedModel] = true
				currentModel = mappedModel
				info.IsModelMapped = true
			} else {
				break
			}
		}
		if info.IsModelMapped {
			info.UpstreamModelName = currentModel
		}
	}
	if request != nil {
		switch info.RelayFormat {
		case common.RelayFormatGemini:
			// Gemini 模型映射
		case common.RelayFormatClaude:
			if claudeRequest, ok := request.(*dto.ClaudeRequest); ok {
				claudeRequest.Model = info.UpstreamModelName
			}
		case common.RelayFormatOpenAIResponses:
			if openAIResponsesRequest, ok := request.(*dto.OpenAIResponsesRequest); ok {
				openAIResponsesRequest.Model = info.UpstreamModelName
			}
		case common.RelayFormatOpenAIAudio:
			if openAIAudioRequest, ok := request.(*dto.AudioRequest); ok {
				openAIAudioRequest.Model = info.UpstreamModelName
			}
		case common.RelayFormatOpenAIImage:
			if imageRequest, ok := request.(*dto.ImageRequest); ok {
				imageRequest.Model = info.UpstreamModelName
			}
		case common.RelayFormatRerank:
			if rerankRequest, ok := request.(*dto.RerankRequest); ok {
				rerankRequest.Model = info.UpstreamModelName
			}
		case common.RelayFormatEmbedding:
			if embeddingRequest, ok := request.(*dto.EmbeddingRequest); ok {
				embeddingRequest.Model = info.UpstreamModelName
			}
		default:
			if openAIRequest, ok := request.(*dto.GeneralOpenAIRequest); ok {
				openAIRequest.Model = info.UpstreamModelName
			} else {
				common2.LogWarn(c, fmt.Sprintf("model mapped but request type %T not supported", request))
			}
		}
	}
	return nil
}
