package helper

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
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

// StripModelPrefixFromBody strips the per-channel model prefix from the "model"
// field in a JSON request body. This is used in passthrough mode where the body
// is forwarded raw — the "model" value still carries the prefix that the frontend
// prepends (e.g. "dashscope/gpt-4") but upstream APIs expect the unprefixed name.
//
// Trade-off: the entire body is re-marshaled, so JSON field order and formatting
// may change. This is acceptable because upstream parsers care about values, not
// byte-level fidelity.
func StripModelPrefixFromBody(body []byte, prefix string) ([]byte, error) {
	if prefix == "" {
		return body, nil
	}

	var parsed map[string]any
	if err := common.Unmarshal(body, &parsed); err != nil {
		return body, nil
	}

	modelVal, ok := parsed["model"]
	if !ok {
		return body, nil
	}
	modelStr, ok := modelVal.(string)
	if !ok {
		return body, nil
	}

	parsed["model"] = stripPerChannelModelPrefix(modelStr, prefix)
	return common.Marshal(parsed)
}

func ModelMappedHelper(c *gin.Context, info *relaycommon.RelayInfo, request dto.Request) error {
	if info.ChannelMeta == nil {
		info.ChannelMeta = &relaycommon.ChannelMeta{}
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
