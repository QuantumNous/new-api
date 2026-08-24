package middleware

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

type ModelRequest struct {
	Model string `json:"model"`
	Group string `json:"group,omitempty"`
}

func resolvePlaygroundUsingGroup(c *gin.Context, usingGroup string, requestedGroup string) (string, error) {
	userGroup := ""
	if userID := c.GetInt("id"); userID > 0 {
		var err error
		userGroup, err = model.GetUserGroup(userID, true)
		if err != nil || userGroup == "" {
			return "", fmt.Errorf("group access denied")
		}
	}
	if userGroup == "" {
		userGroup = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}
	if userGroup == "" {
		userGroup = c.GetString("group")
	}
	if userGroup == "" {
		return "", fmt.Errorf("group access denied")
	}
	if userGroup == plgGroup {
		return plgGroup, nil
	}
	if usingGroup == "" {
		usingGroup = userGroup
	}
	if requestedGroup == "" {
		return usingGroup, nil
	}
	if !service.GroupInUserUsableGroups(userGroup, requestedGroup) && requestedGroup != userGroup {
		return "", fmt.Errorf("group access denied")
	}
	return requestedGroup, nil
}

func Distribute() func(c *gin.Context) {
	return func(c *gin.Context) {
		var channel *model.Channel
		channelId, ok := common.GetContextKey(c, constant.ContextKeyTokenSpecificChannelId)
		modelRequest, shouldSelectChannel, err := getModelRequest(c)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
			return
		}
		hasAssetRefs, assetPreflightErr := hasBytePlusAssetReferences(c, shouldSelectChannel)
		if assetPreflightErr != nil {
			abortWithOpenAiMessage(c, assetPreflightErr.StatusCode, bytePlusAssetPublicMessage(assetPreflightErr.GetErrorCode()), assetPreflightErr.GetErrorCode())
			return
		}
		if shouldSelectChannel && (!ok || hasAssetRefs) {
			if modelRequest.Model == "" {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorModelNameRequired))
				return
			}
		}
		enforceModelLimits := !shouldSelectChannel || !ok || hasAssetRefs
		if modelRequest.Model != "" && !enforceTokenModelAccess(c, modelRequest.Model, enforceModelLimits) {
			return
		}
		assetResolution, assetErr := resolveAssetReferenceSet(c, shouldSelectChannel)
		legacyAssetResolution, legacyAssetErr := resolveLegacyBytePlusAssetResolution(c, shouldSelectChannel)
		if legacyAssetErr != nil {
			if abortBytePlusAssetSpecificChannelConflict(c, channelId, ok, legacyAssetResolution.PinnedChannelID) {
				return
			}
			abortWithOpenAiMessage(c, legacyAssetErr.StatusCode, bytePlusAssetPublicMessage(legacyAssetErr.GetErrorCode()), legacyAssetErr.GetErrorCode())
			return
		}
		var legacyPinnedChannel *model.Channel
		legacyPinnedSelectGroup := ""
		if legacyAssetResolution.HasPinnedReference() {
			if abortBytePlusAssetSpecificChannelConflict(c, channelId, ok, legacyAssetResolution.PinnedChannelID) {
				return
			}
			if !ok {
				var pinnedErr *types.NewAPIError
				legacyPinnedChannel, legacyPinnedSelectGroup, pinnedErr = selectBytePlusPinnedAssetChannel(c, modelRequest, legacyAssetResolution)
				if pinnedErr != nil {
					abortWithOpenAiMessage(c, pinnedErr.StatusCode, bytePlusAssetPublicMessage(pinnedErr.GetErrorCode()), pinnedErr.GetErrorCode())
					return
				}
			}
		}
		if assetErr != nil {
			abortWithOpenAiMessage(c, assetErr.StatusCode, bytePlusAssetPublicMessage(assetErr.GetErrorCode()), assetErr.GetErrorCode())
			return
		}
		hasAssetRefs = assetResolution.HasReferences()
		if hasAssetRefs {
			common.SetContextKey(c, constant.ContextKeyAssetReferenceSet, assetResolution)
		}
		if legacyPinnedChannel != nil {
			if hasAssetRefs {
				if _, eligible := assetResolution.ReadinessForChannel(legacyPinnedChannel, modelRequest.Model); !eligible {
					abortWithOpenAiMessage(c, http.StatusServiceUnavailable, bytePlusAssetPublicMessage(types.ErrorCodeAssetChannelUnavailable), types.ErrorCodeAssetChannelUnavailable)
					return
				}
			}
			channel = legacyPinnedChannel
			if legacyPinnedSelectGroup != "" {
				common.SetContextKey(c, constant.ContextKeyTokenGroup, legacyPinnedSelectGroup)
			}
		} else if ok {
			id, err := strconv.Atoi(channelId.(string))
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
				return
			}
			channel, err = model.GetChannelById(id, true)
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
				return
			}
			if channel.Status != common.ChannelStatusEnabled {
				abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorChannelDisabled))
				return
			}
			if hasAssetRefs {
				if _, eligible := assetResolution.ReadinessForChannel(channel, modelRequest.Model); !eligible {
					abortWithOpenAiMessage(c, http.StatusServiceUnavailable, bytePlusAssetPublicMessage(types.ErrorCodeAssetChannelUnavailable), types.ErrorCodeAssetChannelUnavailable)
					return
				}
			}
		} else {
			// Select a channel for the user
			if shouldSelectChannel {
				var selectGroup string
				usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
				// Playground relay requests carry the requested billing group in JSON.
				if strings.HasPrefix(c.Request.URL.Path, "/pg/") {
					playgroundRequest := &dto.PlayGroundRequest{}
					err = common.UnmarshalBodyReusable(c, playgroundRequest)
					if err != nil {
						abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidPlayground, map[string]any{"Error": err.Error()}))
						return
					}
					usingGroup, err = resolvePlaygroundUsingGroup(c, usingGroup, playgroundRequest.Group)
					if err != nil {
						abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorGroupAccessDenied))
						return
					}
					common.SetContextKey(c, constant.ContextKeyUsingGroup, usingGroup)
					common.SetContextKey(c, constant.ContextKeyTokenGroup, usingGroup)
				}

				if !hasAssetRefs {
					if preferredChannelID, found := service.GetPreferredChannelByAffinity(c, modelRequest.Model, usingGroup); found {
						affinityUsable := false
						affinityConcurrencyLimited := false
						preferred, err := model.CacheGetChannel(preferredChannelID)
						if err == nil && preferred != nil && preferred.Status == common.ChannelStatusEnabled {
							if usingGroup == "auto" {
								userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
								autoGroups := service.GetUserAutoGroup(userGroup)
								for _, g := range autoGroups {
									if model.IsChannelEnabledForGroupModel(g, modelRequest.Model, preferred.Id) {
										if service.ChannelSupportsRequestEndpoint(c, preferred, modelRequest.Model) {
											ok, acquireErr := service.AcquireChannelConcurrencyWithWaitForContext(c, preferred)
											if acquireErr != nil {
												if errors.Is(acquireErr, service.ErrChannelConcurrencyLimit) {
													affinityConcurrencyLimited = true
													break
												}
												abortWithOpenAiMessage(c, http.StatusServiceUnavailable, fmt.Sprintf("acquire channel concurrency failed: %s", acquireErr.Error()), types.ErrorCodeGetChannelFailed)
												return
											}
											if !ok {
												affinityConcurrencyLimited = true
												break
											}
											selectGroup = g
											common.SetContextKey(c, constant.ContextKeyAutoGroup, g)
											channel = preferred
											affinityUsable = true
											service.MarkChannelAffinityUsed(c, g, preferred.Id)
											break
										}
									}
								}
							} else if model.IsChannelEnabledForGroupModel(usingGroup, modelRequest.Model, preferred.Id) &&
								service.ChannelSupportsRequestEndpoint(c, preferred, modelRequest.Model) {
								ok, acquireErr := service.AcquireChannelConcurrencyWithWaitForContext(c, preferred)
								if acquireErr != nil {
									if errors.Is(acquireErr, service.ErrChannelConcurrencyLimit) {
										affinityConcurrencyLimited = true
									} else {
										abortWithOpenAiMessage(c, http.StatusServiceUnavailable, fmt.Sprintf("acquire channel concurrency failed: %s", acquireErr.Error()), types.ErrorCodeGetChannelFailed)
										return
									}
								}
								if !ok || affinityConcurrencyLimited {
									affinityConcurrencyLimited = true
								} else {
									channel = preferred
									selectGroup = usingGroup
									affinityUsable = true
									service.MarkChannelAffinityUsed(c, usingGroup, preferred.Id)
								}
							}
						}
						if !affinityUsable {
							// 亲和命中的渠道已被禁用时，按 fork 策略 fail-fast：不静默改路到其他渠道，
							// 直接报错让用户联系管理员（与 controller/relay.go 重试逻辑使用的同一开关保持一致）。
							if err == nil && preferred != nil && preferred.Status != common.ChannelStatusEnabled &&
								service.ShouldSkipRetryAfterChannelAffinityFailure(c) {
								abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorAffinityChannelDisabled))
								return
							}
							// 否则沿用上游行为：根据配置决定是否清除亲和粘性缓存，随后重新选路。
							if !affinityConcurrencyLimited && !service.ShouldKeepChannelAffinityOnChannelDisabled() {
								service.ClearCurrentChannelAffinityCache(c)
							}
						}
					}
				}

				if channel == nil {
					channel, selectGroup, err = service.CacheGetRandomSatisfiedChannel(&service.RetryParam{
						Ctx:           c,
						ModelName:     modelRequest.Model,
						TokenGroup:    usingGroup,
						Retry:         common.GetPointer(0),
						ChannelRanker: assetResolution.ChannelRanker(modelRequest.Model),
					})
					if err != nil {
						if hasAssetRefs && !errors.Is(err, service.ErrChannelConcurrencyLimit) {
							abortWithOpenAiMessage(c, http.StatusServiceUnavailable, bytePlusAssetPublicMessage(types.ErrorCodeAssetChannelUnavailable), types.ErrorCodeAssetChannelUnavailable)
							return
						}
						statusCode := http.StatusServiceUnavailable
						errorCode := types.ErrorCodeModelNotFound
						if errors.Is(err, service.ErrChannelConcurrencyLimit) {
							statusCode = http.StatusTooManyRequests
							errorCode = types.ErrorCodeGetChannelFailed
						}
						showGroup := usingGroup
						if usingGroup == "auto" {
							showGroup = fmt.Sprintf("auto(%s)", selectGroup)
						}
						message := i18n.T(c, i18n.MsgDistributorGetChannelFailed, map[string]any{"Group": showGroup, "Model": modelRequest.Model, "Error": err.Error()})
						// 如果错误，但是渠道不为空，说明是数据库一致性问题
						//if channel != nil {
						//	common.SysError(fmt.Sprintf("渠道不存在：%d", channel.Id))
						//	message = "数据库一致性已被破坏，请联系管理员"
						//}
						abortWithOpenAiMessage(c, statusCode, message, errorCode)
						return
					}
					if channel == nil {
						if hasAssetRefs {
							abortWithOpenAiMessage(c, http.StatusServiceUnavailable, bytePlusAssetPublicMessage(types.ErrorCodeAssetChannelUnavailable), types.ErrorCodeAssetChannelUnavailable)
							return
						}
						abortWithOpenAiMessage(c, http.StatusServiceUnavailable, i18n.T(c, i18n.MsgDistributorNoAvailableChannel, map[string]any{"Group": usingGroup, "Model": modelRequest.Model}), types.ErrorCodeModelNotFound)
						return
					}
				}
			}
		}
		common.SetContextKey(c, constant.ContextKeyRequestStartTime, time.Now())
		if channel != nil {
			ok, err := service.EnsureChannelConcurrencyWithWaitForContext(c, channel)
			if err != nil {
				if errors.Is(err, service.ErrChannelConcurrencyLimit) {
					abortWithOpenAiMessage(c, http.StatusTooManyRequests, "channel concurrency limit exceeded", types.ErrorCodeGetChannelFailed)
					return
				}
				abortWithOpenAiMessage(c, http.StatusServiceUnavailable, fmt.Sprintf("acquire channel concurrency failed: %s", err.Error()), types.ErrorCodeGetChannelFailed)
				return
			}
			if !ok {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, "channel concurrency limit exceeded", types.ErrorCodeGetChannelFailed)
				return
			}
			if newAPIError := SetupContextForSelectedChannel(c, channel, modelRequest.Model); newAPIError != nil {
				_ = service.ReleaseChannelConcurrencyForContext(c)
				abortWithOpenAiMessage(c, newAPIError.StatusCode, newAPIError.Error(), newAPIError.GetErrorCode())
				return
			}
			if newAPIError := RefreshAssetRewriteMapForSelectedChannel(c, channel); newAPIError != nil {
				_ = service.ReleaseChannelConcurrencyForContext(c)
				abortWithOpenAiMessage(c, newAPIError.StatusCode, newAPIError.Error(), newAPIError.GetErrorCode())
				return
			}
			defer service.ReleaseChannelConcurrencyForContext(c)
		}
		c.Next()
		if channel != nil && c.Writer != nil && c.Writer.Status() < http.StatusBadRequest {
			service.RecordChannelAffinity(c, channel.Id)
		}
	}
}

