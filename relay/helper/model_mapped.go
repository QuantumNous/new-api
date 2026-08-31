package helper

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

// stripPerChannelModelPrefix removes the per-channel model prefix from a model name if present.
// This is used because the frontend prepends the channel's model_prefix when saving models
// (e.g., "dashscope/gpt-4" when prefix is "dashscope" and model is "gpt-4"),
// but the upstream API expects the model name without the prefix.
func stripPerChannelModelPrefix(modelName string, prefix string) string {
	if prefix == "" {
		return modelName
	}
	prefixWithSlash := prefix + "/"
	if strings.HasPrefix(modelName, prefixWithSlash) {
		return modelName[len(prefixWithSlash):]
	}
	return modelName
}

func ModelMappedHelper(c *gin.Context, info *common.RelayInfo, request dto.Request) error {
	if info.ChannelMeta == nil {
		info.ChannelMeta = &common.ChannelMeta{}
	}

	// Strip per-channel model prefix from the upstream model name.
	// The frontend prepends the channel's model_prefix when saving models,
	// but the upstream API expects the model name without the prefix.
	prefix := info.ChannelOtherSettings.ModelPrefix
	if prefix != "" {
		info.UpstreamModelName = stripPerChannelModelPrefix(
			info.UpstreamModelName,
			prefix,
		)
	}

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
							// Identity self-cycle: prefix was already stripped above,
							// so just ensure request gets the normalized name.
							info.IsModelMapped = false
							break
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
			// Also strip prefix from mapped model name
			if prefix != "" {
				currentModel = stripPerChannelModelPrefix(currentModel, prefix)
			}
			info.UpstreamModelName = currentModel
		}
	}

	if request != nil {
		request.SetModelName(info.UpstreamModelName)
	}
	return nil
}
