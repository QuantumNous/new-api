package service

import (
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	host "github.com/QuantumNous/new-api/pkg/smartrouterhost"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

const MaxAdaptiveChannelAttempts = 5

func GetChannelConstraints(c *gin.Context) *dto.ChannelConstraints {
	if c == nil {
		return &dto.ChannelConstraints{}
	}
	if existing, ok := common.GetContextKeyType[*dto.ChannelConstraints](c, constant.ContextKeyChannelConstraints); ok && existing != nil {
		return existing
	}
	constraints := &dto.ChannelConstraints{}
	common.SetContextKey(c, constant.ContextKeyChannelConstraints, constraints)
	return constraints
}

func AppendTaskPluginIdentityFilter(c *gin.Context, pluginKey string) {
	if c == nil {
		return
	}
	channelTypes, pluginKeys := pinnedTaskPluginIdentities(c, pluginKey)
	GetChannelConstraints(c).AddFilter(dto.ChannelFilter{
		Kind:                   dto.FilterTaskPluginIdentity,
		TaskPluginKey:          pluginKey,
		TaskPluginChannelTypes: channelTypes,
		TaskPluginKeys:         pluginKeys,
	})
}

type RetryParam struct {
	Ctx                 *gin.Context
	TokenGroup          string
	ModelName           string
	RequestPath         string
	Retry               *int
	PriorityPath        []int64
	AttemptedChannelIDs []int
	AttemptedSourceIDs  []int64
	resetNextTry        bool
}

func (p *RetryParam) GetRetry() int {
	if p.Retry == nil {
		return 0
	}
	return *p.Retry
}

func (p *RetryParam) SetRetry(retry int) {
	p.Retry = &retry
}

func (p *RetryParam) IncreaseRetry() {
	if p.resetNextTry {
		p.resetNextTry = false
		return
	}
	if p.Retry == nil {
		p.Retry = new(int)
	}
	*p.Retry++
}

func (p *RetryParam) ResetRetryNextTry() {
	p.resetNextTry = true
}

// AdaptiveRetryTimes visits every priority and, for managed routes, gives
// distinct upstream sources at the same priority one attempt each.
func AdaptiveRetryTimes(param *RetryParam) int {
	retries, _ := adaptiveRetryTimes(param)
	return retries
}

func adaptiveRetryTimes(param *RetryParam) (int, bool) {
	if param == nil {
		return 0, false
	}
	if param.TokenGroup == "auto" {
		return min(common.RetryTimes, MaxAdaptiveChannelAttempts-1), false
	}
	filters := GetChannelConstraints(param.Ctx).Filters
	priorities, err := model.ListSatisfiedChannelPriorities(
		param.TokenGroup,
		param.ModelName,
		filters,
	)
	if err != nil || len(priorities) == 0 {
		return 0, false
	}
	if param.Ctx != nil {
		if _, exists := param.Ctx.Get("channel_priority"); exists {
			initialPriority := param.Ctx.GetInt64("channel_priority")
			for index, priority := range priorities {
				if priority == initialPriority {
					priorities = priorities[index:]
					break
				}
			}
		}
	}
	priorityPath, managed := expandManagedPriorityPath(param, priorities, filters)
	param.PriorityPath = priorityPath
	return min(len(param.PriorityPath)-1, MaxAdaptiveChannelAttempts-1), managed
}

// ManagedAdaptiveRetryTimes enables adaptive retries only when the eligible
// candidate set contains an attached managed route.
func ManagedAdaptiveRetryTimes(param *RetryParam, attemptLimit int) (int, bool) {
	if param == nil || param.TokenGroup == "auto" {
		return 0, false
	}
	retries, managed := adaptiveRetryTimes(param)
	if !managed {
		return 0, false
	}
	if attemptLimit > 0 {
		retries = min(retries, attemptLimit-1)
	}
	return retries, true
}

func expandManagedPriorityPath(param *RetryParam, priorities []int64, filters []dto.ChannelFilter) ([]int64, bool) {
	path := make([]int64, 0, MaxAdaptiveChannelAttempts)
	hasManagedRoute := false
	for _, priority := range priorities {
		attempts := 1
		channelIDs, err := model.ListSatisfiedChannelIDsAtPriority(
			param.TokenGroup,
			param.ModelName,
			priority,
			filters,
		)
		if err == nil {
			sources := make(map[int64]struct{})
			for _, channelID := range channelIDs {
				route, managed := managedRouteForChannel(channelID)
				if managed {
					hasManagedRoute = true
					sources[route.SourceID] = struct{}{}
				}
			}
			if len(sources) > attempts {
				attempts = len(sources)
			}
		}
		for range attempts {
			path = append(path, priority)
			if len(path) == MaxAdaptiveChannelAttempts {
				return path, hasManagedRoute
			}
		}
	}
	return path, hasManagedRoute
}

// CacheGetRandomSatisfiedChannel tries to get a random channel that satisfies the requirements.
// 尝试获取一个满足要求的随机渠道。
//
// For "auto" tokenGroup with cross-group Retry enabled:
// 对于启用了跨分组重试的 "auto" tokenGroup：
//
//   - Each group will exhaust all its priorities before moving to the next group.
//     每个分组会用完所有优先级后才会切换到下一个分组。
//
//   - Uses ContextKeyAutoGroupIndex to track current group index.
//     使用 ContextKeyAutoGroupIndex 跟踪当前分组索引。
//
//   - Uses ContextKeyAutoGroupRetryIndex to track the global Retry count when current group started.
//     使用 ContextKeyAutoGroupRetryIndex 跟踪当前分组开始时的全局重试次数。
//
//   - priorityRetry = Retry - startRetryIndex, represents the priority level within current group.
//     priorityRetry = Retry - startRetryIndex，表示当前分组内的优先级级别。
//
//   - When GetRandomSatisfiedChannel returns nil (priorities exhausted), moves to next group.
//     当 GetRandomSatisfiedChannel 返回 nil（优先级用完）时，切换到下一个分组。
//
// Example flow (2 groups, each with 2 priorities, RetryTimes=3):
// 示例流程（2个分组，每个有2个优先级，RetryTimes=3）：
//
//	Retry=0: GroupA, priority0 (startRetryIndex=0, priorityRetry=0)
//	         分组A, 优先级0
//
//	Retry=1: GroupA, priority1 (startRetryIndex=0, priorityRetry=1)
//	         分组A, 优先级1
//
//	Retry=2: GroupA exhausted → GroupB, priority0 (startRetryIndex=2, priorityRetry=0)
//	         分组A用完 → 分组B, 优先级0
//
//	Retry=3: GroupB, priority1 (startRetryIndex=2, priorityRetry=1)
//	         分组B, 优先级1
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*model.Channel, string, error) {
	if channel, group, handled, err := SelectSmartRouterChannel(param); handled {
		return channel, group, err
	}
	var channel *model.Channel
	var err error
	selectGroup := param.TokenGroup
	userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)
	filters := GetChannelConstraints(param.Ctx).Filters

	if param.TokenGroup == "auto" {
		autoGroups := GetRequestAutoGroups(param.Ctx, userGroup)
		if len(autoGroups) == 0 {
			return nil, selectGroup, errors.New("auto groups is not enabled")
		}

		// startGroupIndex: the group index to start searching from
		// startGroupIndex: 开始搜索的分组索引
		startGroupIndex := 0
		crossGroupRetry := common.GetContextKeyBool(param.Ctx, constant.ContextKeyTokenCrossGroupRetry)

		if lastGroupIndex, exists := common.GetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex); exists {
			if idx, ok := lastGroupIndex.(int); ok {
				startGroupIndex = idx
			}
		}

		for i := startGroupIndex; i < len(autoGroups); i++ {
			autoGroup := autoGroups[i]
			// Calculate priorityRetry for current group
			// 计算当前分组的 priorityRetry
			priorityRetry := param.GetRetry()
			// If moved to a new group, reset priorityRetry and update startRetryIndex
			// 如果切换到新分组，重置 priorityRetry 并更新 startRetryIndex
			if i > startGroupIndex {
				priorityRetry = 0
			}
			logger.LogDebug(param.Ctx, "Auto selecting group: %s, priorityRetry: %d", autoGroup, priorityRetry)

			channel, _ = model.GetRandomSatisfiedChannel(
				autoGroup,
				param.ModelName,
				priorityRetry,
				filters,
			)
			if channel == nil {
				// Current group has no available channel for this model, try next group
				// 当前分组没有该模型的可用渠道，尝试下一个分组
				logger.LogDebug(param.Ctx, "No available channel in group %s for model %s at priorityRetry %d, trying next group", autoGroup, param.ModelName, priorityRetry)
				// 重置状态以尝试下一个分组
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
				// Reset retry counter so outer loop can continue for next group
				// 重置重试计数器，以便外层循环可以为下一个分组继续
				param.SetRetry(0)
				continue
			}
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, autoGroup)
			selectGroup = autoGroup
			logger.LogDebug(param.Ctx, "Auto selected group: %s", autoGroup)

			// Prepare state for next retry
			// 为下一次重试准备状态
			if crossGroupRetry && priorityRetry >= common.RetryTimes {
				// Current group has exhausted all retries, prepare to switch to next group
				// This request still uses current group, but next retry will use next group
				// 当前分组已用完所有重试次数，准备切换到下一个分组
				// 本次请求仍使用当前分组，但下次重试将使用下一个分组
				logger.LogDebug(param.Ctx, "Current group %s retries exhausted (priorityRetry=%d >= RetryTimes=%d), preparing switch to next group for next retry", autoGroup, priorityRetry, common.RetryTimes)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
				// Reset retry counter so outer loop can continue for next group
				// 重置重试计数器，以便外层循环可以为下一个分组继续
				param.SetRetry(0)
				param.ResetRetryNextTry()
			} else {
				// Stay in current group, save current state
				// 保持在当前分组，保存当前状态
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i)
			}
			break
		}
	} else if len(param.PriorityPath) > 0 {
		if param.GetRetry() >= len(param.PriorityPath) {
			return nil, param.TokenGroup, nil
		}
		channel, err = selectDiverseChannelAtPriority(
			param,
			param.TokenGroup,
			param.PriorityPath[param.GetRetry()],
			filters,
		)
		if err != nil {
			return nil, param.TokenGroup, err
		}
	} else {
		priorities, priorityErr := model.ListSatisfiedChannelPriorities(
			param.TokenGroup, param.ModelName, filters,
		)
		if priorityErr != nil {
			return nil, param.TokenGroup, priorityErr
		}
		if len(priorities) == 0 {
			return nil, param.TokenGroup, nil
		}
		priorityIndex := min(param.GetRetry(), len(priorities)-1)
		channel, err = model.GetRandomSatisfiedChannelAtPriority(
			param.TokenGroup,
			param.ModelName,
			priorities[priorityIndex],
			filters,
		)
		if err != nil {
			return nil, param.TokenGroup, err
		}
	}
	RecordRetryAttempt(param, channel)
	return channel, selectGroup, nil
}

