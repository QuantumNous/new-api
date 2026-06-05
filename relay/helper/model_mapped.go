package helper

import (
	"errors"
	"fmt"
	"strings"

	appcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func ModelMappedHelper(c *gin.Context, info *relaycommon.RelayInfo, request dto.Request) error {
	if info.ChannelMeta == nil {
		info.ChannelMeta = &relaycommon.ChannelMeta{}
	}

	isResponsesCompact := info.RelayMode == relayconstant.RelayModeResponsesCompact
	originModelName := info.OriginModelName
	compactBaseModelName := originModelName
	if isResponsesCompact && strings.HasSuffix(originModelName, ratio_setting.CompactModelSuffix) {
		compactBaseModelName = strings.TrimSuffix(originModelName, ratio_setting.CompactModelSuffix)
	}

	// map model name
	modelMapping := c.GetString("model_mapping")
	if modelMapping != "" && modelMapping != "{}" {
		modelMap := make(map[string]string)
		err := appcommon.Unmarshal([]byte(modelMapping), &modelMap)
		if err != nil {
			return fmt.Errorf("unmarshal_model_mapping_failed")
		}

		mappingStartModelName := compactBaseModelName
		if isResponsesCompact && hasModelMapping(modelMap, originModelName) {
			mappingStartModelName = originModelName
		}

		mappedModelName, isModelMapped, err := resolveModelMapping(modelMap, mappingStartModelName, originModelName)
		if err != nil {
			return err
		}
		if isModelMapped {
			info.IsModelMapped = true
			info.UpstreamModelName = mappedModelName
		}
	}

	if isResponsesCompact {
		finalUpstreamModelName := compactBaseModelName
		if info.IsModelMapped && info.UpstreamModelName != "" {
			finalUpstreamModelName = info.UpstreamModelName
		}
		finalUpstreamModelName = strings.TrimSuffix(finalUpstreamModelName, ratio_setting.CompactModelSuffix)
		info.UpstreamModelName = finalUpstreamModelName
		info.OriginModelName = ratio_setting.WithCompactModelSuffix(finalUpstreamModelName)
	}
	if request != nil {
		request.SetModelName(info.UpstreamModelName)
	}
	return nil
}

func hasModelMapping(modelMap map[string]string, modelName string) bool {
	mappedModel, exists := modelMap[modelName]
	return exists && mappedModel != ""
}

func resolveModelMapping(modelMap map[string]string, startModelName string, originModelName string) (string, bool, error) {
	currentModel := startModelName
	visitedModels := map[string]bool{
		currentModel: true,
	}
	isModelMapped := false

	for {
		mappedModel, exists := modelMap[currentModel]
		if !exists || mappedModel == "" {
			break
		}

		// 模型重定向循环检测，避免无限循环
		if visitedModels[mappedModel] {
			if mappedModel == currentModel {
				if currentModel == originModelName && !isModelMapped {
					return currentModel, false, nil
				}
				return currentModel, true, nil
			}
			return "", false, errors.New("model_mapping_contains_cycle")
		}
		visitedModels[mappedModel] = true
		currentModel = mappedModel
		isModelMapped = true
	}

	return currentModel, isModelMapped, nil
}
