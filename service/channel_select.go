package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/modelroute"
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
// When routing_priority_mode=model_priority, selection uses modelroute try-list (PRD §10–§11).
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*model.Channel, string, error) {
	if modelroute.IsModelPriorityMode() {
		return cacheGetModelPriorityChannel(param)
	}
	return cacheGetChannelPriorityChannel(param)
}

func cacheGetChannelPriorityChannel(param *RetryParam) (*model.Channel, string, error) {
	var channel *model.Channel
	var err error
	selectGroup := param.TokenGroup
	userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)

	if param.TokenGroup == "auto" {
		if len(setting.GetAutoGroups()) == 0 {
			return nil, selectGroup, errors.New("auto groups is not enabled")
		}
		autoGroups := GetUserAutoGroup(userGroup)

		startGroupIndex := 0
		crossGroupRetry := common.GetContextKeyBool(param.Ctx, constant.ContextKeyTokenCrossGroupRetry)

		if lastGroupIndex, exists := common.GetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex); exists {
			if idx, ok := lastGroupIndex.(int); ok {
				startGroupIndex = idx
			}
		}

		for i := startGroupIndex; i < len(autoGroups); i++ {
			autoGroup := autoGroups[i]
			priorityRetry := param.GetRetry()
			if i > startGroupIndex {
				priorityRetry = 0
			}
			logger.LogDebug(param.Ctx, "Auto selecting group: %s, priorityRetry: %d", autoGroup, priorityRetry)

			channel, _ = model.GetRandomSatisfiedChannel(autoGroup, param.ModelName, priorityRetry, param.RequestPath)
			if channel == nil {
				logger.LogDebug(param.Ctx, "No available channel in group %s for model %s at priorityRetry %d, trying next group", autoGroup, param.ModelName, priorityRetry)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
				param.SetRetry(0)
				continue
			}
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, autoGroup)
			selectGroup = autoGroup
			logger.LogDebug(param.Ctx, "Auto selected group: %s", autoGroup)

			if crossGroupRetry && priorityRetry >= common.RetryTimes {
				logger.LogDebug(param.Ctx, "Current group %s retries exhausted (priorityRetry=%d >= RetryTimes=%d), preparing switch to next group for next retry", autoGroup, priorityRetry, common.RetryTimes)
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

// cacheGetModelPriorityChannel selects by modelroute CandidateChain (group-filtered).
// Retry index walks the filtered chain; already-used channel IDs are skipped.
func cacheGetModelPriorityChannel(param *RetryParam) (*model.Channel, string, error) {
	selectGroup := param.TokenGroup
	if param.ModelName == "" {
		return nil, selectGroup, errors.New("model name required")
	}

	chainIDs, selectGroups, err := ensureModelRouteChain(param)
	if err != nil {
		return nil, selectGroup, err
	}
	if len(chainIDs) == 0 {
		if ch, g, ok := tryEmergencyRecoveredChannel(param); ok {
			return ch, g, nil
		}
		return nil, selectGroup, nil
	}

	used := usedChannelIDSet(param.Ctx)
	for i, id := range chainIDs {
		if used[id] {
			continue
		}
		ch, err := model.CacheGetChannel(id)
		if err != nil || ch == nil {
			logger.LogDebug(param.Ctx, "model_priority skip missing channel %d: %v", id, err)
			continue
		}
		if ch.Status != common.ChannelStatusEnabled {
			continue
		}
		if !channelSupportsPath(ch, param.RequestPath) {
			continue
		}
		g := selectGroups[i]
		if g == "" {
			g = param.TokenGroup
		}
		if g != "" && g != "auto" {
			selectGroup = g
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, g)
		}
		// production concurrency slot (PRD §19): skip when limited & full
		mapping := ch.GetModelMapping()
		slot, _, okSlot := modelroute.AcquireProductionSlotForRequest(int64(id), param.ModelName, mapping)
		if !okSlot {
			logger.LogDebug(param.Ctx, "model_priority skip full channel %d model=%s", id, param.ModelName)
			continue
		}
		if param.Ctx != nil && slot != nil {
			// release any previous unreleased slot from an earlier selection in same request
			releaseModelRouteSlot(param.Ctx)
			common.SetContextKey(param.Ctx, constant.ContextKeyModelRouteProdSlot, slot)
		}
		modelroute.NoteOverflowRoute(param.ModelName, int64(id))
		logger.LogDebug(param.Ctx, "model_priority selected channel=%d model=%s retry=%d group=%s", id, param.ModelName, param.GetRetry(), selectGroup)
		return ch, selectGroup, nil
	}
	if ch, g, ok := tryEmergencyRecoveredChannel(param); ok {
		return ch, g, nil
	}
	return nil, selectGroup, nil
}

