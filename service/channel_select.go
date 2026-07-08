package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

type RetryParam struct {
	Ctx          *gin.Context
	TokenGroup   string
	ModelName    string
	Retry        *int
	resetNextTry bool
}

var ErrChannelConcurrencyLimit = errors.New("channel concurrency limit exceeded")

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

		concurrencyLimited := false
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

			selectedRetry := priorityRetry
			channel, selectedRetry, err = getRandomSatisfiedChannelWithConcurrency(param.Ctx, autoGroup, param.ModelName, priorityRetry)
			if err != nil {
				if errors.Is(err, ErrChannelConcurrencyLimit) {
					concurrencyLimited = true
					selectGroup = autoGroup
					logger.LogDebug(param.Ctx, "All channels in group %s for model %s reached concurrency limit at priorityRetry %d, trying next group", autoGroup, param.ModelName, priorityRetry)
					common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
					common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
					param.SetRetry(0)
					continue
				}
				return nil, autoGroup, err
			}
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
			param.SetRetry(selectedRetry)
			priorityRetry = selectedRetry
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
		if channel == nil && concurrencyLimited {
			return nil, selectGroup, ErrChannelConcurrencyLimit
		}
	} else {
		selectedRetry := param.GetRetry()
		channel, selectedRetry, err = getRandomSatisfiedChannelWithConcurrency(param.Ctx, param.TokenGroup, param.ModelName, param.GetRetry())
		if err != nil {
			return nil, param.TokenGroup, err
		}
		param.SetRetry(selectedRetry)
	}
	return channel, selectGroup, nil
}

func buildEndpointChannelFilter(c *gin.Context, modelName string) model.ChannelFilter {
	if requestedEndpointType(c) == "" {
		return nil
	}
	return func(channel *model.Channel) bool {
		return ChannelSupportsRequestEndpoint(c, channel, modelName)
	}
}

func ChannelSupportsRequestEndpoint(c *gin.Context, channel *model.Channel, modelName string) bool {
	endpointType := requestedEndpointType(c)
	if endpointType == "" {
		return true
	}
	return channelSupportsRequestedEndpoint(channel, modelName, endpointType)
}

func requestedEndpointType(c *gin.Context) constant.EndpointType {
	if c == nil || c.Request == nil || c.Request.URL == nil {
		return ""
	}
	path := c.Request.URL.Path
	if strings.HasPrefix(path, "/v1/responses/compact") {
		return constant.EndpointTypeOpenAIResponseCompact
	}
	if strings.HasPrefix(path, "/v1/responses") {
		return constant.EndpointTypeOpenAIResponse
	}
	// Non-Responses endpoint modes still rely on model/group abilities here. Do
	// not opt them into endpoint filtering until provider metadata is complete.
	return ""
}

func channelSupportsRequestedEndpoint(channel *model.Channel, modelName string, endpointType constant.EndpointType) bool {
	if channel == nil {
		return false
	}
	switch endpointType {
	case constant.EndpointTypeOpenAIResponse:
		return channelSupportsOpenAIResponses(channel.Type)
	case constant.EndpointTypeOpenAIResponseCompact:
		apiType, ok := common.ChannelType2APIType(channel.Type)
		return ok && (apiType == constant.APITypeOpenAI || apiType == constant.APITypeCodex)
	case constant.EndpointTypeAnthropic:
		if channel.Type == constant.ChannelTypeBlockRun {
			return true
		}
	}
	endpoints := common.GetEndpointTypesByChannelType(channel.Type, modelName)
	for _, endpoint := range endpoints {
		if endpoint == endpointType {
			return true
		}
	}
	return false
}

func channelSupportsOpenAIResponses(channelType int) bool {
	apiType, ok := common.ChannelType2APIType(channelType)
	if !ok {
		// Unknown legacy/OpenAI-compatible channel types fall back to the OpenAI
		// adaptor in relay and therefore do not fail local Responses conversion.
		return true
	}
	switch apiType {
	case constant.APITypeOpenAI,
		constant.APITypeAli,
		constant.APITypeCloudflare,
		constant.APITypeOpenRouter,
		constant.APITypeXinference,
		constant.APITypeXai,
		constant.APITypePerplexity,
		constant.APITypeVolcEngine,
		constant.APITypeCodex,
		constant.APITypeBlockRun:
		return true
	default:
		return false
	}
}

