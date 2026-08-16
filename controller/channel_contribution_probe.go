package controller

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

type channelContributionProbeSpec struct {
	Model        string
	EndpointType constant.EndpointType
	Streams      []bool
}

func resolveChannelContributionProbeSpecs(revision *model.ChannelContributionRevision) ([]channelContributionProbeSpec, error) {
	if revision == nil {
		return nil, errors.New("contribution revision is required")
	}
	models := channelContributionModels(revision.Models)
	if len(models) == 0 {
		return nil, errors.New("at least one model is required before testing")
	}
	if len(models) > channelContributionMaxModels {
		return nil, errors.New("contribution contains too many models")
	}

	// Populate endpoint metadata before reading the per-model endpoint map.
	model.GetPricing()
	specs := make([]channelContributionProbeSpec, 0, len(models))
	for _, modelName := range models {
		if common.IsImageGenerationModel(modelName) {
			return nil, errors.New("image generation models are not supported for channel contribution")
		}
		endpointTypes := model.GetModelSupportEndpointTypes(modelName)
		if err := validateChannelContributionEndpointTypes(endpointTypes); err != nil {
			return nil, err
		}

		endpointType := selectChannelContributionEndpoint(revision.Type, modelName, endpointTypes)
		streams := []bool{false, true}
		if endpointType == constant.EndpointTypeEmbeddings || endpointType == constant.EndpointTypeJinaRerank {
			streams = []bool{false}
		}
		specs = append(specs, channelContributionProbeSpec{
			Model:        modelName,
			EndpointType: endpointType,
			Streams:      streams,
		})
	}
	return specs, nil
}

func validateChannelContributionEndpointTypes(endpointTypes []constant.EndpointType) error {
	for _, endpointType := range endpointTypes {
		switch endpointType {
		case constant.EndpointTypeImageGeneration, constant.EndpointTypeOpenAIVideo:
			return errors.New("asynchronous image and video models are not supported for channel contribution")
		}
	}
	return nil
}

func selectChannelContributionEndpoint(channelType int, modelName string, endpointTypes []constant.EndpointType) constant.EndpointType {
	for _, preferred := range []constant.EndpointType{
		constant.EndpointTypeEmbeddings,
		constant.EndpointTypeJinaRerank,
		constant.EndpointTypeOpenAIResponse,
	} {
		for _, endpointType := range endpointTypes {
			if endpointType == preferred {
				return endpointType
			}
		}
	}

	lowerModel := strings.ToLower(modelName)
	if strings.Contains(lowerModel, "rerank") {
		return constant.EndpointTypeJinaRerank
	}
	if strings.Contains(lowerModel, "embedding") || strings.Contains(lowerModel, "embed") ||
		strings.HasPrefix(lowerModel, "m3e") || strings.Contains(lowerModel, "bge-") {
		return constant.EndpointTypeEmbeddings
	}
	if common.IsOpenAIResponseOnlyModel(modelName) {
		return constant.EndpointTypeOpenAIResponse
	}

	switch channelType {
	case constant.ChannelTypeAnthropic:
		return constant.EndpointTypeAnthropic
	case constant.ChannelTypeGemini:
		return constant.EndpointTypeGemini
	case constant.ChannelTypeSub2API, constant.ChannelTypeNewAPI:
		for _, preferred := range []constant.EndpointType{
			constant.EndpointTypeAnthropic,
			constant.EndpointTypeGemini,
			constant.EndpointTypeOpenAI,
		} {
			for _, endpointType := range endpointTypes {
				if endpointType == preferred {
					return endpointType
				}
			}
		}
	}
	return constant.EndpointTypeOpenAI
}