func enforceTokenModelAccess(c *gin.Context, requestedModel string, enforceModelLimits bool) bool {
	if common.GetContextKeyBool(c, constant.ContextKeyTokenModelBlacklistEnabled) {
		if blacklistValue, exists := common.GetContextKey(c, constant.ContextKeyTokenModelBlacklist); exists {
			if blacklist, valid := blacklistValue.(map[string]bool); valid && service.TokenBlocksModel(blacklist, requestedModel) {
				abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorTokenModelForbidden, map[string]any{"Model": requestedModel}))
				return false
			}
		}
	}
	if !enforceModelLimits || !common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) {
		return true
	}

	limitsValue, exists := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
	if !exists {
		abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorTokenNoModelAccess))
		return false
	}
	tokenModelLimit, valid := limitsValue.(map[string]bool)
	if !valid {
		tokenModelLimit = map[string]bool{}
	}
	if !service.TokenAllowsModel(tokenModelLimit, requestedModel) {
		abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorTokenModelForbidden, map[string]any{"Model": requestedModel}))
		return false
	}
	return true
}

func abortBytePlusAssetSpecificChannelConflict(c *gin.Context, channelId any, hasSpecificChannel bool, pinnedChannelID int) bool {
	if !hasSpecificChannel || pinnedChannelID == 0 {
		return false
	}
	specificChannelID, ok := channelId.(string)
	if !ok {
		abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
		return true
	}
	id, err := strconv.Atoi(specificChannelID)
	if err != nil {
		abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
		return true
	}
	if id != pinnedChannelID {
		abortWithOpenAiMessage(c, http.StatusConflict, bytePlusAssetPublicMessage(types.ErrorCodeAssetChannelConflict), types.ErrorCodeAssetChannelConflict)
		return true
	}
	return false
}