func getRandomSatisfiedChannelWithConcurrency(c *gin.Context, group string, modelName string, retry int) (*model.Channel, int, error) {
	sawCandidates := false
	var waitCandidate *model.Channel
	waitCandidateRetry := retry
	for priorityRetry := retry; ; priorityRetry++ {
		candidates, err := model.GetSatisfiedChannelCandidatesWithFilter(group, modelName, priorityRetry, buildEndpointChannelFilter(c, modelName))
		if err != nil {
			return nil, priorityRetry, err
		}
		if len(candidates) == 0 {
			if sawCandidates && waitCandidate != nil {
				ok, waitErr := AcquireChannelConcurrencyWithWaitForContext(c, waitCandidate)
				if waitErr != nil {
					if errors.Is(waitErr, ErrChannelConcurrencyLimit) {
						return nil, waitCandidateRetry, ErrChannelConcurrencyLimit
					}
					return nil, waitCandidateRetry, fmt.Errorf("wait for channel concurrency for channel #%d failed: %w", waitCandidate.Id, waitErr)
				}
				if ok {
					return waitCandidate, waitCandidateRetry, nil
				}
			}
			if sawCandidates {
				return nil, priorityRetry, ErrChannelConcurrencyLimit
			}
			return nil, priorityRetry, nil
		}
		sawCandidates = true

		orderedCandidates, err := orderChannelCandidatesByConcurrencyLoad(c, candidates)
		if err != nil {
			return nil, priorityRetry, err
		}
		for _, channel := range orderedCandidates {
			ok, err := AcquireChannelConcurrencyForContext(c, channel)
			if err != nil {
				return nil, priorityRetry, fmt.Errorf("acquire channel concurrency for channel #%d failed: %w", channel.Id, err)
			}
			if ok {
				return channel, priorityRetry, nil
			}
			if waitCandidate == nil {
				waitCandidate = channel
				waitCandidateRetry = priorityRetry
			}
		}
	}
}

type channelCandidateLoad struct {
	channel *model.Channel
	load    ChannelConcurrencyLoad
}

func orderChannelCandidatesByConcurrencyLoad(c *gin.Context, candidates []*model.Channel) ([]*model.Channel, error) {
	ctx := context.Background()
	if c != nil && c.Request != nil {
		ctx = c.Request.Context()
	}
	loads, err := GetChannelConcurrencyLoads(ctx, candidates)
	if err != nil {
		return nil, err
	}

	loadedCandidates := make([]channelCandidateLoad, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate == nil {
			continue
		}
		load := loads[candidate.Id]
		if load.CoolingDown {
			continue
		}
		loadedCandidates = append(loadedCandidates, channelCandidateLoad{
			channel: candidate,
			load:    load,
		})
	}
	sort.SliceStable(loadedCandidates, func(i, j int) bool {
		if loadedCandidates[i].load.LoadRate == loadedCandidates[j].load.LoadRate {
			return loadedCandidates[i].channel.GetPriority() > loadedCandidates[j].channel.GetPriority()
		}
		return loadedCandidates[i].load.LoadRate < loadedCandidates[j].load.LoadRate
	})

	ordered := make([]*model.Channel, 0, len(loadedCandidates))
	for i := 0; i < len(loadedCandidates); {
		j := i + 1
		for j < len(loadedCandidates) && loadedCandidates[j].load.LoadRate == loadedCandidates[i].load.LoadRate {
			j++
		}

		bucket := make([]*model.Channel, 0, j-i)
		for _, candidate := range loadedCandidates[i:j] {
			bucket = append(bucket, candidate.channel)
		}
		for len(bucket) > 0 {
			channel, err := model.SelectWeightedRandomChannel(bucket)
			if err != nil {
				return nil, err
			}
			if channel == nil {
				break
			}
			ordered = append(ordered, channel)
			bucket = removeChannelCandidate(bucket, channel.Id)
		}
		i = j
	}
	return ordered, nil
}

func removeChannelCandidate(candidates []*model.Channel, channelID int) []*model.Channel {
	for i, candidate := range candidates {
		if candidate != nil && candidate.Id == channelID {
			return append(candidates[:i], candidates[i+1:]...)
		}
	}
	return candidates
}
