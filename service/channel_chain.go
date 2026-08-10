package service

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func GetEnabledChannelsForChain() ([]model.Channel, error) {
	var channels []model.Channel
	if err := model.DB.Where("status = ?", common.ChannelStatusEnabled).Find(&channels).Error; err != nil {
		return nil, err
	}
	return channels, nil
}

func ValidateUserChannelChainChannels(channelIds []int) error {
	if len(channelIds) == 0 {
		return errors.New("at least one channel is required")
	}
	if len(channelIds) > model.MaxChannelsPerUserChannelChain {
		return fmt.Errorf("a channel chain can contain at most %d channels", model.MaxChannelsPerUserChannelChain)
	}
	channels, err := GetEnabledChannelsForChain()
	if err != nil {
		return err
	}
	accessible := make(map[int]struct{}, len(channels))
	for _, channel := range channels {
		accessible[channel.Id] = struct{}{}
	}
	seen := make(map[int]struct{}, len(channelIds))
	for _, id := range channelIds {
		if id <= 0 {
			return fmt.Errorf("invalid channel id %d", id)
		}
		if _, ok := seen[id]; ok {
			return fmt.Errorf("channel %d is duplicated", id)
		}
		seen[id] = struct{}{}
		if _, ok := accessible[id]; !ok {
			return fmt.Errorf("channel %d is unavailable or unauthorized", id)
		}
	}
	return nil
}

func ResolveChannelChainIds(userId int, group string) ([]int, error) {
	chainId, ok := model.ParseUserChannelChain(group)
	if !ok {
		return nil, errors.New("invalid channel chain")
	}
	chain, err := model.GetUserChannelChain(userId, chainId)
	if err != nil {
		return nil, err
	}
	return chain.GetChannelList(), nil
}
