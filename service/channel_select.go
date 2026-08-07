package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type RetryParam struct {
	Ctx         *gin.Context
	TokenGroup  string
	ModelName   string
	RequestPath string
	Retry       *int
	// ExcludeChannels holds channel IDs already tried (and exhausted) in this
	// request. They are removed from the candidate pool on retry so selection
	// moves to a fresh channel instead of re-hitting a channel that just failed.
	// A multi-key channel is only added here once all its keys have been tried
	// (see the relay loop), so per-request key rotation is preserved. Nil on the
	// first attempt.
	ExcludeChannels map[int]bool
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
	if p.Retry == nil {
		p.Retry = new(int)
	}
	*p.Retry++
}

// CacheGetRandomSatisfiedChannel returns a channel that satisfies the request,
// honouring param.ExcludeChannels so retries never re-pick an already-exhausted
// channel.
// 返回一个满足请求的渠道，遵守 param.ExcludeChannels，使重试不会重新选中已耗尽的渠道。
//
// For the "auto" tokenGroup, selection is purely exclude-driven:
// 对于 "auto" tokenGroup，渠道选择完全由 exclude 驱动：
//
//   - Within a group, GetRandomSatisfiedChannel walks priority tiers high→low and
//     skips excluded channels, so every channel in the group is tried before the
//     group is considered exhausted.
//     组内 GetRandomSatisfiedChannel 从高到低遍历优先级并跳过已排除渠道，
//     因此在判定组耗尽前，组内每个渠道都会被尝试。
//
//   - A group with no channels for this model at all is a "discovery" miss and is
//     always skipped, regardless of the cross-group-retry switch.
//     完全没有该模型渠道的组属于"发现"未命中，无条件跳过，与跨组重试开关无关。
//
//   - A group that *had* channels but has them all excluded this request is a
//     "failover" case: it advances to the next group only when cross-group retry
//     is enabled; otherwise selection stops within the current group.
//     曾有渠道但本请求已全部排除的组属于"故障转移"：仅当启用跨组重试时才前进到
//     下一组，否则在当前组内停止。
//
// ContextKeyAutoGroupIndex records the group to resume from on the next retry.
// ContextKeyAutoGroupIndex 记录下次重试从哪个组恢复。
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*model.Channel, string, error) {
	var channel *model.Channel
	var err error
	selectGroup := param.TokenGroup
	userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)

	if param.TokenGroup == "auto" {
		autoGroups := GetRequestAutoGroups(param.Ctx, userGroup)
		if len(autoGroups) == 0 {
			return nil, selectGroup, errors.New("auto groups is not enabled")
		}

		startGroupIndex := 0
		crossGroupRetry := common.GetContextKeyBool(param.Ctx, constant.ContextKeyTokenCrossGroupRetry)

		if lastGroupIndex, exists := common.GetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex); exists {
			if idx, ok := lastGroupIndex.(int); ok {
				startGroupIndex = idx
			}
		}

		for i := startGroupIndex; i < len(autoGroups); i++ {
			autoGroup := autoGroups[i]

			channel, _ = model.GetRandomSatisfiedChannel(autoGroup, param.ModelName, param.RequestPath, param.ExcludeChannels)
			if channel != nil {
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, autoGroup)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i)
				selectGroup = autoGroup
				logger.LogDebug(param.Ctx, "Auto selected group: %s", autoGroup)
				break
			}

			// No channel returned. Distinguish "this group never had a channel for
			// the model" (discovery miss — always skip to next group) from "the
			// group had channels but they are all excluded this request" (failover
			// — only advance across groups when cross-group retry is enabled).
			// 未返回渠道。区分"该组本就没有此模型的渠道"（发现未命中——总是跳到下一组）
			// 与"该组有渠道但本请求已全部排除"（故障转移——仅在启用跨组重试时才跨组前进）。
			hadChannels := model.CountAvailableChannels(autoGroup, param.ModelName, param.RequestPath) > 0
			if hadChannels && !crossGroupRetry {
				logger.LogDebug(param.Ctx, "Group %s exhausted for model %s and cross-group retry disabled, stopping", autoGroup, param.ModelName)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i)
				break
			}
			logger.LogDebug(param.Ctx, "No available channel in group %s for model %s, trying next group", autoGroup, param.ModelName)
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
		}
	} else {
		channel, err = model.GetRandomSatisfiedChannel(param.TokenGroup, param.ModelName, param.RequestPath, param.ExcludeChannels)
		if err != nil {
			return nil, param.TokenGroup, err
		}
	}
	return channel, selectGroup, nil
}
