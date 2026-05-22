package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func GetDailyTokenLimit(channel *model.Channel) int64 {
	if channel == nil {
		return 0
	}
	return channel.GetSetting().DailyTokenLimit
}

func GetDailyTokenUsage(channelID int) int64 {
	return common.GetChannelDailyTokenUsage(channelID)
}

func IsChannelDailyTokenAvailable(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	return common.IsChannelDailyTokenUsageAvailable(channel.Id, GetDailyTokenLimit(channel))
}

func IncreaseChannelDailyTokenUsage(channelID int, tokens int64) error {
	if err := common.IncreaseChannelDailyTokenUsage(channelID, tokens); err != nil {
		return fmt.Errorf("increase channel daily token usage failed: channel_id=%d, tokens=%d: %w", channelID, tokens, err)
	}
	return nil
}
