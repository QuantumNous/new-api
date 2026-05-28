package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

const (
	ChannelCooldownDuration       = 30 * time.Minute
	UpstreamErrorCooldownDuration = 15 * time.Minute
)

var channelCooldownKeywords = []string{
	"insufficient account balance",
	"insufficient balance",
	"insufficient_quota",
	"your credit balance is too low",
	"余额不足",
}

var upstreamErrorCooldownCodes = map[types.ErrorCode]bool{
	types.ErrorCodeDoRequestFailed:        true,
	types.ErrorCodeReadResponseBodyFailed: true,
	types.ErrorCodeBadResponse:            true,
	types.ErrorCodeBadResponseBody:        true,
	types.ErrorCodeEmptyResponse:          true,
}

var upstreamErrorCooldownKeywords = []string{
	"openai_error",
	"empty or malformed response",
	"empty response",
	"malformed",
	"invalid character",
	"cannot unmarshal",
	"unexpected end of json",
	"unexpected eof",
	"http2: response body closed",
	"connection reset",
	"broken pipe",
	"stream error",
	"read/write",
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

func ShouldCooldownChannelForUpstreamError(err *types.NewAPIError) bool {
	if err == nil || ShouldCooldownChannel(err) {
		return false
	}
	if err.StatusCode >= 400 && err.StatusCode < 500 {
		return false
	}
	if upstreamErrorCooldownCodes[err.GetErrorCode()] {
		return true
	}
	if err.StatusCode == 502 || err.StatusCode == 503 {
		return true
	}
	if types.IsSkipRetryError(err) {
		return false
	}
	message := strings.ToLower(err.Error() + " " + string(err.GetErrorCode()) + " " + string(err.GetErrorType()))
	for _, keyword := range upstreamErrorCooldownKeywords {
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

func CooldownChannelForUpstreamError(channelError types.ChannelError, err *types.NewAPIError) {
	if !ShouldCooldownChannelForUpstreamError(err) {
		return
	}
	reason := fmt.Sprintf("upstream_unstable status=%d code=%s type=%s error=%s", err.StatusCode, err.GetErrorCode(), err.GetErrorType(), err.Error())
	common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", channelError.ChannelId, UpstreamErrorCooldownDuration, reason))
	model.CooldownChannel(channelError.ChannelId, reason, UpstreamErrorCooldownDuration)
}
