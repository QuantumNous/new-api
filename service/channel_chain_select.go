package service

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func getRequestChannelChain(param *RetryParam) ([]int, bool) {
	if value, ok := common.GetContextKey(param.Ctx, constant.ContextKeyChannelChain); ok {
		if ids, ok := value.([]int); ok && len(ids) > 0 {
			return ids, true
		}
	}
	if strings.HasPrefix(param.TokenGroup, "chain:") {
		userId := common.GetContextKeyInt(param.Ctx, constant.ContextKeyUserId)
		if userId == 0 {
			userId = param.Ctx.GetInt("id")
		}
		if ids, err := ResolveChannelChainIds(userId, param.TokenGroup); err == nil && len(ids) > 0 {
			return ids, true
		}
	}
	return nil, false
}

func getChannelChainSelection(param *RetryParam) (*model.Channel, string, error, bool) {
	chainIds, ok := getRequestChannelChain(param)
	if !ok {
		return nil, "", nil, false
	}

	used := make(map[int]struct{})
	for _, idStr := range param.Ctx.GetStringSlice("use_channel") {
		if id, err := strconv.Atoi(idStr); err == nil {
			used[id] = struct{}{}
		}
	}

	for i := param.GetRetry(); i < len(chainIds); i++ {
		channelId := chainIds[i]
		if _, ok := used[channelId]; ok {
			continue
		}
		channel, err := model.CacheGetChannel(channelId)
		if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled {
			continue
		}
		if !channelChainSupportsRequestPath(channel, param.RequestPath, param.ModelName) {
			continue
		}
		selectedGroup := findChannelChainGroup(channel, param.ModelName, channelId)
		if selectedGroup == "" {
			continue
		}
		common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, selectedGroup)
		return channel, selectedGroup, nil, true
	}
	return nil, param.TokenGroup, nil, true
}

func findChannelChainGroup(channel *model.Channel, modelName string, channelId int) string {
	for _, group := range strings.Split(channel.Group, ",") {
		group = strings.TrimSpace(group)
		if group != "" && model.IsChannelEnabledForGroupModel(group, modelName, channelId) {
			return group
		}
	}
	return ""
}

func channelChainSupportsRequestPath(channel *model.Channel, requestPath string, requestModel string) bool {
	if channel == nil {
		return false
	}
	if channel.Type != constant.ChannelTypeAdvancedCustom {
		return true
	}
	config := channel.GetOtherSettings().AdvancedCustom
	return config != nil && config.SupportsPathForModel(requestPath, requestModel)
}
