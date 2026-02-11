package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

// RetryParam contains parameters for channel retry logic.
// It tracks retry attempts, used channels, and priority indices.
type RetryParam struct {
	Ctx                  *gin.Context
	TokenGroup           string
	ModelName            string
	Retry                *int
	resetNextTry         bool
	UsedChannelIds       map[int]struct{} // 已使用的渠道ID集合
	CurrentPriorityIndex int              // 当前使用的优先级索引
}

// GetRetry returns the current retry count.
// Returns 0 if retry counter is not initialized.
func (p *RetryParam) GetRetry() int {
	if p.Retry == nil {
		return 0
	}
	return *p.Retry
}

// SetRetry sets the retry count to the specified value.
func (p *RetryParam) SetRetry(retry int) {
	p.Retry = &retry
}

// IncreaseRetry increments the retry counter by 1.
// If resetNextTry flag is set, it clears the flag instead of incrementing.
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

// ResetRetryNextTry sets a flag to reset the retry counter on the next IncreaseRetry call.
func (p *RetryParam) ResetRetryNextTry() {
	p.resetNextTry = true
}

// AddUsedChannel adds a channel ID to the set of used channels.
// This is used to avoid retrying the same channel when "avoid used channels" is enabled.
// 添加已使用的渠道ID
func (p *RetryParam) AddUsedChannel(channelId int) {
	if p.UsedChannelIds == nil {
		p.UsedChannelIds = make(map[int]struct{})
	}
	p.UsedChannelIds[channelId] = struct{}{}
}

// IsChannelUsed checks if a channel ID has been used before.
// Returns true if the channel is in the used channels set.
// 检查渠道是否已被使用
func (p *RetryParam) IsChannelUsed(channelId int) bool {
	if p.UsedChannelIds == nil {
		return false
	}
	_, used := p.UsedChannelIds[channelId]
	return used
}

// IncreasePriorityIndex increments the priority index to move to the next priority level.
// This is used in sequential retry mode.
// 增加优先级索引（切换到下一个优先级）
func (p *RetryParam) IncreasePriorityIndex() {
	p.CurrentPriorityIndex++
}

// GetPriorityIndex returns the current priority index.
// This is used in sequential retry mode to track which priority level to use.
// 获取当前优先级索引
func (p *RetryParam) GetPriorityIndex() int {
	return p.CurrentPriorityIndex
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
	var channel *model.Channel
	var err error
	selectGroup := param.TokenGroup
	userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)

	if param.TokenGroup == "auto" {
		if len(setting.GetAutoGroups()) == 0 {
			return nil, selectGroup, errors.New("auto groups is not enabled")
		}
		autoGroups := GetUserAutoGroup(userGroup)

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

			channel, _ = model.GetRandomSatisfiedChannel(autoGroup, param.ModelName, priorityRetry, param.UsedChannelIds)
			if channel == nil {
				// When channel is nil, it could mean:
				// 1. Current group has no channels for this model at all
				// 2. Current priority's channels are all excluded
				// 当 channel 为 nil 时，可能意味着：
				// 1. 当前分组完全没有该模型的渠道
				// 2. 当前优先级的渠道都被排除了

				// If we haven't exhausted all priorities in current group, return nil
				// to let outer loop retry with next priority in the same group
				// 如果当前分组的优先级还没用完，返回 nil 让外层循环在同一分组内尝试下一个优先级
				if priorityRetry < common.RetryTimes {
					logger.LogDebug(param.Ctx, "No available channel in group %s for model %s at priorityRetry %d, will retry with next priority", autoGroup, param.ModelName, priorityRetry)
					// Stay in current group for next retry
					// 保持在当前分组，等待下次重试
					common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i)
					return nil, selectGroup, nil
				}

				// All priorities exhausted in current group, try next group
				// 当前分组的所有优先级都用完了，尝试下一个分组
				logger.LogDebug(param.Ctx, "All priorities exhausted in group %s for model %s, trying next group", autoGroup, param.ModelName)
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
	} else {
		// 在 round-robin 模式下，使用 retry 参数（会在 GetRandomSatisfiedChannel 中进行模运算）
		// 在 sequential 模式下，使用 priorityIndex（只有当前优先级用尽时才会增加）
		// In round-robin mode, use retry parameter (modulo operation in GetRandomSatisfiedChannel)
		// In sequential mode, use priorityIndex (only increases when current priority is exhausted)
		retryOrPriority := param.GetPriorityIndex()
		if common.RetryPriorityMode == "round-robin" {
			retryOrPriority = param.GetRetry()
		}
		channel, err = model.GetRandomSatisfiedChannel(param.TokenGroup, param.ModelName, retryOrPriority, param.UsedChannelIds)
		if err != nil {
			return nil, param.TokenGroup, err
		}
		// 如果 channel 为 nil 但没有错误，说明该优先级的所有渠道都被排除了
		// 返回 nil 以便外层循环继续尝试下一个优先级
		// If channel is nil but no error, it means all channels at this priority have been excluded
		// Return nil to allow outer loop to try next priority
	}
	return channel, selectGroup, nil
}
