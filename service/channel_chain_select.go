package service

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func getRequestChannelChain(param *RetryParam) ([]string, bool) {
	if value, ok := common.GetContextKey(param.Ctx, constant.ContextKeyChannelChain); ok {
		if groups, ok := value.([]string); ok && len(groups) > 0 {
			return groups, true
		}
	}
	if strings.HasPrefix(param.TokenGroup, "chain:") {
		userId := common.GetContextKeyInt(param.Ctx, constant.ContextKeyUserId)
		if userId == 0 {
			userId = param.Ctx.GetInt("id")
		}
		if groups, err := ResolveChannelChainGroups(userId, param.TokenGroup); err == nil && len(groups) > 0 {
			return groups, true
		}
	}
	return nil, false
}

func getChannelChainSelection(param *RetryParam) (*model.Channel, string, error, bool) {
	groups, ok := getRequestChannelChain(param)
	if !ok {
		return nil, "", nil, false
	}

	used := make(map[int]struct{})
	for _, idStr := range param.Ctx.GetStringSlice("use_channel") {
		if id, err := strconv.Atoi(idStr); err == nil {
			used[id] = struct{}{}
		}
	}

	startGroupIndex := 0
	if index, exists := common.GetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex); exists {
		if value, ok := index.(int); ok {
			startGroupIndex = value
		}
	}

	for i := startGroupIndex; i < len(groups); i++ {
		group := groups[i]
		priorityRetry := param.GetRetry()
		if i > startGroupIndex {
			priorityRetry = 0
		}

		channel, _ := model.GetRandomSatisfiedChannel(group, param.ModelName, priorityRetry, param.RequestPath)
		if channel == nil {
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
			param.SetRetry(0)
			continue
		}
		if _, alreadyUsed := used[channel.Id]; alreadyUsed {
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
			param.SetRetry(0)
			continue
		}

		common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, group)
		if priorityRetry >= common.RetryTimes {
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
			param.SetRetry(0)
			param.ResetRetryNextTry()
		} else {
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i)
		}
		return channel, group, nil, true
	}
	return nil, param.TokenGroup, nil, true
}
