package service

import (
	"errors"
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
// Supports three modes for TokenGroup:
// 支持三种 TokenGroup 模式：
//
//  1. Single group (e.g. "vip") — uses that group only
//     单一分组 — 仅使用该分组
//
//  2. "auto" — uses globally configured auto_groups
//     "auto" — 使用全局配置的自动分组
//
//  3. Comma-separated list (e.g. "cheap,premium,fallback") — custom fallback order
//     逗号分隔列表 — 自定义 fallback 顺序，按列表顺序依次尝试
//
// For auto and custom-fallback modes with cross-group Retry:
// 对于 auto 和自定义 fallback 模式的跨分组重试：
//
//   - Each group will exhaust all its priorities before moving to the next group.
//     每个分组会用完所有优先级后才会切换到下一个分组。
//
//   - Uses ContextKeyAutoGroupIndex to track current group index.
//     使用 ContextKeyAutoGroupIndex 跟踪当前分组索引。
//
// Example flow (custom fallback "cheap,premium", each with 2 priorities, RetryTimes=3):
// 示例流程（自定义 fallback "cheap,premium"，每个有 2 个优先级，RetryTimes=3）：
//
//	Retry=0: cheap, priority0
//	Retry=1: cheap, priority1
//	Retry=2: cheap exhausted → premium, priority0
//	Retry=3: premium, priority1
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*model.Channel, string, error) {
	var channel *model.Channel
	var err error
	selectGroup := param.TokenGroup
	userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)

	// 判断是否为多分组模式（auto 或逗号分隔的自定义 fallback 列表）
	var groups []string
	customFallback := false
	if strings.Contains(param.TokenGroup, ",") {
		// 自定义 fallback：逗号分隔的分组列表，如 "cheap,premium,fallback"
		for _, g := range strings.Split(param.TokenGroup, ",") {
			g = strings.TrimSpace(g)
			if g != "" {
				groups = append(groups, g)
			}
		}
		customFallback = true
	} else if param.TokenGroup == "auto" {
		if len(setting.GetAutoGroups()) == 0 {
			return nil, selectGroup, errors.New("auto groups is not enabled")
		}
		groups = GetUserAutoGroup(userGroup)
	}

	if len(groups) > 0 {
		startGroupIndex := 0
		crossGroupRetry := common.GetContextKeyBool(param.Ctx, constant.ContextKeyTokenCrossGroupRetry)
		// 自定义 fallback 模式默认启用跨分组重试
		if customFallback {
			crossGroupRetry = true
		}

		if lastGroupIndex, exists := common.GetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex); exists {
			if idx, ok := lastGroupIndex.(int); ok {
				startGroupIndex = idx
			}
		}

		for i := startGroupIndex; i < len(groups); i++ {
			group := groups[i]
			priorityRetry := param.GetRetry()
			if i > startGroupIndex {
				priorityRetry = 0
			}
			logger.LogDebug(param.Ctx, "Auto selecting group: %s, priorityRetry: %d", group, priorityRetry)

			channel, _ = model.GetRandomSatisfiedChannel(group, param.ModelName, priorityRetry, param.RequestPath)
			if channel == nil {
				logger.LogDebug(param.Ctx, "No available channel in group %s for model %s at priorityRetry %d, trying next group", group, param.ModelName, priorityRetry)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
				param.SetRetry(0)
				continue
			}
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, group)
			selectGroup = group
			logger.LogDebug(param.Ctx, "Auto selected group: %s", group)

			if crossGroupRetry && priorityRetry >= common.RetryTimes {
				logger.LogDebug(param.Ctx, "Current group %s retries exhausted (priorityRetry=%d >= RetryTimes=%d), preparing switch to next group for next retry", group, priorityRetry, common.RetryTimes)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
				param.SetRetry(0)
				param.ResetRetryNextTry()
			} else {
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i)
			}
			break
		}
	} else {
		channel, err = model.GetRandomSatisfiedChannel(param.TokenGroup, param.ModelName, param.GetRetry(), param.RequestPath)
		if err != nil {
			return nil, param.TokenGroup, err
		}
	}
	return channel, selectGroup, nil
}
