package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

// pricingCapabilityModel resolves the same public-model -> upstream-model
// mapping chain used by the relay. Pricing stays on the public name when a
// mapping is malformed or cyclic because that route cannot be relayed safely.
func pricingCapabilityModel(publicModel string, ability AbilityWithChannel) string {
	if strings.TrimSpace(ability.Model) != "" {
		publicModel = ability.Model
	}
	if ability.ChannelModelMapping == nil || *ability.ChannelModelMapping == "" || *ability.ChannelModelMapping == "{}" {
		return publicModel
	}

	modelMap := make(map[string]string)
	if err := common.UnmarshalJsonStr(*ability.ChannelModelMapping, &modelMap); err != nil {
		return publicModel
	}

	currentModel := publicModel
	visitedModels := map[string]bool{currentModel: true}
	for {
		mappedModel, exists := modelMap[currentModel]
		if !exists || mappedModel == "" {
			return currentModel
		}
		if visitedModels[mappedModel] {
			if mappedModel == currentModel {
				return currentModel
			}
			return publicModel
		}
		visitedModels[mappedModel] = true
		currentModel = mappedModel
	}
}

func pricingImageCapabilities(publicModel string, ability AbilityWithChannel) common.ImageModelCapabilities {
	effectiveModel := pricingCapabilityModel(publicModel, ability)
	capabilities := common.ImageModelCapabilitiesForChannel(effectiveModel, ability.ChannelType)
	if ability.ChannelType == constant.ChannelTypeAli &&
		capabilities.Family == common.ImageModelFamilyAliImage &&
		common.StringsContains(capabilities.Operations, "generation") &&
		!model_setting.IsSyncImageModel(effectiveModel) {
		capabilities.MaxReferenceImages = 0
		capabilities.ReferenceImagesRequired = false
	}
	return capabilities
}

// imageAPIProfileForPricing keeps the model catalog honest when one model is
// exposed through more than one channel. The GPT Responses image tool accepts
// one output, while adaptor-backed channels can batch up to the gateway cap;
// the public contract must use the smaller value whenever a plain OpenAI route
// is selectable.
func imageAPIProfileForPricing(model string, abilities []AbilityWithChannel) *common.ImageAPIProfile {
	if len(abilities) == 0 {
		return common.ImageAPIProfileForModel(model)
	}

	capabilities := pricingImageCapabilities(model, abilities[0])
	for _, ability := range abilities[1:] {
		channelCapabilities := pricingImageCapabilities(model, ability)
		capabilities = common.IntersectImageModelCapabilities(capabilities, channelCapabilities)
	}
	return common.ImageAPIProfileForCapabilities(capabilities)
}