func resolveLegacyBytePlusAssetResolution(c *gin.Context, shouldSelectChannel bool) (service.BytePlusAssetReferenceResolution, *types.NewAPIError) {
	if !shouldSelectChannel || c == nil || c.Request == nil {
		return service.BytePlusAssetReferenceResolution{}, nil
	}
	relayMode, _ := c.Get("relay_mode")
	if relayMode != relayconstant.RelayModeVideoSubmit {
		return service.BytePlusAssetReferenceResolution{}, nil
	}
	var seedanceReq dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &seedanceReq); err != nil {
		return service.BytePlusAssetReferenceResolution{}, bytePlusAssetDistributionError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	return service.ResolveLegacyBytePlusAssetBindingReferences(common.GetContextKeyInt(c, constant.ContextKeyUserId), &seedanceReq)
}

// resolveAssetReferenceSet parses reusable video submit bodies only far enough
// to authorize strict reusable asset references before channel routing.
func resolveAssetReferenceSet(c *gin.Context, shouldSelectChannel bool) (service.AssetReferenceSet, *types.NewAPIError) {
	if !shouldSelectChannel || c == nil || c.Request == nil {
		return service.AssetReferenceSet{}, nil
	}
	relayMode, _ := c.Get("relay_mode")
	if relayMode != relayconstant.RelayModeVideoSubmit {
		return service.AssetReferenceSet{}, nil
	}

	var seedanceReq dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &seedanceReq); err != nil {
		return service.AssetReferenceSet{}, bytePlusAssetDistributionError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	return service.ResolveAssetReferences(c, common.GetContextKeyInt(c, constant.ContextKeyUserId), &seedanceReq)
}