func selectDiverseChannelAtPriority(
	param *RetryParam,
	group string,
	priority int64,
	filters []dto.ChannelFilter,
) (*model.Channel, error) {
	preferredExcluded := retryExcludedChannelIDs(param, true)
	channel, err := model.GetRandomSatisfiedChannelAtPriority(
		group,
		param.ModelName,
		priority,
		withExcludedChannelIDs(filters, preferredExcluded),
	)
	if err != nil || channel != nil || len(param.AttemptedSourceIDs) == 0 {
		return channel, err
	}
	return model.GetRandomSatisfiedChannelAtPriority(
		group,
		param.ModelName,
		priority,
		withExcludedChannelIDs(filters, param.AttemptedChannelIDs),
	)
}

func retryExcludedChannelIDs(param *RetryParam, includeSources bool) []int {
	if param == nil {
		return nil
	}
	excluded := append([]int(nil), param.AttemptedChannelIDs...)
	if !includeSources || len(param.AttemptedSourceIDs) == 0 {
		return excluded
	}
	var routes []model.UpstreamManagedRoute
	if err := model.DB.Where("source_id IN ? AND detached = ?", param.AttemptedSourceIDs, false).
		Find(&routes).Error; err != nil {
		return excluded
	}
	seen := make(map[int]struct{}, len(excluded)+len(routes))
	for _, channelID := range excluded {
		seen[channelID] = struct{}{}
	}
	for _, route := range routes {
		if _, exists := seen[route.ChannelID]; exists {
			continue
		}
		seen[route.ChannelID] = struct{}{}
		excluded = append(excluded, route.ChannelID)
	}
	return excluded
}

