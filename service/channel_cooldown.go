package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

const ChannelCooldownDuration = 30 * time.Minute

var channelCooldownKeywords = []string{
	"insufficient account balance",
	"insufficient balance",
	"insufficient_quota",
	"your credit balance is too low",
	"余额不足",
}

func ShouldCooldownChannel(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error() + " " + string(err.GetErrorCode()))
	for _, keyword := range channelCooldownKeywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

func CooldownChannel(channelError types.ChannelError, err *types.NewAPIError) {
	if !ShouldCooldownChannel(err) {
		return
	}
	common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", channelError.ChannelId, ChannelCooldownDuration, err.Error()))
	model.CooldownChannel(channelError.ChannelId, err.Error(), ChannelCooldownDuration)
}