func hasBytePlusAssetReferences(c *gin.Context, shouldSelectChannel bool) (bool, *types.NewAPIError) {
	if !shouldSelectChannel || c == nil || c.Request == nil {
		return false, nil
	}
	relayMode, _ := c.Get("relay_mode")
	if relayMode != relayconstant.RelayModeVideoSubmit {
		return false, nil
	}

	var seedanceReq dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &seedanceReq); err != nil {
		return false, bytePlusAssetDistributionError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	for _, item := range seedanceReq.Content {
		for _, raw := range []string{
			seedanceItemURL(item.ImageURL),
			seedanceItemURL(item.VideoURL),
			seedanceItemURL(item.AudioURL),
		} {
			hasReference, apiErr := bytePlusAssetURLHasReference(raw)
			if apiErr != nil || hasReference {
				return hasReference, apiErr
			}
		}
	}
	return false, nil
}

func seedanceItemURL(urlObject *dto.SeedanceURLObject) string {
	if urlObject == nil {
		return ""
	}
	return urlObject.URL
}

func bytePlusAssetURLHasReference(raw string) (bool, *types.NewAPIError) {
	if service.IsStrictBytePlusAssetURI(raw) {
		return true, nil
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(raw)), "asset:") {
		return false, bytePlusAssetDistributionError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	return false, nil
}

