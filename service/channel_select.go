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

type RetryParam struct {
	Ctx         *gin.Context
	TokenGroup  string
	ModelName   string
	RequestPath string
	Retry       *int

	// Routing state is request-local. Keeping it off the Gin context prevents a
	// fresh RetryParam in the relay handler from skipping the first candidate.
	groupIndex   int
	attempted    bool
	groups       []string
	groupsInit   bool
	resetNextTry bool // retained for callers using the legacy RetryParam API
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
	*p.Retry = *p.Retry + 1
}

// ResetRetryNextTry is kept for compatibility with older callers. Ordered
// routing now advances through AdvanceRetry, but the legacy no-op increment
// behavior remains available to code that still uses this method.
func (p *RetryParam) ResetRetryNextTry() {
	p.resetNextTry = true
}

// MarkAttempted distinguishes initial capability fallback from fallback after
// an upstream request. Initial selection may always skip groups that cannot
// serve the model; post-attempt group changes require cross-group retry.
func (p *RetryParam) MarkAttempted() {
	p.attempted = true
}

func (p *RetryParam) IsAutoRouting() bool {
	return p.TokenGroup == "auto"
}

// HasNextRetry is independent of common.RetryTimes for candidate transitions,
// so ordered failover still works when the global retry count is zero.
func (p *RetryParam) HasNextRetry() bool {
	if p.GetRetry() < common.RetryTimes {
		return true
	}
	if !p.IsAutoRouting() || !common.GetContextKeyBool(p.Ctx, constant.ContextKeyTokenCrossGroupRetry) {
		return false
	}
	groups, err := p.candidateGroups()
	return err == nil && p.groupIndex+1 < len(groups)
}

// AdvanceRetry exhausts the current group's retry levels before moving to the
// next ordered candidate.
func (p *RetryParam) AdvanceRetry() bool {
	if p.GetRetry() < common.RetryTimes {
		p.IncreaseRetry()
		return true
	}
	if !p.IsAutoRouting() || !common.GetContextKeyBool(p.Ctx, constant.ContextKeyTokenCrossGroupRetry) {
		return false
	}
	groups, err := p.candidateGroups()
	if err != nil || p.groupIndex+1 >= len(groups) {
		return false
	}
	p.groupIndex++
	p.SetRetry(0)
	return true
}

func (p *RetryParam) candidateGroups() ([]string, error) {
	if p.groupsInit {
		return p.groups, nil
	}
	p.groupsInit = true

	if p.TokenGroup != "auto" {
		// A caller such as Playground may explicitly override the token's
		// routing group for this request. In that case, do not reapply the
		// token's ordered candidates.
		p.groups = []string{p.TokenGroup}
		return p.groups, nil
	}

	// Explicit token candidates take precedence over the server-wide auto list.
	if candidates := common.GetContextKeyStringSlice(p.Ctx, constant.ContextKeyTokenGroupCandidates); len(candidates) > 0 {
		p.groups = append([]string(nil), candidates...)
	} else {
		if len(setting.GetAutoGroups()) == 0 {
			return nil, errors.New("auto groups is not enabled")
		}
		userGroup := common.GetContextKeyString(p.Ctx, constant.ContextKeyUserGroup)
		p.groups = GetUserAutoGroup(userGroup)
	}

	// The distributor selects a concrete group before Relay creates its own
	// RetryParam. Resume from that group instead of re-running earlier candidates.
	if selected := common.GetContextKeyString(p.Ctx, constant.ContextKeyAutoGroup); selected != "" {
		for i, group := range p.groups {
			if group == selected {
				p.groupIndex = i
				break
			}
		}
	}
	return p.groups, nil
}

// CacheGetRandomSatisfiedChannel selects within the first usable candidate.
// Candidate order is deterministic; channel selection within one group keeps
// the existing weighted/priority behavior.
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*model.Channel, string, error) {
	groups, err := param.candidateGroups()
	if err != nil {
		return nil, param.TokenGroup, err
	}
	if len(groups) == 0 {
		return nil, param.TokenGroup, errors.New("no usable groups for token")
	}

	start := param.groupIndex
	if start < 0 {
		start = 0
	}
	if start >= len(groups) {
		return nil, groups[len(groups)-1], nil
	}

	for i := start; i < len(groups); i++ {
		group := groups[i]
		priorityRetry := param.GetRetry()
		if i > start {
			priorityRetry = 0
		}
		logger.LogDebug(param.Ctx, "Selecting group: %s, priorityRetry: %d", group, priorityRetry)

		channel, channelErr := model.GetRandomSatisfiedChannel(group, param.ModelName, priorityRetry, param.RequestPath)
		if channelErr != nil {
			return nil, group, channelErr
		}
		if channel == nil {
			logger.LogDebug(param.Ctx, "No available channel in group %s for model %s at priorityRetry %d", group, param.ModelName, priorityRetry)
			if param.attempted && !common.GetContextKeyBool(param.Ctx, constant.ContextKeyTokenCrossGroupRetry) {
				return nil, group, nil
			}
			param.groupIndex = i + 1
			param.SetRetry(0)
			continue
		}

		param.groupIndex = i
		if param.IsAutoRouting() {
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, group)
		}
		return channel, group, nil
	}
	return nil, groups[len(groups)-1], nil
}
