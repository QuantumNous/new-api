package helper

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	basecommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func ModelMappedHelper(c *gin.Context, info *common.RelayInfo, request dto.Request) error {
	// map model name
	modelMapping := c.GetString("model_mapping")
	logger.LogDebug(c, "模型映射检查: 原模型=%q, 映射配置=%s", info.OriginModelName, modelMapping)
	chain := []string{info.OriginModelName}
	if modelMapping != "" && modelMapping != "{}" {
		modelMap := make(map[string]string)
		err := json.Unmarshal([]byte(modelMapping), &modelMap)
		if err != nil {
			return fmt.Errorf("unmarshal_model_mapping_failed")
		}

		logger.LogDebug(c, "模型映射解析: 原模型=%q, 映射表=%s", info.OriginModelName, basecommon.GetJsonString(modelMap))

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
				chain = append(chain, currentModel)
				info.IsModelMapped = true
			} else {
				break
			}
		}
		if info.IsModelMapped {
			info.UpstreamModelName = currentModel
		}
	} else {
		logger.LogDebug(c, "模型映射跳过: 原模型=%q, 未配置映射表", info.OriginModelName)
	}
	upstreamModel := info.UpstreamModelName
	if upstreamModel == "" {
		upstreamModel = info.OriginModelName
	}
	logger.LogDebug(c, "模型映射结果: 原模型=%q, 映射链路=%s, 上游模型=%q, 已映射=%t", info.OriginModelName, strings.Join(chain, "->"), upstreamModel, info.IsModelMapped)
	if request != nil {
		request.SetModelName(info.UpstreamModelName)
	}
	return nil
}