func RefreshAssetRewriteMapForSelectedChannel(c *gin.Context, channel *model.Channel) *types.NewAPIError {
	if c == nil || channel == nil {
		return nil
	}
	references, ok := common.GetContextKeyType[service.AssetReferenceSet](c, constant.ContextKeyAssetReferenceSet)
	if !ok || !references.HasReferences() {
		return nil
	}
	originModel := strings.TrimSpace(c.GetString("original_model"))
	ctx := context.Background()
	if c.Request != nil {
		ctx = c.Request.Context()
	}
	if service.AssetModelChannelUsesSourceURLForChannel(channel) {
		modelInfo := &relaycommon.RelayInfo{
			OriginModelName: originModel,
			ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: originModel},
		}
		if err := relayhelper.ModelMappedHelper(c, modelInfo, nil); err != nil {
			clearAssetRewriteMap(c)
			return bytePlusAssetDistributionError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
		}
		rewriteMap, err := service.ResolveAssetSourceURLRewriteMap(
			ctx,
			common.GetContextKeyInt(c, constant.ContextKeyUserId),
			references,
			channel,
			originModel,
		)
		if err != nil {
			clearAssetRewriteMap(c)
			return service.AssetBindingAPIError(err)
		}
		if len(rewriteMap) == 0 {
			clearAssetRewriteMap(c)
			return nil
		}
		common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, rewriteMap)
		common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, rewriteMap)
		return nil
	}
	if !common.GetContextKeyBool(c, constant.ContextKeyAssetMaterializeEnabled) {
		rewriteMap := references.RewriteMapForSelectedChannel(
			channel,
			originModel,
			common.GetContextKeyString(c, constant.ContextKeyChannelKey),
		)
		if len(rewriteMap) == 0 {
			clearAssetRewriteMap(c)
			return nil
		}
		common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, rewriteMap)
		common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, rewriteMap)
		return nil
	}
	modelInfo := &relaycommon.RelayInfo{
		OriginModelName: originModel,
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: originModel},
	}
	if err := relayhelper.ModelMappedHelper(c, modelInfo, nil); err != nil {
		clearAssetRewriteMap(c)
		return bytePlusAssetDistributionError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	materializeOptions, keyIndex, err := service.ResolveAssetMaterializeOptions(
		references,
		channel,
		service.AssetMaterializeOptions{
			Model:  strings.TrimSpace(modelInfo.UpstreamModelName),
			APIKey: common.GetContextKeyString(c, constant.ContextKeyChannelKey),
		},
	)
	if err != nil {
		clearAssetRewriteMap(c)
		return service.AssetBindingAPIError(err)
	}
	if keyIndex >= 0 && materializeOptions.APIKey != common.GetContextKeyString(c, constant.ContextKeyChannelKey) {
		common.SetContextKey(c, constant.ContextKeyChannelKey, materializeOptions.APIKey)
		if channel.ChannelInfo.IsMultiKey {
			common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, keyIndex)
		}
	}
	rewriteMap, err := service.MaterializeAssetBindingsForChannel(
		ctx,
		common.GetContextKeyInt(c, constant.ContextKeyUserId),
		references,
		channel,
		materializeOptions,
	)
	if err != nil {
		clearAssetRewriteMap(c)
		return service.AssetBindingAPIError(err)
	}
	if len(rewriteMap) == 0 {
		clearAssetRewriteMap(c)
		return nil
	}
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, rewriteMap)
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, rewriteMap)
	return nil
}

func clearAssetRewriteMap(c *gin.Context) {
	if c == nil || c.Keys == nil {
		return
	}
	delete(c.Keys, string(constant.ContextKeyAssetRewriteMap))
	delete(c.Keys, string(constant.ContextKeyBytePlusAssetRewriteMap))
}

