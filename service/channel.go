package service

import (
	"fmt"
	"one-api/common"
	"one-api/model"
	"one-api/types"
	"strings"
)

func ShouldDisableChannel(channelId int, err *types.NewAPIError) bool {
	if !common.AutomaticDisableChannelEnabled {
		return false
	}
	if err == nil {
		return false
	}
	errMsg := strings.ToLower(err.Error())
	if strings.Contains(errMsg, "no candidates returned") || strings.Contains(errMsg, "deadline exceeded") || strings.Contains(errMsg, "timeout") || strings.Contains(errMsg, "connect") || strings.Contains(errMsg, "do request failed") || strings.Contains(errMsg, "provider returned error") || strings.Contains(errMsg, "internal server error") || strings.Contains(errMsg, "no response received") {
		return false
	}
	if err.StatusCode == 401 {
		return true
	}
	if err.StatusCode == 429 {
		// too many requests
		return false
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
