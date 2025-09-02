package service

import (
	"fmt"
	"one-api/common"
	"one-api/model"
	"one-api/types"
	"strings"
	"time"
)

func ShouldDisableChannel(channelId int, err *types.NewAPIError) bool {
	if !common.AutomaticDisableChannelEnabled {
		return false
	}
	if err == nil {
		return false
	}
	errMsg := strings.ToLower(err.Error())
	if strings.Contains(errMsg, "deadline exceeded") || strings.Contains(errMsg, "timeout") || strings.Contains(errMsg, "connect") || strings.Contains(errMsg, "do request failed") || strings.Contains(errMsg, "provider returned error") || strings.Contains(errMsg, "internal server error") || strings.Contains(errMsg, "no response received") {
		return false
	}
	if err.StatusCode == 401 {
		return true
	}
	if err.StatusCode == 429 {
		// too many requests
		return true
	}
	if err.StatusCode == 403 {
		// forbidden
		return true
	}
	if err.GetErrorType() == "insufficient_quota" {
		return true
	}
	return false
}

func DisableChannel(channelError types.ChannelError, reason string) {
	success := model.UpdateChannelStatus(channelError.ChannelId, channelError.UsingKey, common.ChannelStatusAutoDisabled, reason)
	if success {
		common.SysLog(fmt.Sprintf("channel #%d (%s) disabled, reason: %s", channelError.ChannelId, channelError.ChannelName, reason))
	} else {
		common.SysLog(fmt.Sprintf("failed to disable channel #%d (%s)", channelError.ChannelId, channelError.ChannelName))
	}
}

func CheckAndReEnableChannels() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	lastEnableAt := -1

	for range ticker.C {
		if common.EnableAutodisabledChannelOrKeyAt != -1 {
			// Daily fixed time mode
			now := time.Now().UTC()
			if now.Hour() == common.EnableAutodisabledChannelOrKeyAt && now.Hour() != lastEnableAt {
				common.SysLog("daily re-enabling channels at UTC " + fmt.Sprintf("%d:00", now.Hour()))
				reEnableAllAutoDisabledChannels()
				lastEnableAt = now.Hour()
			} else if now.Hour() != lastEnableAt {
				lastEnableAt = -1 // Reset for the next day
			}
		} else if common.EnableAutodisabledChannelOrKeyAfterMinute > 0 {
			// Interval mode
			reEnableChannelsByInterval()
		}
	}
}

func reEnableAllAutoDisabledChannels() {
	channels, err := model.GetAutoDisabledChannels()
	if err != nil {
		common.SysError("failed to get auto-disabled channels for daily re-enabling: " + err.Error())
		return
	}
	for _, channel := range channels {
		otherInfo := channel.GetOtherInfo()
		if reason, ok := otherInfo["disable_reason"].(string); ok {
			if strings.HasPrefix(reason, "insufficient_quota:") {
				continue
			}
		}
		success := model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "re-enabled by daily task")
		if success {
			common.SysLog(fmt.Sprintf("channel #%d (%s) re-enabled by daily task", channel.Id, channel.Name))
		}
	}

	multiKeyChannels, err := model.GetChannelsWithDisabledKeys()
	if err != nil {
		common.SysError("failed to get channels with disabled keys for daily re-enabling: " + err.Error())
		return
	}
	for _, channel := range multiKeyChannels {
		keys := channel.GetKeys()
		for keyIdx, reason := range channel.ChannelInfo.MultiKeyDisabledReason {
			if strings.HasPrefix(reason, "insufficient_quota:") {
				continue
			}
			if keyIdx >= len(keys) {
				continue
			}
			keyToReEnable := keys[keyIdx]
			success := model.UpdateChannelStatus(channel.Id, keyToReEnable, common.ChannelStatusEnabled, "re-enabled by daily task")
			if success {
				common.SysLog(fmt.Sprintf("key #%d of channel #%d (%s) re-enabled by daily task", keyIdx, channel.Id, channel.Name))
				if channel.Status == common.ChannelStatusAutoDisabled {
					// Also re-enable the channel itself
					model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "re-enabled by daily task")
				}
			}
		}
	}
}

func reEnableChannelsByInterval() {
	common.SysLog("checking for channels to re-enable by interval")
	channels, err := model.GetAutoDisabledChannels()
	if err != nil {
		common.SysError("failed to get auto-disabled channels for interval re-enabling: " + err.Error())
		return
	}

	for _, channel := range channels {
		otherInfo := channel.GetOtherInfo()
		if reason, ok := otherInfo["disable_reason"].(string); ok {
			if strings.HasPrefix(reason, "insufficient_quota:") {
				continue
			}
		}
		if disabledTime, ok := otherInfo["status_time"].(float64); ok {
			if time.Now().Unix()-int64(disabledTime) >= int64(common.EnableAutodisabledChannelOrKeyAfterMinute*60) {
				success := model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "re-enabled by system")
				if success {
					common.SysLog(fmt.Sprintf("channel #%d (%s) re-enabled", channel.Id, channel.Name))
				}
			}
		}
	}

	multiKeyChannels, err := model.GetChannelsWithDisabledKeys()
	if err != nil {
		common.SysError("failed to get channels with disabled keys for interval re-enabling: " + err.Error())
		return
	}
	for _, channel := range multiKeyChannels {
		keys := channel.GetKeys()
		for keyIdx, disabledTime := range channel.ChannelInfo.MultiKeyDisabledTime {
			if keyIdx >= len(keys) {
				continue
			}
			if reason, ok := channel.ChannelInfo.MultiKeyDisabledReason[keyIdx]; ok {
				if strings.HasPrefix(reason, "insufficient_quota:") {
					continue
				}
			}
			if time.Now().Unix()-disabledTime >= int64(common.EnableAutodisabledChannelOrKeyAfterMinute*60) {
				keyToReEnable := keys[keyIdx]
				success := model.UpdateChannelStatus(channel.Id, keyToReEnable, common.ChannelStatusEnabled, "re-enabled by system")
				if success {
					common.SysLog(fmt.Sprintf("key #%d of channel #%d (%s) re-enabled", keyIdx, channel.Id, channel.Name))
					if channel.Status == common.ChannelStatusAutoDisabled {
						// Also re-enable the channel itself
						model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "re-enabled by system")
					}
				}
			}
		}
	}
}
