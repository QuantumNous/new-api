package service

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var planQuotaResetPattern = regexp.MustCompile(`(?i)reset at\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4} [A-Z]+)`)

func formatNotifyType(channelId int, status int) string {
	return fmt.Sprintf("%s_%d_%d", dto.NotifyTypeChannelUpdate, channelId, status)
}

func shouldCloseActiveWebSocketsAfterDisable(channelId int) bool {
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to check channel status before closing active websockets: channel_id=%d, error=%v", channelId, err))
		return true
	}
	return channel.Status != common.ChannelStatusEnabled
}

// disable & notify
func DisableChannel(channelError types.ChannelError, reason string) {
	disableChannel(channelError, reason, operation_setting.GetUpstreamOrchestrationSetting().Enabled)
}

func disableChannel(channelError types.ChannelError, reason string, orchestrationEnabled bool) {
	common.SysLog(fmt.Sprintf("通道「%s」（#%d）发生错误，准备禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, common.LocalLogPreview(reason)))

	// 检查是否启用自动禁用功能
	if !channelError.AutoBan {
		common.SysLog(fmt.Sprintf("通道「%s」（#%d）未启用自动禁用功能，跳过禁用操作", channelError.ChannelName, channelError.ChannelId))
		return
	}

	if orchestrationEnabled {
		handled, _, err := RecordManagedChannelFailure(channelError, reason)
		if err != nil {
			common.SysError(fmt.Sprintf("failed to record managed channel failure: channel_id=%d error=%v", channelError.ChannelId, err))
			return
		}
		if handled {
			return
		}
	}

	channel, _ := model.CacheGetChannel(channelError.ChannelId)
	resetAt, quotaLimited := ParsePlanQuotaReset(reason)
	if channel != nil && quotaLimited && strings.HasPrefix(channel.GetTag(), "plan:") {
		disablePlanQuotaDomain(channel.GetTag(), reason, resetAt)
		return
	}

	success := model.UpdateChannelStatus(channelError.ChannelId, channelError.UsingKey, common.ChannelStatusAutoDisabled, reason)
	if success {
		if shouldCloseActiveWebSocketsAfterDisable(channelError.ChannelId) {
			CloseActiveWebSocketsForChannel(channelError.ChannelId, ChannelDisabledCloseReason)
		}
		subject := fmt.Sprintf("通道「%s」（#%d）已被禁用", channelError.ChannelName, channelError.ChannelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, reason)
		NotifyRootUser(formatNotifyType(channelError.ChannelId, common.ChannelStatusAutoDisabled), subject, content)
	}
}

func ParsePlanQuotaReset(reason string) (int64, bool) {
	lowerReason := strings.ToLower(reason)
	if !strings.Contains(lowerReason, "exceeded the 5-hour usage quota") &&
		!strings.Contains(lowerReason, "exceeded the weekly usage quota") {
		return 0, false
	}
	match := planQuotaResetPattern.FindStringSubmatch(reason)
	if len(match) != 2 {
		return 0, true
	}
	resetAt, err := time.Parse("2006-01-02 15:04:05 -0700 MST", match[1])
	if err != nil {
		return 0, true
	}
	return resetAt.Unix(), true
}

func disablePlanQuotaDomain(tag string, reason string, resetAt int64) {
	channels, err := model.GetChannelsByTag(tag, false, true)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to load Plan quota domain %s: %v", tag, err))
		return
	}
	disabledIDs := make([]int, 0, len(channels))
	for _, channel := range channels {
		if model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusAutoDisabled, reason) {
			disabledIDs = append(disabledIDs, channel.Id)
		}
		metadata := map[string]any{
			"quota_domain": tag,
			"quota_type":   "plan",
		}
		if resetAt > 0 {
			metadata["quota_reset_at"] = resetAt
			metadata["disabled_until"] = resetAt + 60
		} else {
			metadata["quota_reset_at"] = nil
			metadata["disabled_until"] = nil
		}
		if err := model.MergeChannelStatusMetadata(channel.Id, metadata); err != nil {
			common.SysError(fmt.Sprintf("failed to persist Plan quota metadata: channel_id=%d error=%v", channel.Id, err))
		}
	}
	if len(disabledIDs) > 0 {
		CloseActiveWebSocketsForChannels(disabledIDs, ChannelDisabledCloseReason)
		subject := fmt.Sprintf("Plan 配额域「%s」已临时禁用", tag)
		content := fmt.Sprintf("%s，共禁用 %d 个协议渠道", reason, len(disabledIDs))
		NotifyRootUser("channel_plan_quota_"+tag, subject, content)
	}
}

func EnableChannel(channelId int, usingKey string, channelName string) {
	channel, _ := model.CacheGetChannel(channelId)
	if channel != nil && strings.HasPrefix(channel.GetTag(), "plan:") {
		enablePlanQuotaDomain(channel.GetTag())
		return
	}
	success := model.UpdateChannelStatus(channelId, usingKey, common.ChannelStatusEnabled, "")
	if success {
		subject := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		NotifyRootUser(formatNotifyType(channelId, common.ChannelStatusEnabled), subject, content)
	}
}

func enablePlanQuotaDomain(tag string) {
	channels, err := model.GetChannelsByTag(tag, false, true)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to load Plan quota domain %s: %v", tag, err))
		return
	}
	enabled := 0
	for _, channel := range channels {
		if model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "") {
			enabled++
		}
		if err := model.MergeChannelStatusMetadata(channel.Id, map[string]interface{}{
			"disabled_until": nil,
			"quota_reset_at": nil,
			"quota_domain":   nil,
			"quota_type":     nil,
		}); err != nil {
			common.SysError(fmt.Sprintf("failed to clear Plan quota metadata: channel_id=%d error=%v", channel.Id, err))
		}
	}
	if enabled > 0 {
		NotifyRootUser("channel_plan_quota_recovered_"+tag,
			fmt.Sprintf("Plan 配额域「%s」已恢复", tag),
			fmt.Sprintf("已恢复 %d 个协议渠道", enabled))
	}
}

func ShouldDisableChannel(err *types.NewAPIError) bool {
	if !common.AutomaticDisableChannelEnabled {
		return false
	}
	if err == nil {
		return false
	}
	if types.IsChannelError(err) {
		return true
	}
	if types.IsSkipRetryError(err) {
		return false
	}
	if operation_setting.ShouldDisableByStatusCode(err.StatusCode) {
		return true
	}

	lowerMessage := strings.ToLower(err.Error())
	search, _ := AcSearch(lowerMessage, operation_setting.AutomaticDisableKeywords, true)
	return search
}

func ShouldEnableChannel(newAPIError *types.NewAPIError, status int) bool {
	if !common.AutomaticEnableChannelEnabled {
		return false
	}
	if newAPIError != nil {
		return false
	}
	if status != common.ChannelStatusAutoDisabled {
		return false
	}
	return true
}
