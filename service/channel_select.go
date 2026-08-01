package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
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

type ChannelSelection struct {
	Channel *model.Channel
	Group   string
	Lease   *ChannelAdmissionLease
}

type ChannelCapacityError struct {
	RetryAfter         time.Duration
	ConcurrencyRejects int
	RPMRejects         int
}

func (e *ChannelCapacityError) Error() string {
	return "all matching channels are at their configured capacity"
}

func (e *ChannelCapacityError) RetryAfterSeconds() int64 {
	if e == nil || e.RetryAfter <= 0 {
		return 1
	}
	seconds := int64((e.RetryAfter + time.Second - 1) / time.Second)
	if seconds < 1 {
		return 1
	}
	return seconds
}

func (e *ChannelCapacityError) addDecision(decision ChannelAdmissionDecision) {
	if decision.Reason == ChannelAdmissionReasonConcurrency {
		e.ConcurrencyRejects++
	} else if decision.Reason == ChannelAdmissionReasonRPM {
		e.RPMRejects++
	}
	if decision.RetryAfter > 0 && (e.RetryAfter <= 0 || decision.RetryAfter < e.RetryAfter) {
		e.RetryAfter = decision.RetryAfter
	}
}

func (e *ChannelCapacityError) merge(other *ChannelCapacityError) {
	if other == nil {
		return
	}
	e.ConcurrencyRejects += other.ConcurrencyRejects
	e.RPMRejects += other.RPMRejects
	if other.RetryAfter > 0 && (e.RetryAfter <= 0 || other.RetryAfter < e.RetryAfter) {
		e.RetryAfter = other.RetryAfter
	}
}

// SelectChannelWithAdmission selects and reserves a channel before any upstream
// request is sent. Capacity rejections are handled inside this call, so they do
// not advance RetryParam or consume an upstream retry.
func SelectChannelWithAdmission(param *RetryParam) (*ChannelSelection, error) {
	if param == nil || param.Ctx == nil {
		return nil, errors.New("channel selection requires a request context")
	}
	if param.TokenGroup != "auto" {
		tiers, err := model.GetSatisfiedChannelTiers(param.TokenGroup, param.ModelName, param.RequestPath)
		if err != nil {
			return nil, err
		}
		selection, err := selectAdmittedChannel(param.Ctx, param.TokenGroup, tiers, param.GetRetry())
		return selection, err
	}

	userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)
	autoGroups := GetRequestAutoGroups(param.Ctx, userGroup)
	if len(autoGroups) == 0 {
		return nil, errors.New("auto groups is not enabled")
	}
	startGroupIndex := 0
	if lastGroupIndex, exists := common.GetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex); exists {
		if index, ok := lastGroupIndex.(int); ok && index >= 0 {
			startGroupIndex = index
		}
	}
	if startGroupIndex >= len(autoGroups) {
		return nil, nil
	}

	crossGroupRetry := common.GetContextKeyBool(param.Ctx, constant.ContextKeyTokenCrossGroupRetry)
	capacityErr := &ChannelCapacityError{}
	for groupIndex := startGroupIndex; groupIndex < len(autoGroups); groupIndex++ {
		selectGroup := autoGroups[groupIndex]
		priorityRetry := param.GetRetry()
		if groupIndex > startGroupIndex {
			priorityRetry = 0
		}
		logger.LogDebug(param.Ctx, "Auto selecting group: %s, priorityRetry: %d", selectGroup, priorityRetry)

		tiers, err := model.GetSatisfiedChannelTiers(selectGroup, param.ModelName, param.RequestPath)
		if err != nil {
			return nil, err
		}
		if len(tiers) == 0 {
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, groupIndex+1)
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
			param.SetRetry(0)
			continue
		}

		selection, err := selectAdmittedChannel(param.Ctx, selectGroup, tiers, priorityRetry)
		if err != nil {
			var groupCapacityErr *ChannelCapacityError
			if !errors.As(err, &groupCapacityErr) {
				return nil, err
			}
			capacityErr.merge(groupCapacityErr)
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, groupIndex+1)
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
			param.SetRetry(0)
			continue
		}
		if selection == nil {
			continue
		}

		common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, selectGroup)
		logger.LogDebug(param.Ctx, "Auto selected group: %s", selectGroup)
		if crossGroupRetry && priorityRetry >= common.RetryTimes {
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, groupIndex+1)
			param.SetRetry(0)
			param.ResetRetryNextTry()
		} else {
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, groupIndex)
		}
		return selection, nil
	}

	if capacityErr.ConcurrencyRejects > 0 || capacityErr.RPMRejects > 0 {
		return nil, capacityErr
	}
	return nil, nil
}

// CacheGetRandomSatisfiedChannel preserves the legacy selection contract for
// callers that cannot take ownership of an admission lease.
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*model.Channel, string, error) {
	group := ""
	if param != nil {
		group = param.TokenGroup
	}
	selection, err := SelectChannelWithAdmission(param)
	if err != nil {
		return nil, group, err
	}
	if selection == nil || selection.Channel == nil {
		return nil, group, nil
	}
	if err := selection.Lease.Release(); err != nil {
		return nil, selection.Group, err
	}
	return selection.Channel, selection.Group, nil
}

func selectAdmittedChannel(ctx context.Context, group string, tiers []model.ChannelCandidateTier, startTier int) (*ChannelSelection, error) {
	if len(tiers) == 0 {
		return nil, nil
	}
	if startTier < 0 {
		startTier = 0
	}
	if startTier >= len(tiers) {
		startTier = len(tiers) - 1
	}

	capacityErr := &ChannelCapacityError{}
	for tierIndex := startTier; tierIndex < len(tiers); tierIndex++ {
		candidates := append([]model.ChannelCandidate(nil), tiers[tierIndex].Candidates...)
		for len(candidates) > 0 {
			candidate, candidateIndex := model.PickWeightedChannelCandidate(candidates)
			if candidateIndex < 0 || candidate.Channel == nil {
				break
			}
			candidates = append(candidates[:candidateIndex], candidates[candidateIndex+1:]...)

			lease, decision, err := AcquireChannelAdmission(ctx, candidate.Channel)
			if err != nil {
				return nil, fmt.Errorf("acquire channel #%d admission: %w", candidate.Channel.Id, err)
			}
			if decision.Allowed {
				return &ChannelSelection{Channel: candidate.Channel, Group: group, Lease: lease}, nil
			}
			capacityErr.addDecision(decision)
		}
	}
	if capacityErr.ConcurrencyRejects > 0 || capacityErr.RPMRejects > 0 {
		return nil, capacityErr
	}
	return nil, nil
}
