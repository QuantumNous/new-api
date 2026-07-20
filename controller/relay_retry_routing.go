package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type relayRetryChannel struct {
	id    int
	group string
}

type relayRetryRouting struct {
	attempts      map[int]int
	excluded      map[int]struct{}
	excludedOrder []relayRetryChannel
	next          *relayRetryChannel
}

func newRelayRetryRouting() *relayRetryRouting {
	return &relayRetryRouting{
		attempts: make(map[int]int),
		excluded: make(map[int]struct{}),
	}
}

func (routing *relayRetryRouting) recordFailure(channelID int, group string) {
	if routing == nil || channelID <= 0 {
		return
	}
	attempts := routing.attempts[channelID] + 1
	routing.attempts[channelID] = attempts
	channel := relayRetryChannel{id: channelID, group: group}
	if attempts == 1 {
		routing.next = &channel
		return
	}
	routing.next = nil
	routing.exclude(channel)
}

func (routing *relayRetryRouting) exclude(channel relayRetryChannel) {
	if routing == nil || channel.id <= 0 {
		return
	}
	if _, exists := routing.excluded[channel.id]; exists {
		return
	}
	routing.excluded[channel.id] = struct{}{}
	routing.excludedOrder = append(routing.excludedOrder, channel)
}

func (routing *relayRetryRouting) markUnavailable(channel relayRetryChannel) {
	if routing == nil {
		return
	}
	routing.next = nil
	routing.attempts[channel.id] = 2
	routing.exclude(channel)
}

func (routing *relayRetryRouting) takeNext() (relayRetryChannel, bool) {
	if routing == nil || routing.next == nil {
		return relayRetryChannel{}, false
	}
	channel := *routing.next
	routing.next = nil
	return channel, true
}

func (routing *relayRetryRouting) selectionOptions() (model.ChannelSelectionOptions, bool) {
	if routing == nil || len(routing.excludedOrder) == 0 {
		return model.ChannelSelectionOptions{}, false
	}
	channelIDs := make([]int, 0, len(routing.excludedOrder))
	for _, channel := range routing.excludedOrder {
		channelIDs = append(channelIDs, channel.id)
	}
	return model.ChannelSelectionOptions{ExcludedChannelIds: channelIDs}, true
}

func (routing *relayRetryRouting) restartFromFirst() (relayRetryChannel, bool) {
	if routing == nil || len(routing.excludedOrder) == 0 {
		return relayRetryChannel{}, false
	}
	first := routing.excludedOrder[0]
	routing.attempts = make(map[int]int)
	routing.excluded = make(map[int]struct{})
	routing.excludedOrder = nil
	routing.next = nil
	return first, true
}

func (routing *relayRetryRouting) selectChannel(c *gin.Context, retryParam *service.RetryParam) (*model.Channel, string, error) {
	if routing == nil {
		return service.CacheGetRandomSatisfiedChannel(retryParam)
	}
	if retryChannel, ok := routing.takeNext(); ok {
		channel, err := model.CacheGetChannel(retryChannel.id)
		if err == nil && channel != nil && channel.Status == common.ChannelStatusEnabled {
			return channel, retryChannel.group, nil
		}
		routing.markUnavailable(retryChannel)
	}

	selectionOptions, hasExcludedChannels := routing.selectionOptions()
	if !hasExcludedChannels {
		return service.CacheGetRandomSatisfiedChannel(retryParam)
	}
	channel, selectGroup, err := service.CacheGetRandomSatisfiedChannel(retryParam, selectionOptions)
	if err != nil || channel != nil {
		return channel, selectGroup, err
	}

	retryChannel, ok := routing.restartFromFirst()
	if !ok {
		return nil, selectGroup, nil
	}
	if retryParam.TokenGroup == "auto" {
		common.SetContextKey(c, constant.ContextKeyAutoGroupIndex, 0)
		common.SetContextKey(c, constant.ContextKeyAutoGroupRetryIndex, 0)
	}
	channel, err = model.CacheGetChannel(retryChannel.id)
	if err == nil && channel != nil && channel.Status == common.ChannelStatusEnabled {
		return channel, retryChannel.group, nil
	}
	return service.CacheGetRandomSatisfiedChannel(retryParam)
}