func withExcludedChannelIDs(filters []dto.ChannelFilter, channelIDs []int) []dto.ChannelFilter {
	if len(channelIDs) == 0 {
		return filters
	}
	result := append([]dto.ChannelFilter(nil), filters...)
	result = append(result, dto.ChannelFilter{
		Kind:               dto.FilterExcludeChannelIDs,
		ExcludedChannelIDs: append([]int(nil), channelIDs...),
	})
	return result
}

// RecordRetryAttempt tracks channels and managed sources already used by a request.
func RecordRetryAttempt(param *RetryParam, channel *model.Channel) {
	if param == nil || channel == nil {
		return
	}
	if !slices.Contains(param.AttemptedChannelIDs, channel.Id) {
		param.AttemptedChannelIDs = append(param.AttemptedChannelIDs, channel.Id)
	}
	route, managed := managedRouteForChannel(channel.Id)
	if !managed {
		return
	}
	if !slices.Contains(param.AttemptedSourceIDs, route.SourceID) {
		param.AttemptedSourceIDs = append(param.AttemptedSourceIDs, route.SourceID)
	}
}

func managedRouteForChannel(channelID int) (*model.UpstreamManagedRoute, bool) {
	if model.DB == nil {
		return nil, false
	}
	var routes []model.UpstreamManagedRoute
	if err := model.DB.Where("channel_id = ? AND detached = ?", channelID, false).
		Limit(1).
		Find(&routes).Error; err != nil || len(routes) == 0 {
		return nil, false
	}
	return &routes[0], true
}

