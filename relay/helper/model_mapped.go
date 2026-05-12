package helper

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func ModelMappedHelper(c *gin.Context, info *common.RelayInfo, request dto.Request) error {
	if info.ChannelMeta == nil {
		info.ChannelMeta = &common.ChannelMeta{}
	}

	isResponsesCompact := info.RelayMode == relayconstant.RelayModeResponsesCompact
	originModelName := info.OriginModelName
	mappingModelName := originModelName
	if isResponsesCompact && strings.HasSuffix(originModelName, ratio_setting.CompactModelSuffix) {
		mappingModelName = strings.TrimSuffix(originModelName, ratio_setting.CompactModelSuffix)
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
		currentModel := mappingModelName
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

	// 模型重定向后，按实际模型重新计算计费数据
	if info.IsModelMapped && info.UpstreamModelName != "" {
		RecalcPriceDataForMappedModel(info)
	}

	return nil
}

// RecalcPriceDataForMappedModel 在模型重定向后，用实际上游模型重新计算 PriceData 中的价格/倍率
func RecalcPriceDataForMappedModel(info *common.RelayInfo) {
	billingModel := info.UpstreamModelName

	modelPrice, usePrice := ratio_setting.GetModelPrice(billingModel, false)
	if usePrice {
		info.PriceData.ModelPrice = modelPrice
		info.PriceData.UsePrice = true
		info.PriceData.ModelRatio = 0
		info.PriceData.CompletionRatio = 0
		return
	}

	modelRatio, success, _ := ratio_setting.GetModelRatio(billingModel)
	if !success {
		return
	}

	info.PriceData.UsePrice = false
	info.PriceData.ModelRatio = modelRatio
	info.PriceData.CompletionRatio = ratio_setting.GetCompletionRatio(billingModel)
	info.PriceData.CacheRatio, _ = ratio_setting.GetCacheRatio(billingModel)
	info.PriceData.CacheCreationRatio, _ = ratio_setting.GetCreateCacheRatio(billingModel)
	info.PriceData.CacheCreation5mRatio = info.PriceData.CacheCreationRatio
	info.PriceData.CacheCreation1hRatio = info.PriceData.CacheCreationRatio * (6.0 / 3.75)
	info.PriceData.ImageRatio, _ = ratio_setting.GetImageRatio(billingModel)
	info.PriceData.AudioRatio = ratio_setting.GetAudioRatio(billingModel)
	info.PriceData.AudioCompletionRatio = ratio_setting.GetAudioCompletionRatio(billingModel)
}
