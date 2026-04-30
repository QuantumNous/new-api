package service

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

func formatNotifyType(channelId int, status int) string {
	return fmt.Sprintf("%s_%d_%d", dto.NotifyTypeChannelUpdate, channelId, status)
}

func formatModelNotifyType(channelId int, modelName string, status int) string {
	return fmt.Sprintf("%s_%d_%s_%d", dto.NotifyTypeChannelUpdate, channelId, modelName, status)
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
		subject := fmt.Sprintf("通道「%s」（#%d）已被禁用", channelError.ChannelName, channelError.ChannelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, reason)
		NotifyRootUser(formatNotifyType(channelError.ChannelId, common.ChannelStatusAutoDisabled), subject, content)
	}
}

func EnableChannel(channelId int, usingKey string, channelName string) {
	success := model.UpdateChannelStatus(channelId, usingKey, common.ChannelStatusEnabled, "")
	if success {
		subject := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
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

// IsChannelLevelError checks if the error is a channel-level issue (shared resources like API key, account, quota)
func IsChannelLevelError(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	if types.IsChannelError(err) {
		return true
	}
	if err.StatusCode == http.StatusUnauthorized || err.StatusCode == http.StatusForbidden {
		return true
	}
	oaiErr := err.ToOpenAIError()
	switch oaiErr.Code {
	case "invalid_api_key", "account_deactivated", "billing_not_active", "Arrearage":
		return true
	}
	switch oaiErr.Type {
	case "insufficient_quota", "insufficient_user_quota", "authentication_error", "permission_error", "forbidden":
		return true
	}
	return false
}

// DisableChannelModel disables a single model's ability within a channel and sends notification
func DisableChannelModel(channelId int, channelName string, modelName string, reason string) {
	common.SysLog(fmt.Sprintf("通道「%s」（#%d）的模型「%s」发生错误，准备禁用，原因：%s", channelName, channelId, modelName, reason))
	err := model.UpdateAbilityModelStatus(channelId, modelName, false)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to disable model ability: channel=%d, model=%s, error=%v", channelId, modelName, err))
		return
	}
	subject := fmt.Sprintf("通道「%s」（#%d）的模型「%s」已被禁用", channelName, channelId, modelName)
	content := fmt.Sprintf("通道「%s」（#%d）的模型「%s」已被禁用，原因：%s", channelName, channelId, modelName, reason)
	NotifyRootUser(formatModelNotifyType(channelId, modelName, common.ChannelStatusAutoDisabled), subject, content)
}

// EnableChannelModel enables a single model's ability within a channel and sends notification
func EnableChannelModel(channelId int, channelName string, modelName string) {
	err := model.UpdateAbilityModelStatus(channelId, modelName, true)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to enable model ability: channel=%d, model=%s, error=%v", channelId, modelName, err))
		return
	}
	subject := fmt.Sprintf("通道「%s」（#%d）的模型「%s」已被启用", channelName, channelId, modelName)
	content := fmt.Sprintf("通道「%s」（#%d）的模型「%s」已被启用", channelName, channelId, modelName)
	NotifyRootUser(formatModelNotifyType(channelId, modelName, common.ChannelStatusEnabled), subject, content)
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
