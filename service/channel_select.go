package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/gin-gonic/gin"
)

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
	GetChannelConstraints(c).AddFilter(dto.ChannelFilter{
		Kind:                   dto.FilterTaskPluginIdentity,
		TaskPluginKey:          pluginKey,
		TaskPluginChannelTypes: pinnedTaskPluginChannelTypes(c, pluginKey),
	})
}

type RetryParam struct {
	Ctx          *gin.Context
	TokenGroup   string
	ModelName    string
	RequestPath  string
	Retry        *int
	resetNextTry bool
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

// CacheGetRandomSatisfiedChannel tries to get a random channel that satisfies the requirements.
// 尝试获取一个满足要求的随机渠道。
//
// For "auto" tokenGroup with cross-group Retry enabled:
// 对于启用了跨分组重试的 "auto" tokenGroup：
//
//   - Uses ContextKeyAutoGroupIndex to track the current group index, so each retry
//     resumes from the group the previous attempt selected.
//     使用 ContextKeyAutoGroupIndex 跟踪当前分组索引，每次重试从上一轮选中的分组继续。
//
//   - priorityRetry (当前分组内的优先级级别) is the current global retry count while
//     staying in one group. A group is abandoned (switch to next group) when
//     cross-group retry is on and priorityRetry >= common.RetryTimes.
//     priorityRetry 是停留在同一分组时的全局重试计数；当跨分组重试开启且
//     priorityRetry >= common.RetryTimes 时，该分组被放弃，切换到下一个分组。
//
//   - NOTE: with common.RetryTimes == 0 (option not configured), the condition above
//     is always true, so every group gets exactly one priority tier attempted before
//     switching. Cross-group traversal still works; lower priority tiers within a
//     group are only reached when RetryTimes is large enough.
//     注意：当 common.RetryTimes == 0（未配置该选项）时，上述条件恒为真，每个分组
//     只会被尝试一个优先级档位就切换。跨分组遍历仍正常；分组内更低的优先级档位
//     只有在 RetryTimes 足够大时才会被尝试。
//
//   - When GetRandomSatisfiedChannel returns nil (no channel for this model), moves
//     to next group in the same invocation, regardless of cross-group retry flag.
//     当 GetRandomSatisfiedChannel 返回 nil（该模型无可用渠道）时，跳过该分组，
//     在同一轮调用内继续尝试下一个分组。
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*model.Channel, string, error) {
	var channel *model.Channel
	var err error
	selectGroup := param.TokenGroup
	userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)
	filters := GetChannelConstraints(param.Ctx).Filters

	// 请求级 model 后缀覆盖（openLUX 兼容）：请求体 model 形如 "deepseek-chat@g2" 时
	// 强制路由到分组 g2。优先级最高，覆盖令牌级智能路由与指定分组。
	if forcedGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyModelGroupOverride); forcedGroup != "" {
		channel, err = model.GetRandomSatisfiedChannel(forcedGroup, param.ModelName, param.GetRetry(), filters)
		if err != nil {
			return nil, selectGroup, err
		}
		common.SysLog(fmt.Sprintf("smart routing: strategy=model_suffix_override model=%s userGroup=%s forcedGroup=%s", param.ModelName, userGroup, forcedGroup))
		common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, forcedGroup)
		return channel, forcedGroup, nil
	}

	// 智能路由：令牌设置了 RoutingPriority 时，忽略其指定分组，按策略在
	// 所有可用分组中选择最优渠道。跨分组重试强制开启，保证可切换分组。
	routingPriority := common.GetContextKeyString(param.Ctx, constant.ContextKeyTokenRoutingPriority)
	if routingPriority != "" {
		// 请求级覆盖：请求体 provider.sort 可临时切换智能路由策略（openLUX 兼容）。
		if override := getRequestRoutingOverride(param.Ctx); override != "" {
			routingPriority = override
		}
		smartGroups := GetSmartRoutingGroups(userGroup, param.ModelName, param.RequestPath, routingPriority)
		if len(smartGroups) == 0 {
			return nil, selectGroup, errors.New("smart routing: no usable group has channel for this model")
		}
		common.SysLog(fmt.Sprintf("smart routing: strategy=%s model=%s userGroup=%s smartGroups=%v", routingPriority, param.ModelName, userGroup, smartGroups))
		return selectFromOrderedGroups(param, smartGroups, true)
	}

	// 令牌级有序分组列表（openLUX group_ids 对齐）：按列表顺序逐组尝试，
	// 无渠道的分组自动跳到下一组。未设智能路由时优先生效，忽略单分组 group。
	if groupOrder, ok := common.GetContextKey(param.Ctx, constant.ContextKeyTokenGroupOrder); ok {
		if groups, ok := groupOrder.([]string); ok && len(groups) > 0 {
			filtered := FilterUserTokenAutoGroups(userGroup, groups)
			if len(filtered) > 0 {
				common.SysLog(fmt.Sprintf("smart routing: strategy=manual_group_order model=%s userGroup=%s groups=%v", param.ModelName, userGroup, filtered))
				return selectFromOrderedGroups(param, filtered, true)
			}
		}
	}

	if param.TokenGroup == "auto" {
		autoGroups := GetRequestAutoGroups(param.Ctx, userGroup)
		if len(autoGroups) == 0 {
			return nil, selectGroup, errors.New("auto groups is not enabled")
		}
		crossGroupRetry := common.GetContextKeyBool(param.Ctx, constant.ContextKeyTokenCrossGroupRetry)
		return selectFromOrderedGroups(param, autoGroups, crossGroupRetry)
	}

	channel, err = model.GetRandomSatisfiedChannel(param.TokenGroup, param.ModelName, param.GetRetry(), filters)
	if err != nil {
		return nil, param.TokenGroup, err
	}
	return channel, selectGroup, nil
}

