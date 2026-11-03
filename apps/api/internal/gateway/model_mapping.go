package gateway

import (
	"errors"
	"fmt"
	"strings"

	ratio_setting "github.com/QuantumNous/new-api/internal/catalog/configure_ratio"
	"github.com/QuantumNous/new-api/internal/common"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// ModelMappedHelper resolves channel model mapping for a request.
// Moved from relay/helper so the dispatch chain can call it without
// reintroducing the gateway->helper import cycle.
func ModelMappedHelper(c contract.Context, info *relaycommon.RelayInfo, request dto.Request) error {
	if info.ChannelMeta == nil {
		info.ChannelMeta = &relaycommon.ChannelMeta{}
	}

	isResponsesCompact := info.RelayMode == relayconstant.RelayModeResponsesCompact
	originModelName := info.OriginModelName
	mappingModelName := originModelName
	if isResponsesCompact && strings.HasSuffix(originModelName, ratio_setting.CompactModelSuffix) {
		mappingModelName = strings.TrimSuffix(originModelName, ratio_setting.CompactModelSuffix)
	}

	modelMapping := c.GetString("model_mapping")
	if modelMapping != "" && modelMapping != "{}" {
		modelMap := make(map[string]string)
		if err := common.Unmarshal([]byte(modelMapping), &modelMap); err != nil {
			return fmt.Errorf("unmarshal_model_mapping_failed")
		}
		currentModel := mappingModelName
		visitedModels := map[string]bool{currentModel: true}
		for {
			if mappedModel, exists := modelMap[currentModel]; exists && mappedModel != "" {
				if visitedModels[mappedModel] {
					if mappedModel == currentModel {
						if currentModel == info.OriginModelName {
							info.IsModelMapped = false
							return nil
						}
						info.IsModelMapped = true
						break
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
	if isResponsesCompact {
		finalUpstreamModelName := mappingModelName
		if info.IsModelMapped && info.UpstreamModelName != "" {
			finalUpstreamModelName = info.UpstreamModelName
		}
		info.UpstreamModelName = finalUpstreamModelName
		info.OriginModelName = ratio_setting.WithCompactModelSuffix(finalUpstreamModelName)
	}
	if request != nil {
		request.SetModelName(info.UpstreamModelName)
	}
	return nil
}
