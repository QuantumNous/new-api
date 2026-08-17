package helper

import (
	"fmt"

	"github.com/QuantumNous/new-api/pkg/modelmapping"
	"github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

func ConfigureCompactAttempt(c *gin.Context, info *common.RelayInfo) error {
	if info == nil || info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return nil
	}
	if info.ChannelMeta == nil {
		info.InitChannelMeta(c)
	}

	mapping, err := modelmapping.Parse(c.GetString("model_mapping"))
	if err != nil {
		return err
	}
	var resolution modelmapping.CompactResolution
	switch info.CompactAttemptStage {
	case common.CompactAttemptExact:
		resolution, err = modelmapping.ResolveCompactExact(info.RequestedModel, mapping)
	case common.CompactAttemptBase:
		resolution, err = modelmapping.ResolveCompactBase(info.RequestedModel, mapping)
	default:
		return fmt.Errorf("compact attempt stage is not configured")
	}
	if err != nil {
		return err
	}

	info.LogicalBillingModel = resolution.LogicalBillingModel
	info.UpstreamAttemptModel = resolution.UpstreamModel
	info.UpstreamModelName = resolution.UpstreamModel
	info.IsModelMapped = resolution.Mapped
	return nil
}

func ModelMappedHelper(c *gin.Context, info *common.RelayInfo, request dto.Request) error {
	if info.ChannelMeta == nil {
		info.ChannelMeta = &common.ChannelMeta{}
	}
	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		if info.UpstreamAttemptModel == "" {
			if err := ConfigureCompactAttempt(c, info); err != nil {
				return err
			}
		}
		info.UpstreamModelName = info.UpstreamAttemptModel
		if request != nil {
			request.SetModelName(info.UpstreamAttemptModel)
		}
		return nil
	}

	mapping, err := modelmapping.Parse(c.GetString("model_mapping"))
	if err != nil {
		return err
	}
	upstreamModel, mapped, err := modelmapping.Resolve(info.OriginModelName, mapping)
	if err != nil {
		return err
	}
	if mapped {
		info.UpstreamModelName = upstreamModel
		info.IsModelMapped = true
	}
	if request != nil {
		request.SetModelName(info.UpstreamModelName)
	}
	return nil
}
