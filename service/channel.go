package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

func formatNotifyType(channelId int, status int) string {
	return fmt.Sprintf("%s_%d_%d", dto.NotifyTypeChannelUpdate, channelId, status)
}

// getRootUserLang returns the language preference of the root user,
// falling back to the default language if not set.
func getRootUserLang() string {
	rootUser := model.GetRootUser()
	if rootUser == nil {
		return i18n.DefaultLang
	}
	setting := rootUser.GetSetting()
	if setting.Language != "" {
		return setting.Language
	}
	return i18n.DefaultLang
}

// disable & notify
func DisableChannel(channelError types.ChannelError, reason string) {
	common.SysLog(fmt.Sprintf("通道「%s」（#%d）发生错误，准备禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, reason))

	// 检查是否启用自动禁用功能
	if !channelError.AutoBan {
		common.SysLog(fmt.Sprintf("通道「%s」（#%d）未启用自动禁用功能，跳过禁用操作", channelError.ChannelName, channelError.ChannelId))
		return
	}

	success := model.UpdateChannelStatus(channelError.ChannelId, channelError.UsingKey, common.ChannelStatusAutoDisabled, reason)
	if success {
		lang := getRootUserLang()
		subject := i18n.Translate(lang, i18n.MsgEmailChannelDisabledSubject, map[string]any{
			"ChannelName": channelError.ChannelName,
			"ChannelId":   channelError.ChannelId,
		})
		content := i18n.Translate(lang, i18n.MsgEmailChannelDisabledContent, map[string]any{
			"ChannelName": channelError.ChannelName,
			"ChannelId":   channelError.ChannelId,
			"Reason":      reason,
		})
		NotifyRootUser(formatNotifyType(channelError.ChannelId, common.ChannelStatusAutoDisabled), subject, content)
	}
}

func EnableChannel(channelId int, usingKey string, channelName string) {
	success := model.UpdateChannelStatus(channelId, usingKey, common.ChannelStatusEnabled, "")
	if success {
		lang := getRootUserLang()
		subject := i18n.Translate(lang, i18n.MsgEmailChannelEnabledSubject, map[string]any{
			"ChannelName": channelName,
			"ChannelId":   channelId,
		})
		content := i18n.Translate(lang, i18n.MsgEmailChannelEnabledContent, map[string]any{
			"ChannelName": channelName,
			"ChannelId":   channelId,
		})
		NotifyRootUser(formatNotifyType(channelId, common.ChannelStatusEnabled), subject, content)
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