func pinnedTaskPluginIdentities(c *gin.Context, expected string) ([]int, []string) {
	if c == nil || expected == "" {
		return nil, nil
	}
	if value, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint); exists {
		pinned, ok := value.(jsplugin.PinnedEndpoint)
		if ok && pinned.Generation != nil && len(pinned.Candidates) > 1 {
			expectedFound := false
			channelTypes := make([]int, 0, len(pinned.Candidates))
			pluginKeys := make([]string, 0, len(pinned.Candidates))
			seen := make(map[int]struct{}, len(pinned.Candidates))
			for _, candidate := range pinned.Candidates {
				if candidate.Plugin == nil {
					continue
				}
				if candidate.Plugin.Meta.Key == expected {
					expectedFound = true
				}
				pluginKeys = append(pluginKeys, candidate.Plugin.Meta.Key)
				for _, channelType := range candidate.Plugin.Meta.ChannelTypes {
					if channelType == 0 || channelType == constant.ChannelTypeTaskPlugin {
						continue
					}
					if _, duplicate := seen[channelType]; duplicate {
						continue
					}
					if plugin, indexed := pinned.Generation.GetByChannelType(channelType); indexed && plugin == candidate.Plugin {
						seen[channelType] = struct{}{}
						channelTypes = append(channelTypes, channelType)
					}
				}
			}
			if expectedFound {
				return channelTypes, pluginKeys
			}
		}
	}
	value, exists := c.Get(jsplugin.ContextKeyPinnedPlugin)
	pinned, ok := value.(jsplugin.PinnedPlugin)
	if !exists || !ok || pinned.Generation == nil || pinned.Plugin == nil || pinned.Plugin.Meta.Key != expected {
		return nil, nil
	}
	channelTypes := make([]int, 0, len(pinned.Plugin.Meta.ChannelTypes))
	for _, channelType := range pinned.Plugin.Meta.ChannelTypes {
		if channelType == 0 || channelType == constant.ChannelTypeTaskPlugin {
			continue
		}
		channelTypes = append(channelTypes, channelType)
	}
	return channelTypes, []string{expected}
}