// BytePlus asset references are resolved before normal channel selection so
// they cannot fall back to a different upstream account.
func selectBytePlusPinnedAssetChannel(c *gin.Context, modelRequest *ModelRequest, resolution service.BytePlusAssetReferenceResolution) (*model.Channel, string, *types.NewAPIError) {
	channel, err := model.GetChannelById(resolution.PinnedChannelID, true)
	if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled || channel.Type != constant.ChannelTypeBytePlus {
		return nil, "", bytePlusAssetDistributionError(types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}

	usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	if usingGroup == "" {
		usingGroup = common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	}
	if usingGroup == "" {
		usingGroup = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}
	if usingGroup == "" {
		usingGroup = "default"
	}

	selectedGroup := ""
	if usingGroup == "auto" {
		userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		for _, group := range service.GetUserAutoGroup(userGroup) {
			if model.IsChannelEnabledForGroupModel(group, modelRequest.Model, channel.Id) &&
				service.ChannelSupportsRequestEndpoint(c, channel, modelRequest.Model) {
				selectedGroup = group
				common.SetContextKey(c, constant.ContextKeyAutoGroup, group)
				break
			}
		}
	} else if model.IsChannelEnabledForGroupModel(usingGroup, modelRequest.Model, channel.Id) &&
		service.ChannelSupportsRequestEndpoint(c, channel, modelRequest.Model) {
		selectedGroup = usingGroup
	}
	if selectedGroup == "" {
		return nil, "", bytePlusAssetDistributionError(types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	return channel, selectedGroup, nil
}

func bytePlusAssetDistributionError(code types.ErrorCode, statusCode int) *types.NewAPIError {
	return types.NewOpenAIError(errors.New(bytePlusAssetPublicMessage(code)), code, statusCode, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
}

func bytePlusAssetPublicMessage(code types.ErrorCode) string {
	switch code {
	case types.ErrorCodeInvalidAssetRequest:
		return "invalid asset request"
	case types.ErrorCodeAssetNotFound:
		return "asset not found"
	case types.ErrorCodeAssetNotReady:
		return "asset is not ready"
	case types.ErrorCodeAssetFailed:
		return "asset failed"
	case types.ErrorCodeAssetChannelConflict:
		return "asset channel conflict"
	case types.ErrorCodeAssetChannelUnavailable:
		return "asset channel unavailable"
	case types.ErrorCodeAssetGroupInitializing:
		return "asset group is initializing"
	case types.ErrorCodeAssetUpstreamError:
		return "asset upstream error"
	case types.ErrorCodeAssetStorageError:
		return "asset storage error"
	default:
		return string(code)
	}
}

// getModelFromRequest reads the requested model without consuming the reusable
// request body used later by relay adaptors.
func getModelFromRequest(c *gin.Context) (*ModelRequest, error) {
	if strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		modelRequest, err := getModelFromJSONBody(c)
		if err != nil {
			return nil, errors.New(i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
		}
		return modelRequest, nil
	}

	var modelRequest ModelRequest
	err := common.UnmarshalBodyReusable(c, &modelRequest)
	if err != nil {
		return nil, errors.New(i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
	}
	return &modelRequest, nil
}

func getModelFromJSONBody(c *gin.Context) (*ModelRequest, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return nil, err
	}
	if !gjson.ValidBytes(requestBody) {
		return nil, errors.New("invalid JSON request body")
	}

	values := gjson.GetManyBytes(requestBody, "model", "group")
	model, err := getJSONStringValue(values[0], "model")
	if err != nil {
		return nil, err
	}
	group, err := getJSONStringValue(values[1], "group")
	if err != nil {
		return nil, err
	}

	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return nil, seekErr
	}
	c.Request.Body = io.NopCloser(storage)

	return &ModelRequest{
		Model: model,
		Group: group,
	}, nil
}

func getJSONStringValue(result gjson.Result, field string) (string, error) {
	if !result.Exists() || result.Type == gjson.Null {
		return "", nil
	}
	if result.Type != gjson.String {
		return "", fmt.Errorf("field %s must be a string", field)
	}
	return result.String(), nil
}

// elevenLabsPathModel maps an ElevenLabs native endpoint path to the billing model
// registered as an ability on the ElevenLabs channel. Kept as string literals to
// avoid importing relay/channel from middleware.
func elevenLabsPathModel(path string) (string, bool) {
	switch {
	case strings.HasPrefix(path, "/v1/text-to-speech/"):
		return "eleven_multilingual_v2", true
	case path == "/v1/sound-generation":
		return "eleven_sound_v1", true
	case path == "/v1/voices":
		// Listing voices still needs a channel to proxy through; not billed.
		return "eleven_multilingual_v2", true
	}
	return "", false
}

func getModelRequest(c *gin.Context) (*ModelRequest, bool, error) {
	var modelRequest ModelRequest
	shouldSelectChannel := true
	var err error
	requestPath := c.Request.URL.Path
	if strings.HasPrefix(requestPath, "/pg/") {
		requestPath = "/v1/" + strings.TrimPrefix(requestPath, "/pg/")
	}
	if strings.Contains(c.Request.URL.Path, "/mj/") {
		relayMode := relayconstant.Path2RelayModeMidjourney(c.Request.URL.Path)
		if relayMode == relayconstant.RelayModeMidjourneyTaskFetch ||
			relayMode == relayconstant.RelayModeMidjourneyTaskFetchByCondition ||
			relayMode == relayconstant.RelayModeMidjourneyNotify ||
			relayMode == relayconstant.RelayModeMidjourneyTaskImageSeed {
			shouldSelectChannel = false
		} else {
			midjourneyRequest := dto.MidjourneyRequest{}
			err = common.UnmarshalBodyReusable(c, &midjourneyRequest)
			if err != nil {
				return nil, false, errors.New(i18n.T(c, i18n.MsgDistributorInvalidMidjourney, map[string]any{"Error": err.Error()}))
			}
			midjourneyModel, mjErr, success := service.GetMjRequestModel(relayMode, &midjourneyRequest)
			if mjErr != nil {
				return nil, false, fmt.Errorf("%s", mjErr.Description)
			}
			if midjourneyModel == "" {
				if !success {
					return nil, false, fmt.Errorf("%s", i18n.T(c, i18n.MsgDistributorInvalidParseModel))
				} else {
					// task fetch, task fetch by condition, notify
					shouldSelectChannel = false
				}
			}
			modelRequest.Model = midjourneyModel
		}
		c.Set("relay_mode", relayMode)
	} else if strings.Contains(c.Request.URL.Path, "/suno/") {
		relayMode := relayconstant.Path2RelaySuno(c.Request.Method, c.Request.URL.Path)
		if relayMode == relayconstant.RelayModeSunoFetch ||
			relayMode == relayconstant.RelayModeSunoFetchByID {
			shouldSelectChannel = false
		} else {
			modelName := service.CoverTaskActionToModelName(constant.TaskPlatformSuno, c.Param("action"))
			modelRequest.Model = modelName
		}
		c.Set("platform", string(constant.TaskPlatformSuno))
		c.Set("relay_mode", relayMode)
	} else if elModel, ok := elevenLabsPathModel(c.Request.URL.Path); ok {
		// ElevenLabs native voice/SFX endpoints resolve their billing model from
		// the path (like /suno/ above), since the request body carries no OpenAI "model"
		// field. The resolved model is registered as an ability on the ElevenLabs channel.
		modelRequest.Model = elModel
	} else if strings.HasPrefix(c.Request.URL.Path, "/v1/video-to-music") {
		relayMode := relayconstant.RelayModeVideoSubmit
		if c.Request.Method == http.MethodPost {
			req, err := getModelFromRequest(c)
			if err != nil {
				return nil, false, err
			}
			if req != nil {
				modelRequest.Model = req.Model
			}
		} else if c.Request.Method == http.MethodGet {
			relayMode = relayconstant.RelayModeVideoFetchByID
			shouldSelectChannel = false
			modelRequest.Model = getTaskOriginModelName(c)
		}
		c.Set("relay_mode", relayMode)
	} else if strings.Contains(requestPath, "/v1/videos/") && strings.HasSuffix(requestPath, "/remix") {
		relayMode := relayconstant.RelayModeVideoSubmit
		c.Set("relay_mode", relayMode)
		shouldSelectChannel = false
	} else if strings.HasPrefix(c.Request.URL.Path, "/v1/generation/tasks") {
		relayMode := relayconstant.RelayModeUnknown
		if c.Request.Method == http.MethodPost {
			req, err := getModelFromRequest(c)
			if err != nil {
				return nil, false, err
			}
			if req != nil {
				modelRequest.Model = req.Model
			}
			relayMode = relayconstant.RelayModeVideoSubmit
		} else if c.Request.Method == http.MethodGet {
			relayMode = relayconstant.RelayModeVideoFetchByID
			shouldSelectChannel = false
			modelRequest.Model = getTaskOriginModelName(c)
		}
		c.Set("relay_mode", relayMode)
	} else if strings.Contains(requestPath, "/v1/videos") {
		//curl https://api.openai.com/v1/videos \
		//  -H "Authorization: Bearer $OPENAI_API_KEY" \
		//  -F "model=sora-2" \
		//  -F "prompt=A calico cat playing a piano on stage"
		//	-F input_reference="@image.jpg"
		relayMode := relayconstant.RelayModeUnknown
		if c.Request.Method == http.MethodPost {
			relayMode = relayconstant.RelayModeVideoSubmit
			req, err := getModelFromRequest(c)
			if err != nil {
				return nil, false, err
			}
			if req != nil {
				modelRequest.Model = req.Model
			}
		} else if c.Request.Method == http.MethodGet {
			relayMode = relayconstant.RelayModeVideoFetchByID
			shouldSelectChannel = false
			modelRequest.Model = getTaskOriginModelName(c)
		}
		c.Set("relay_mode", relayMode)
	} else if strings.Contains(requestPath, "/v1/video/generations") {
		relayMode := relayconstant.RelayModeUnknown
		if c.Request.Method == http.MethodPost {
			req, err := getModelFromRequest(c)
			if err != nil {
				return nil, false, err
			}
			modelRequest.Model = req.Model
			relayMode = relayconstant.RelayModeVideoSubmit
		} else if c.Request.Method == http.MethodGet {
			relayMode = relayconstant.RelayModeVideoFetchByID
			shouldSelectChannel = false
			modelRequest.Model = getTaskOriginModelName(c)
		}
		if _, ok := c.Get("relay_mode"); !ok {
			c.Set("relay_mode", relayMode)
		}
	} else if strings.HasPrefix(c.Request.URL.Path, "/v1beta/models/") || strings.HasPrefix(c.Request.URL.Path, "/v1/models/") {
		// Gemini API 路径处理: /v1beta/models/gemini-2.0-flash:generateContent
		relayMode := relayconstant.RelayModeGemini
		modelName := extractModelNameFromGeminiPath(c.Request.URL.Path)
		if modelName != "" {
			modelRequest.Model = modelName
		}
		c.Set("relay_mode", relayMode)
	} else if !strings.HasPrefix(c.Request.URL.Path, "/v1/audio/transcriptions") && !strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		req, err := getModelFromRequest(c)
		if err != nil {
			return nil, false, err
		}
		modelRequest.Model = req.Model
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/realtime") {
		//wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01
		modelRequest.Model = c.Query("model")
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/moderations") {
		if modelRequest.Model == "" {
			modelRequest.Model = "text-moderation-stable"
		}
	}
	if strings.HasSuffix(c.Request.URL.Path, "embeddings") {
		if modelRequest.Model == "" {
			modelRequest.Model = c.Param("model")
		}
	}
	if strings.HasPrefix(requestPath, "/v1/images/generations") {
		modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "dall-e")
		c.Set("relay_mode", relayconstant.RelayModeImagesGenerations)
	} else if strings.HasPrefix(requestPath, "/v1/images/edits") {
		//modelRequest.Model = common.GetStringIfEmpty(c.PostForm("model"), "gpt-image-1")
		contentType := c.ContentType()
		if slices.Contains([]string{gin.MIMEPOSTForm, gin.MIMEMultipartPOSTForm}, contentType) {
			req, err := getModelFromRequest(c)
			if err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
		}
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/audio") {
		relayMode := relayconstant.RelayModeAudioSpeech
		if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/speech") {

			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "tts-1")
		} else if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/translations") {
			// 先尝试从请求读取
			if req, err := getModelFromRequest(c); err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "whisper-1")
			relayMode = relayconstant.RelayModeAudioTranslation
		} else if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/transcriptions") {
			// 先尝试从请求读取
			if req, err := getModelFromRequest(c); err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "whisper-1")
			relayMode = relayconstant.RelayModeAudioTranscription
		}
		c.Set("relay_mode", relayMode)
	}
	if strings.HasPrefix(c.Request.URL.Path, "/pg/") && c.Request.Method != http.MethodGet {
		// Playground submissions all use the same model/group envelope.
		req, err := getModelFromRequest(c)
		if err != nil {
			return nil, false, err
		}
		modelRequest.Model = req.Model
		modelRequest.Group = req.Group
		common.SetContextKey(c, constant.ContextKeyTokenGroup, modelRequest.Group)
	}

	if strings.HasPrefix(c.Request.URL.Path, "/v1/responses/compact") && modelRequest.Model != "" {
		modelRequest.Model = ratio_setting.WithCompactModelSuffix(modelRequest.Model)
	}
	return &modelRequest, shouldSelectChannel, nil
}

