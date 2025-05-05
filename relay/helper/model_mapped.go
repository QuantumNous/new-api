package helper

import (
	"encoding/json"
	"errors"
	"fmt"
	"one-api/relay/common"

	"github.com/gin-gonic/gin"
)

func ModelMappedHelper(c *gin.Context, info *common.RelayInfo) error {
	// map model name
	modelMapping := c.GetString("model_mapping")
	if modelMapping != "" && modelMapping != "{}" {
		modelMap := make(map[string]string)
		err := json.Unmarshal([]byte(modelMapping), &modelMap)
		if err != nil {
			return fmt.Errorf("unmarshal_model_mapping_failed")
		}
		currentModel := info.OriginModelName
		// 支持链式模型重定向，最终使用链尾的模型
		for {
			if mappedModel, exists := modelMap[currentModel]; exists && mappedModel != "" {
				// 模型重定向循环检测，避免无限循环
				if mappedModel == info.OriginModelName {
					if currentModel == info.OriginModelName {
						return nil
					} else {
						return errors.New("model_mapping_contains_cycle")
					}
				}
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
	return nil
}
