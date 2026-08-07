package service

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

var ErrAssetInvalidSpecificChannel = errors.New("invalid asset specific channel")

type AssetModelScopeInput struct {
	IdentityGroup         string
	TokenGroup            string
	AcceptUnpriced        bool
	ModelLimitsEnabled    bool
	ModelLimits           map[string]bool
	ModelBlacklistEnabled bool
	ModelBlacklist        map[string]bool
	SpecificChannelID     int
}

type AssetModelScope struct {
	ScopeKey          string
	Groups            []string
	ModelNames        []string
	SpecificChannelID int
}

type assetModelScopeHashPayload struct {
	Version           int      `json:"version"`
	Groups            []string `json:"groups"`
	Models            []string `json:"models"`
	SpecificChannelID int      `json:"specific_channel_id"`
}

func ResolveAssetModelScope(input AssetModelScopeInput) (AssetModelScope, error) {
	groups := ResolveTokenAccessGroups(input.IdentityGroup, input.TokenGroup)
	access, err := resolveStrictModelAccess(groups, input.AcceptUnpriced)
	if err != nil {
		return AssetModelScope{}, err
	}
	if input.ModelLimitsEnabled {
		access = filterResolvedModelAccess(access, func(modelName string) bool {
			return TokenAllowsModel(input.ModelLimits, modelName)
		})
	}
	if input.ModelBlacklistEnabled {
		access = filterResolvedModelAccess(access, func(modelName string) bool {
			return !TokenBlocksModel(input.ModelBlacklist, modelName)
		})
	}

	videoModels := make([]string, 0, len(access.models))
	for _, item := range access.models {
		if assetModelHasVideoEndpoint(item.SupportedEndpointTypes) {
			videoModels = append(videoModels, item.ID)
		}
	}
	videoModels = normalizedStrings(videoModels)
	if input.SpecificChannelID > 0 {
		videoModels, err = filterAssetModelsForSpecificChannel(groups, videoModels, input.SpecificChannelID)
		if err != nil {
			return AssetModelScope{}, err
		}
	}

	scope := AssetModelScope{
		Groups:            normalizedStrings(groups),
		ModelNames:        normalizedStrings(videoModels),
		SpecificChannelID: input.SpecificChannelID,
	}
	scope.ScopeKey, err = assetModelScopeKey(scope)
	if err != nil {
		return AssetModelScope{}, err
	}
	return scope, nil
}

func ResolveAssetModelScopeForContext(c *gin.Context, _ int) (AssetModelScope, error) {
	modelLimits := map[string]bool{}
	if value, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit); ok {
		if limits, valid := value.(map[string]bool); valid {
			modelLimits = limits
		}
	}
	modelBlacklist := map[string]bool{}
	if value, ok := common.GetContextKey(c, constant.ContextKeyTokenModelBlacklist); ok {
		if blacklist, valid := value.(map[string]bool); valid {
			modelBlacklist = blacklist
		}
	}

	userSetting, _ := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
	acceptUnpriced := operation_setting.SelfUseModeEnabled || userSetting.AcceptUnsetRatioModel
	specificChannelID := 0
	if rawSpecific, exists := common.GetContextKey(c, constant.ContextKeyTokenSpecificChannelId); exists {
		parsed, err := strconv.Atoi(strings.TrimSpace(fmt.Sprint(rawSpecific)))
		if err != nil || parsed <= 0 {
			return AssetModelScope{}, ErrAssetInvalidSpecificChannel
		}
		specificChannelID = parsed
	}
	return ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:         common.GetContextKeyString(c, constant.ContextKeyUserGroup),
		TokenGroup:            common.GetContextKeyString(c, constant.ContextKeyTokenGroup),
		AcceptUnpriced:        acceptUnpriced,
		ModelLimitsEnabled:    common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled),
		ModelLimits:           modelLimits,
		ModelBlacklistEnabled: common.GetContextKeyBool(c, constant.ContextKeyTokenModelBlacklistEnabled),
		ModelBlacklist:        modelBlacklist,
		SpecificChannelID:     specificChannelID,
	})
}

func assetModelHasVideoEndpoint(endpoints []constant.EndpointType) bool {
	for _, endpoint := range endpoints {
		if endpoint == constant.EndpointTypeVideo || endpoint == constant.EndpointTypeOpenAIVideo {
			return true
		}
	}
	return false
}

func filterAssetModelsForSpecificChannel(groups []string, modelNames []string, channelID int) ([]string, error) {
	if channelID <= 0 || len(modelNames) == 0 || len(groups) == 0 {
		return []string{}, nil
	}
	available := make(map[string]struct{}, len(modelNames))
	for _, group := range groups {
		for _, modelName := range modelNames {
			for retry := 0; ; retry++ {
				candidates, err := model.GetChannelCandidatesWithFilter(group, modelName, retry, nil)
				if err != nil {
					return nil, err
				}
				if len(candidates) == 0 {
					break
				}
				for _, channel := range candidates {
					if channel != nil && channel.Id == channelID {
						available[modelName] = struct{}{}
						break
					}
				}
				if _, ok := available[modelName]; ok {
					break
				}
			}
		}
	}
	filtered := make([]string, 0, len(available))
	for modelName := range available {
		filtered = append(filtered, modelName)
	}
	sort.Strings(filtered)
	return filtered, nil
}

func assetModelScopeKey(scope AssetModelScope) (string, error) {
	payload, err := common.Marshal(assetModelScopeHashPayload{
		Version:           1,
		Groups:            normalizedStrings(scope.Groups),
		Models:            normalizedStrings(scope.ModelNames),
		SpecificChannelID: scope.SpecificChannelID,
	})
	if err != nil {
		return "", err
	}
	return sha256Hex(payload), nil
}

func assetModelRoutingGroups(groups []string) string {
	return strings.Join(normalizedStrings(groups), ",")
}