func tryEmergencyRecoveredChannel(param *RetryParam) (*model.Channel, string, bool) {
	if param == nil || param.ModelName == "" || !modelroute.IsModelPriorityMode() {
		return nil, "", false
	}
	// Prefer already-recovered candidate from a concurrent Leader.
	if cand, ok := modelroute.GlobalEmergency.GetRecovered(param.ModelName); ok && cand.ChannelID > 0 {
		if ch, g, ok2 := channelFromCandidate(param, cand); ok2 {
			return ch, g, true
		}
	}
	// Live emergency: probe standby ranks when normal try-list is exhausted (PRD §28).
	used := usedChannelIDSet(param.Ctx)
	exclude := make(map[int64]struct{}, len(used))
	for id := range used {
		exclude[int64(id)] = struct{}{}
	}
	ctx := context.Background()
	if param.Ctx != nil && param.Ctx.Request != nil {
		ctx = param.Ctx.Request.Context()
	}
	cand, ok := modelroute.RunEmergencyRecoveryForModel(ctx, param.ModelName, exclude)
	if !ok || cand.ChannelID <= 0 {
		return nil, "", false
	}
	return channelFromCandidate(param, cand)
}

func channelFromCandidate(param *RetryParam, cand model.ResolvedRouteCandidate) (*model.Channel, string, bool) {
	id := int(cand.ChannelID)
	if id <= 0 || usedChannelIDSet(param.Ctx)[id] {
		return nil, "", false
	}
	ch, err := model.CacheGetChannel(id)
	if err != nil || ch == nil || ch.Status != common.ChannelStatusEnabled {
		return nil, "", false
	}
	if !channelSupportsPath(ch, param.RequestPath) {
		return nil, "", false
	}
	g := param.TokenGroup
	if g == "auto" {
		g = common.GetContextKeyString(param.Ctx, constant.ContextKeyAutoGroup)
	}
	// also try group match from ability if fixed group
	if g != "" && g != "auto" && !model.IsChannelEnabledForGroupModel(g, param.ModelName, id) {
		// still allow: emergency recovery may be cross-ability rare; keep group label
	}
	return ch, g, true
}

func ensureModelRouteChain(param *RetryParam) ([]int, []string, error) {
	if param.Ctx != nil {
		if v, ok := common.GetContextKey(param.Ctx, constant.ContextKeyModelRouteChain); ok {
			if packed, ok := v.(modelRouteChainPacked); ok && len(packed.IDs) > 0 {
				return packed.IDs, packed.Groups, nil
			}
		}
	}

	tryList, _, err := modelroute.BuildTryListForRequest(param.ModelName)
	if err != nil {
		return nil, nil, err
	}
	groups := allowedGroupsForParam(param)
	var ids []int
	var selGroups []string
	for _, c := range tryList {
		id := int(c.ChannelID)
		if id <= 0 {
			continue
		}
		g, ok := matchChannelGroup(id, param.ModelName, groups)
		if !ok {
			continue
		}
		ids = append(ids, id)
		selGroups = append(selGroups, g)
	}
	if param.Ctx != nil {
		common.SetContextKey(param.Ctx, constant.ContextKeyModelRouteChain, modelRouteChainPacked{IDs: ids, Groups: selGroups})
	}
	return ids, selGroups, nil
}

type modelRouteChainPacked struct {
	IDs    []int
	Groups []string
}

func allowedGroupsForParam(param *RetryParam) []string {
	if param.TokenGroup == "auto" {
		userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)
		return GetUserAutoGroup(userGroup)
	}
	if param.TokenGroup == "" {
		return nil
	}
	return []string{param.TokenGroup}
}

func matchChannelGroup(channelID int, modelName string, groups []string) (string, bool) {
	if len(groups) == 0 {
		// no group constraint (should be rare); allow
		return "", true
	}
	for _, g := range groups {
		if model.IsChannelEnabledForGroupModel(g, modelName, channelID) {
			return g, true
		}
	}
	return "", false
}

func usedChannelIDSet(c *gin.Context) map[int]bool {
	out := make(map[int]bool)
	if c == nil {
		return out
	}
	for _, s := range c.GetStringSlice("use_channel") {
		id, err := strconv.Atoi(s)
		if err == nil {
			out[id] = true
		}
	}
	return out
}

func channelSupportsPath(channel *model.Channel, requestPath string) bool {
	if channel == nil {
		return false
	}
	if requestPath == "" || channel.Type != constant.ChannelTypeAdvancedCustom {
		return true
	}
	cfg := channel.GetOtherSettings().AdvancedCustom
	return cfg != nil && cfg.SupportsPath(requestPath)
}

// SelectModelPriorityChannel is an exported alias for tests.
func SelectModelPriorityChannel(param *RetryParam) (*model.Channel, string, error) {
	return cacheGetModelPriorityChannel(param)
}

// FormatModelRouteSelectDebug helps logs.
func FormatModelRouteSelectDebug(channelID int, modelName string) string {
	return fmt.Sprintf("channel=%d model=%s", channelID, modelName)
}


func releaseModelRouteSlot(c *gin.Context) {
	if c == nil {
		return
	}
	if v, ok := common.GetContextKey(c, constant.ContextKeyModelRouteProdSlot); ok && v != nil {
		if slot, ok2 := v.(*modelroute.ProductionSlot); ok2 && slot != nil {
			slot.Release()
		}
		// clear
		common.SetContextKey(c, constant.ContextKeyModelRouteProdSlot, (*modelroute.ProductionSlot)(nil))
	}
}

// ReleaseModelRouteProductionSlot frees the production concurrency slot for the current attempt.
func ReleaseModelRouteProductionSlot(c *gin.Context) {
	releaseModelRouteSlot(c)
}
