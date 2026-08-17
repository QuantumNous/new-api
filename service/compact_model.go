package service

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/modelmapping"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func CacheGetRandomSatisfiedCompactChannel(
	param *RetryParam,
	requestedModel string,
	stage relaycommon.CompactAttemptStage,
) (*model.Channel, string, error) {
	logicalModel := ratio_setting.WithCompactModelSuffix(requestedModel)
	usedChannels := make(map[int]int)
	for _, rawID := range param.Ctx.GetStringSlice("compact_stage_channels") {
		channelID, err := strconv.Atoi(rawID)
		if err == nil {
			usedChannels[channelID]++
		}
	}
	param.ModelName = logicalModel
	return cacheGetRandomSatisfiedChannel(param, func(group string, _ int) (*model.Channel, error) {
		return model.GetRandomSatisfiedChannelForModels(
			group,
			[]string{logicalModel, requestedModel},
			0,
			param.RequestPath,
			requestedModel,
			func(channel *model.Channel, abilityModels map[string]bool) bool {
				if !compactChannelSupportsStage(channel, abilityModels, requestedModel, logicalModel, stage) {
					return false
				}
				usedCount := usedChannels[channel.Id]
				if usedCount == 0 {
					return true
				}
				return channel.ChannelInfo.IsMultiKey && usedCount < len(channel.GetKeys())
			},
		)
	})
}

func PreferredChannelCompactStage(channel *model.Channel, group, requestedModel string) relaycommon.CompactAttemptStage {
	if channel == nil || !channelSupportsCompactEndpoint(channel, requestedModel) {
		return relaycommon.CompactAttemptNone
	}
	logicalModel := ratio_setting.WithCompactModelSuffix(requestedModel)
	exactAbility := model.IsChannelEnabledForGroupModel(group, logicalModel, channel.Id)
	baseAbility := model.IsChannelEnabledForGroupModel(group, requestedModel, channel.Id)
	abilityModels := map[string]bool{
		logicalModel:   exactAbility,
		requestedModel: baseAbility,
	}
	if compactChannelSupportsStage(channel, abilityModels, requestedModel, logicalModel, relaycommon.CompactAttemptExact) {
		return relaycommon.CompactAttemptExact
	}
	if compactChannelSupportsStage(channel, abilityModels, requestedModel, logicalModel, relaycommon.CompactAttemptBase) {
		return relaycommon.CompactAttemptBase
	}
	return relaycommon.CompactAttemptNone
}

func SpecificChannelCompactStage(channel *model.Channel, requestedModel string) relaycommon.CompactAttemptStage {
	if channel == nil || !channelSupportsCompactEndpoint(channel, requestedModel) {
		return relaycommon.CompactAttemptNone
	}
	logicalModel := ratio_setting.WithCompactModelSuffix(requestedModel)
	abilityModels := make(map[string]bool)
	for _, modelName := range strings.Split(channel.Models, ",") {
		abilityModels[strings.TrimSpace(modelName)] = true
	}
	if compactChannelSupportsStage(channel, abilityModels, requestedModel, logicalModel, relaycommon.CompactAttemptExact) {
		return relaycommon.CompactAttemptExact
	}
	return relaycommon.CompactAttemptBase
}

func compactChannelSupportsStage(
	channel *model.Channel,
	abilityModels map[string]bool,
	requestedModel string,
	logicalModel string,
	stage relaycommon.CompactAttemptStage,
) bool {
	if !channelSupportsCompactEndpoint(channel, requestedModel) {
		return false
	}
	switch stage {
	case relaycommon.CompactAttemptExact:
		if abilityModels[logicalModel] || abilityModels[ratio_setting.FormatMatchingModelName(logicalModel)] {
			return true
		}
		if !abilityModels[requestedModel] && !abilityModels[ratio_setting.FormatMatchingModelName(requestedModel)] {
			return false
		}
		mapping, err := modelmapping.Parse(channel.GetModelMapping())
		if err != nil {
			return false
		}
		resolution, err := modelmapping.ResolveCompactExact(requestedModel, mapping)
		return err == nil && resolution.BaseMappingTargetsExact
	case relaycommon.CompactAttemptBase:
		return abilityModels[requestedModel] || abilityModels[ratio_setting.FormatMatchingModelName(requestedModel)]
	default:
		return false
	}
}

func channelSupportsCompactEndpoint(channel *model.Channel, requestedModel string) bool {
	if channel == nil {
		return false
	}
	switch channel.Type {
	case constant.ChannelTypeOpenAI,
		constant.ChannelTypeAzure,
		constant.ChannelTypeCodex,
		constant.ChannelTypeNewAPI,
		constant.ChannelTypeSub2API:
		return true
	case constant.ChannelTypeAdvancedCustom:
		config := channel.GetOtherSettings().AdvancedCustom
		return config != nil && config.SupportsPathForModel("/v1/responses/compact", requestedModel)
	default:
		return false
	}
}

func SetCompactStage(c *gin.Context, stage relaycommon.CompactAttemptStage) {
	c.Set(string(constant.ContextKeyCompactStage), string(stage))
}

func CompactStageFromContext(c *gin.Context) relaycommon.CompactAttemptStage {
	return relaycommon.CompactAttemptStage(c.GetString(string(constant.ContextKeyCompactStage)))
}

func ResetCompactAutoGroupSelection(c *gin.Context) {
	common.SetContextKey(c, constant.ContextKeyAutoGroupIndex, 0)
	common.SetContextKey(c, constant.ContextKeyAutoGroupRetryIndex, 0)
}