func pinnedTaskPluginChannelTypes(c *gin.Context, expected string) []int {
	if c == nil || expected == "" {
		return nil
	}
	if value, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint); exists {
		pinned, ok := value.(jsplugin.PinnedEndpoint)
		if ok && pinned.Generation != nil && len(pinned.Candidates) > 1 {
			expectedFound := false
			channelTypes := make([]int, 0, len(pinned.Candidates))
			seen := make(map[int]struct{}, len(pinned.Candidates))
			for _, candidate := range pinned.Candidates {
				if candidate.Plugin == nil {
					continue
				}
				if candidate.Plugin.Meta.Key == expected {
					expectedFound = true
				}
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
				return channelTypes
			}
		}
	}
	value, exists := c.Get(jsplugin.ContextKeyPinnedPlugin)
	pinned, ok := value.(jsplugin.PinnedPlugin)
	if !exists || !ok || pinned.Generation == nil || pinned.Plugin == nil || pinned.Plugin.Meta.Key != expected {
		return nil
	}
	channelTypes := make([]int, 0, len(pinned.Plugin.Meta.ChannelTypes))
	for _, channelType := range pinned.Plugin.Meta.ChannelTypes {
		if channelType == 0 || channelType == constant.ChannelTypeTaskPlugin {
			continue
		}
		channelTypes = append(channelTypes, channelType)
	}
	if len(channelTypes) == 0 {
		return nil
	}
	return channelTypes
}

// selectFromOrderedGroups 按有序分组列表逐组选择渠道，每组用完全部优先级后
// 才切换到下一组，并维护跨分组重试所需的上下文状态。
// orderedGroups 可为：指定分组（AutoGroups 列表）或智能路由算出的最优分组序。
func selectFromOrderedGroups(param *RetryParam, orderedGroups []string, crossGroupRetry bool) (*model.Channel, string, error) {
	selectGroup := param.TokenGroup
	filters := GetChannelConstraints(param.Ctx).Filters

	// startGroupIndex: the group index to start searching from
	// startGroupIndex: 开始搜索的分组索引
	startGroupIndex := 0
	if lastGroupIndex, exists := common.GetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex); exists {
		if idx, ok := lastGroupIndex.(int); ok {
			startGroupIndex = idx
		}
	}

	for i := startGroupIndex; i < len(orderedGroups); i++ {
		autoGroup := orderedGroups[i]
		// Calculate priorityRetry for current group
		// 计算当前分组的 priorityRetry
		priorityRetry := param.GetRetry()
		// If moved to a new group, reset priorityRetry and update startRetryIndex
		// 如果切换到新分组，重置 priorityRetry 并更新 startRetryIndex
		if i > startGroupIndex {
			priorityRetry = 0
		}
		logger.LogDebug(param.Ctx, "Auto selecting group: %s, priorityRetry: %d", autoGroup, priorityRetry)

		channel, _ := model.GetRandomSatisfiedChannel(autoGroup, param.ModelName, priorityRetry, filters)
		if channel == nil {
			// Current group has no available channel for this model, try next group
			// 当前分组没有该模型的可用渠道，尝试下一个分组
			logger.LogDebug(param.Ctx, "No available channel in group %s for model %s at priorityRetry %d, trying next group", autoGroup, param.ModelName, priorityRetry)
			// 重置状态以尝试下一个分组
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
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
		return channel, selectGroup, nil
	}
	return nil, selectGroup, nil
}

// getRequestRoutingOverride 读取请求体里的 provider.sort，返回合法策略名或空串。
// openLUX 兼容：请求级覆盖令牌级智能路由策略。
func getRequestRoutingOverride(c *gin.Context) string {
	if !strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		return ""
	}
	var req struct {
		Provider *struct {
			Sort string `json:"sort"`
		} `json:"provider"`
	}
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return ""
	}
	if req.Provider == nil {
		return ""
	}
	s := strings.TrimSpace(req.Provider.Sort)
	if s == constant.RoutingPriorityAuto || s == constant.RoutingPriorityPrice ||
		s == constant.RoutingPrioritySpeed || s == constant.RoutingPrioritySuccessRate {
		return s
	}
	return ""
}
