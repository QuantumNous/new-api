package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/modelmapping"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

const compactAttemptedKeysContextKey = "compact_attempted_key_indexes"

type CompactAttemptedKeyIndexes map[int]map[int]struct{}

func SetCompactAttemptedKeyIndexes(c *gin.Context, attempted CompactAttemptedKeyIndexes) {
	if c == nil {
		return
	}
	c.Set(compactAttemptedKeysContextKey, attempted)
}

func GetCompactAttemptedKeyIndexes(c *gin.Context, channelID int) map[int]struct{} {
	if c == nil {
		return nil
	}
	value, ok := c.Get(compactAttemptedKeysContextKey)
	if !ok {
		return nil
	}
	attempted, ok := value.(CompactAttemptedKeyIndexes)
	if !ok {
		return nil
	}
	return attempted[channelID]
}

func CacheGetRandomSatisfiedCompactChannel(
	param *RetryParam,
	requestedModel string,
	stage relaycommon.CompactAttemptStage,
) (*model.Channel, string, error) {
	requestedModel = ratio_setting.CompactBaseModelName(requestedModel)
	if !ratio_setting.IsGPTCompactBaseModel(requestedModel) {
		stage = relaycommon.CompactAttemptBase
	}
	logicalModel := ratio_setting.WithCompactModelSuffix(requestedModel)
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
				attempted := GetCompactAttemptedKeyIndexes(param.Ctx, channel.Id)
				for _, keyIndex := range channel.GetEnabledKeyIndexes() {
					if _, used := attempted[keyIndex]; !used {
						return true
					}
				}
				return false
			},
		)
	})
}

func PreferredChannelCompactStage(channel *model.Channel, group, requestedModel string) relaycommon.CompactAttemptStage {
	requestedModel = ratio_setting.CompactBaseModelName(requestedModel)
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
	if ratio_setting.IsGPTCompactBaseModel(requestedModel) && compactChannelSupportsStage(channel, abilityModels, requestedModel, logicalModel, relaycommon.CompactAttemptExact) {
		return relaycommon.CompactAttemptExact
	}
	if compactChannelSupportsStage(channel, abilityModels, requestedModel, logicalModel, relaycommon.CompactAttemptBase) {
		return relaycommon.CompactAttemptBase
	}
	return relaycommon.CompactAttemptNone
}

func SpecificChannelCompactStage(channel *model.Channel, requestedModel string) relaycommon.CompactAttemptStage {
	requestedModel = ratio_setting.CompactBaseModelName(requestedModel)
	if channel == nil || !channelSupportsCompactEndpoint(channel, requestedModel) {
		return relaycommon.CompactAttemptNone
	}
	logicalModel := ratio_setting.WithCompactModelSuffix(requestedModel)
	abilityModels := make(map[string]bool)
	for _, modelName := range strings.Split(channel.Models, ",") {
		abilityModels[strings.TrimSpace(modelName)] = true
	}
	if ratio_setting.IsGPTCompactBaseModel(requestedModel) && compactChannelSupportsStage(channel, abilityModels, requestedModel, logicalModel, relaycommon.CompactAttemptExact) {
		return relaycommon.CompactAttemptExact
	}
	if compactChannelSupportsStage(channel, abilityModels, requestedModel, logicalModel, relaycommon.CompactAttemptBase) {
		return relaycommon.CompactAttemptBase
	}
	return relaycommon.CompactAttemptNone
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
		if !ratio_setting.IsGPTCompactBaseModel(requestedModel) {
			return false
		}
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

// ChannelSupportsNativeResponses reports whether a channel can receive the
// OpenAI Responses wire format without translating it to another protocol.
// Remote compaction state is meaningful only on these channels.
func ChannelSupportsNativeResponses(channel *model.Channel, requestedModel string) bool {
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
		return config != nil && config.SupportsNativeResponsesForModel(requestedModel)
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
