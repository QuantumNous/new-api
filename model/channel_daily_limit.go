package model

import "github.com/QuantumNous/new-api/common"

func IsChannelDailyTokenAvailable(channel *Channel) bool {
	if channel == nil {
		return false
	}
	return common.IsChannelDailyTokenUsageAvailable(channel.Id, channel.GetSetting().DailyTokenLimit)
}