// 修复 #4834: GET /v1/video/generations/:task_id && /v1/video/:task_id 此前不解析 model，
// 当 token 启用「可用模型限制」时，下游 modelLimitEnable 校验会因
// modelRequest.Model 为空而误报 "This token has no access to model"。
// 从已存储的任务记录中回填 OriginModelName 即可让校验走在正确的模型上。
func getTaskOriginModelName(c *gin.Context) string {
	if !common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) &&
		!common.GetContextKeyBool(c, constant.ContextKeyTokenModelBlacklistEnabled) {
		return ""
	}

	taskId := c.Param("task_id")
	if taskId == "" {
		// jimeng adapter
		taskId = c.GetString("task_id")
	}
	if taskId == "" {
		return ""
	}

	userId := c.GetInt("id")
	if task, exist, err := model.GetByTaskId(userId, taskId); err == nil && exist && task != nil {
		return task.Properties.OriginModelName
	}
	return ""
}

func SetupContextForSelectedChannel(c *gin.Context, channel *model.Channel, modelName string) *types.NewAPIError {
	c.Set("original_model", modelName) // for retry
	if channel == nil {
		return types.NewError(errors.New("channel is nil"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelName, channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelType, channel.Type)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, channel.CreatedTime)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, channel.GetSetting())
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, channel.GetOtherSettings())
	paramOverride := channel.GetParamOverride()
	headerOverride := channel.GetHeaderOverride()
	if mergedParam, applied := service.ApplyChannelAffinityOverrideTemplate(c, paramOverride); applied {
		paramOverride = mergedParam
	}
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, paramOverride)
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, headerOverride)
	if nil != channel.OpenAIOrganization && *channel.OpenAIOrganization != "" {
		common.SetContextKey(c, constant.ContextKeyChannelOrganization, *channel.OpenAIOrganization)
	}
	common.SetContextKey(c, constant.ContextKeyChannelAutoBan, channel.GetAutoBan())
	common.SetContextKey(c, constant.ContextKeyChannelModelMapping, channel.GetModelMapping())
	common.SetContextKey(c, constant.ContextKeyChannelStatusCodeMapping, channel.GetStatusCodeMapping())
	c.Set(relaycommon.ChannelCodexFingerprintSeedContextKey, channel.CodexFingerprintSeed)

	key, index, newAPIError := channel.GetNextEnabledKey()
	if newAPIError != nil {
		return newAPIError
	}
	if channel.ChannelInfo.IsMultiKey {
		common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, true)
		common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, index)
	} else {
		// 必须设置为 false，否则在重试到单个 key 的时候会导致日志显示错误
		common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, false)
	}
	// c.Request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", key))
	common.SetContextKey(c, constant.ContextKeyChannelKey, key)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, channel.GetBaseURL())

	common.SetContextKey(c, constant.ContextKeySystemPromptOverride, false)

	// TODO: api_version统一
	switch channel.Type {
	case constant.ChannelTypeAzure:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeVertexAi:
		c.Set("region", channel.Other)
	case constant.ChannelTypeXunfei:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeGemini:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeAli:
		c.Set("plugin", channel.Other)
	case constant.ChannelCloudflare:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeMokaAI:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeCoze:
		c.Set("bot_id", channel.Other)
	}
	return nil
}

// extractModelNameFromGeminiPath 从 Gemini API URL 路径中提取模型名
// 输入格式: /v1beta/models/gemini-2.0-flash:generateContent
// 输出: gemini-2.0-flash
func extractModelNameFromGeminiPath(path string) string {
	// 查找 "/models/" 的位置
	modelsPrefix := "/models/"
	modelsIndex := strings.Index(path, modelsPrefix)
	if modelsIndex == -1 {
		return ""
	}

	// 从 "/models/" 之后开始提取
	startIndex := modelsIndex + len(modelsPrefix)
	if startIndex >= len(path) {
		return ""
	}

	// 查找 ":" 的位置，模型名在 ":" 之前
	colonIndex := strings.Index(path[startIndex:], ":")
	if colonIndex == -1 {
		// 如果没有找到 ":"，返回从 "/models/" 到路径结尾的部分
		return path[startIndex:]
	}

	// 返回模型名部分
	return path[startIndex : startIndex+colonIndex]
}