// ChannelSelectError explains why SelectChannelForRequest found no channel.
// Callers render it for their transport: the HTTP distributor localizes
// MessageID with its own helpers and the Responses WebSocket relay wraps it in
// a NewAPIError. Message is set instead of MessageID when the text is a fixed
// error code that clients match on.
type ChannelSelectError struct {
	StatusCode int
	Code       types.ErrorCode
	MessageID  string
	Params     map[string]any
	Message    string
	// FilterKind and Channel identify a candidate rejected by request filters.
	FilterKind dto.ChannelFilterKind
	Channel    *model.Channel
	// NoAvailableChannel marks the "no channel for this group and model"
	// outcome so the distributor can name the claiming task plugin.
	NoAvailableChannel bool
}

// SelectChannelForRequest resolves the channel for one attempt with the rules
// shared by the HTTP distributor and the Responses WebSocket relay: a pinned
// channel wins, then session affinity (first attempt only), then a random
// eligible channel; every candidate must satisfy the request's channel
// filters. The group the channel was chosen from is returned for auto-group
// callers. The caller still applies SetupContextForSelectedChannel.
func SelectChannelForRequest(c *gin.Context, modelName string, retry *RetryParam) (*model.Channel, string, *ChannelSelectError) {
	constraints := GetChannelConstraints(c)
	if smartRouter.Load() != nil && smartRouterProtocol(c, retry.TokenGroup) == "" {
		host.Exclude(c)
	}
	if pin, found, overridden := constraints.ResolvedPin(); found {
		for _, lost := range overridden {
			logger.LogWarn(c, fmt.Sprintf(
				"channel pin overridden: winning_source=%s winning_channel_id=%d overridden_source=%s overridden_channel_id=%d",
				pin.Source, pin.ChannelId, lost.Source, lost.ChannelId,
			))
		}
		channel, err := model.CacheGetChannel(pin.ChannelId)
		if err != nil {
			return nil, "", pinnedChannelUnavailable(pin, http.StatusBadRequest, i18n.MsgDistributorInvalidChannelId)
		}
		if channel.Status != common.ChannelStatusEnabled {
			return nil, "", pinnedChannelUnavailable(pin, http.StatusForbidden, i18n.MsgDistributorChannelDisabled)
		}
		if ok, kind := model.ChannelSatisfiesFilters(channel, modelName, constraints.Filters); !ok {
			return nil, "", &ChannelSelectError{
				StatusCode: http.StatusBadRequest, Code: types.ErrorCode(kind), MessageID: i18n.MsgDistributorNoAvailableChannel,
				Params:     map[string]any{"Group": common.GetContextKeyString(c, constant.ContextKeyUsingGroup), "Model": modelName},
				FilterKind: kind, Channel: channel,
			}
		}
		return channel, "", nil
	}

	usingGroup := retry.TokenGroup
	var channel *model.Channel
	var selectGroup string
	if retry.GetRetry() == 0 {
		if preferredChannelID, found := GetPreferredChannelByAffinity(c, modelName, usingGroup); found {
			affinityUsable := false
			preferred, err := model.CacheGetChannel(preferredChannelID)
			affinitySatisfied := false
			if err == nil && preferred != nil && preferred.Status == common.ChannelStatusEnabled {
				affinitySatisfied, _ = model.ChannelSatisfiesFilters(preferred, modelName, constraints.Filters)
			}
			if affinitySatisfied {
				if usingGroup == "auto" {
					userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
					for _, g := range GetRequestAutoGroups(c, userGroup) {
						if model.IsChannelEnabledForGroupModel(g, modelName, preferred.Id) {
							selectGroup = g
							common.SetContextKey(c, constant.ContextKeyAutoGroup, g)
							channel = preferred
							affinityUsable = true
							MarkChannelAffinityUsed(c, g, preferred.Id)
							break
						}
					}
				} else if model.IsChannelEnabledForGroupModel(usingGroup, modelName, preferred.Id) {
					channel = preferred
					selectGroup = usingGroup
					affinityUsable = true
					MarkChannelAffinityUsed(c, usingGroup, preferred.Id)
				}
			}
			if !affinityUsable && !ShouldKeepChannelAffinityOnChannelDisabled() {
				ClearCurrentChannelAffinityCache(c)
			}
			if !affinityUsable && RequestPolicy(c).SessionMode == "strict" {
				return nil, "", &ChannelSelectError{StatusCode: http.StatusServiceUnavailable, Message: "strict_session_binding_unavailable"}
			}
			if affinityUsable && smartRouter.Load() != nil {
				host.Exclude(c)
			}
		}
	}

	if channel == nil {
		var err error
		channel, selectGroup, err = CacheGetRandomSatisfiedChannel(retry)
		if err != nil {
			showGroup := usingGroup
			if usingGroup == "auto" {
				showGroup = fmt.Sprintf("auto(%s)", selectGroup)
			}
			return nil, selectGroup, &ChannelSelectError{
				StatusCode: http.StatusServiceUnavailable, Code: types.ErrorCodeModelNotFound, MessageID: i18n.MsgDistributorGetChannelFailed,
				Params: map[string]any{"Group": showGroup, "Model": modelName, "Error": err.Error()},
			}
		}
		if channel == nil {
			return nil, selectGroup, &ChannelSelectError{
				StatusCode: http.StatusServiceUnavailable, Code: types.ErrorCodeModelNotFound, MessageID: i18n.MsgDistributorNoAvailableChannel,
				Params: map[string]any{"Group": usingGroup, "Model": modelName}, NoAvailableChannel: true,
			}
		}
	}
	if ok, kind := model.ChannelSatisfiesFilters(channel, modelName, constraints.Filters); !ok {
		return nil, selectGroup, &ChannelSelectError{
			StatusCode: http.StatusServiceUnavailable, Code: types.ErrorCodeModelNotFound, MessageID: i18n.MsgDistributorNoAvailableChannel,
			Params:     map[string]any{"Group": common.GetContextKeyString(c, constant.ContextKeyUsingGroup), "Model": modelName},
			FilterKind: kind, Channel: channel, NoAvailableChannel: true,
		}
	}
	RecordRetryAttempt(retry, channel)
	return channel, selectGroup, nil
}

// Origin-task pins report a fixed code so task polling can tell a retired
// channel from a malformed request.
func pinnedChannelUnavailable(pin dto.ChannelPin, statusCode int, messageID string) *ChannelSelectError {
	if pin.Source == dto.PinSourceOriginTask {
		return &ChannelSelectError{StatusCode: http.StatusBadRequest, Code: "origin_task_channel_disabled", Message: "origin_task_channel_disabled"}
	}
	return &ChannelSelectError{StatusCode: statusCode, MessageID: messageID}
}

// AppendUsedChannel records an attempted channel in the request's channel
// trail, which the retry log and the consume log's admin_info both read.
func AppendUsedChannel(c *gin.Context, channelID int) {
	c.Set("use_channel", append(c.GetStringSlice("use_channel"), fmt.Sprintf("%d", channelID)))
}
