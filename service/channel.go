package service

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	feishuDisableDedupeWindow   = 30 * time.Minute
	feishuEnableDedupeWindow    = 30 * time.Minute
	feishuProbePassDedupeWindow = 30 * time.Minute
	feishuRechargeDedupeWindow  = 10 * time.Minute
)

var (
	feishuDisableDedupe   sync.Map // channelId -> time.Time
	feishuEnableDedupe    sync.Map // channelId -> time.Time
	feishuProbePassDedupe sync.Map // channelId -> time.Time
	feishuRechargeDedupe  sync.Map // channelId -> time.Time
)

func formatNotifyType(channelId int, status int) string {
	return fmt.Sprintf("%s_%d_%d", dto.NotifyTypeChannelUpdate, channelId, status)
}

func channelFeishuDedupe(m *sync.Map, channelID int, window time.Duration) bool {
	return channelFeishuDedupeKey(m, fmt.Sprintf("channel:%d", channelID), window)
}

func channelModelFeishuDedupe(m *sync.Map, channelID int, modelName string, window time.Duration) bool {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return channelFeishuDedupe(m, channelID, window)
	}
	return channelFeishuDedupeKey(m, fmt.Sprintf("channel:%d:model:%s", channelID, modelName), window)
}

func channelFeishuDedupeKey(m *sync.Map, key string, window time.Duration) bool {
	now := time.Now()
	if v, ok := m.Load(key); ok {
		if now.Sub(v.(time.Time)) < window {
			return false
		}
	}
	m.Store(key, now)
	return true
}

func channelNotifyMeta(channelID int) (tag, baseURL string) {
	ch, err := model.GetChannelById(channelID, true)
	if err != nil || ch == nil {
		return "", ""
	}
	if ch.Tag != nil {
		tag = *ch.Tag
	}
	baseURL = ch.GetBaseURL()
	return tag, baseURL
}

func channelNotifyServerName() string {
	name := strings.TrimSpace(common.SystemName)
	if name == "" || name == "New API" {
		name = "APIMaster.ai"
	}
	return name
}

func channelModelNotifyLines(channelName string, channelID int, modelName string) []string {
	lines := []string{
		fmt.Sprintf("服务器：%s", channelNotifyServerName()),
		fmt.Sprintf("渠道：%s (#%d)", channelName, channelID),
	}
	if modelName = strings.TrimSpace(modelName); modelName != "" {
		lines = append(lines, fmt.Sprintf("模型：%s", modelName))
	}
	return lines
}

func notifyFeishuChannelDisabled(channelError types.ChannelError, modelName string, reason string) {
	chatID := common.FeishuOpsChatID()
	if chatID == "" {
		return
	}
	if !channelModelFeishuDedupe(&feishuDisableDedupe, channelError.ChannelId, modelName, feishuDisableDedupeWindow) {
		return
	}
	tag, _ := channelNotifyMeta(channelError.ChannelId)
	lines := channelModelNotifyLines(channelError.ChannelName, channelError.ChannelId, modelName)
	if tag != "" {
		lines = append(lines, fmt.Sprintf("标签：%s", tag))
	}
	lines = append(lines,
		fmt.Sprintf("原因：%s", reason),
		fmt.Sprintf("时间：%s", time.Now().Format("2006-01-02 15:04:05")),
	)
	if strings.TrimSpace(modelName) != "" {
		lines = append(lines, "已自动禁用该渠道下的这个模型")
	} else {
		lines = append(lines, "可在控制台重新启用渠道")
	}
	gopool.Go(func() {
		if err := common.SendFeishuCard(chatID, "⚠️ 渠道已自动禁用", lines); err != nil {
			common.SysLog(fmt.Sprintf("飞书禁用通知失败 channel #%d: %v", channelError.ChannelId, err))
		}
	})
}

func notifyFeishuChannelEnabled(channelID int, channelName string, modelName string) {
	chatID := common.FeishuOpsChatID()
	if chatID == "" {
		return
	}
	if !channelModelFeishuDedupe(&feishuEnableDedupe, channelID, modelName, feishuEnableDedupeWindow) {
		return
	}
	tag, _ := channelNotifyMeta(channelID)
	lines := channelModelNotifyLines(channelName, channelID, modelName)
	if tag != "" {
		lines = append(lines, fmt.Sprintf("标签：%s", tag))
	}
	lines = append(lines,
		"原因：自动恢复探针测试通过",
		fmt.Sprintf("时间：%s", time.Now().Format("2006-01-02 15:04:05")),
	)
	if strings.TrimSpace(modelName) != "" {
		lines = append(lines, "已重新启用该渠道下的这个模型")
	} else {
		lines = append(lines, "已重新启用渠道")
	}
	gopool.Go(func() {
		if err := common.SendFeishuCard(chatID, "✅ 渠道已自动启用", lines); err != nil {
			common.SysLog(fmt.Sprintf("飞书启用通知失败 channel #%d: %v", channelID, err))
		}
	})
}

func NotifyChannelDisableProbePassed(channelError types.ChannelError, modelName string, reason string, latencyMs int64) {
	chatID := common.FeishuOpsChatID()
	if chatID == "" {
		return
	}
	if !channelModelFeishuDedupe(&feishuProbePassDedupe, channelError.ChannelId, modelName, feishuProbePassDedupeWindow) {
		return
	}
	tag, _ := channelNotifyMeta(channelError.ChannelId)
	lines := channelModelNotifyLines(channelError.ChannelName, channelError.ChannelId, modelName)
	if tag != "" {
		lines = append(lines, fmt.Sprintf("标签：%s", tag))
	}
	if reason != "" {
		lines = append(lines, fmt.Sprintf("原封禁触发：%s", reason))
	}
	lines = append(lines,
		fmt.Sprintf("探针耗时：%.2fs", float64(latencyMs)/1000.0),
		fmt.Sprintf("时间：%s", time.Now().Format("2006-01-02 15:04:05")),
		"探针测试通过，已跳过本次自动封禁",
	)
	gopool.Go(func() {
		if err := common.SendFeishuCard(chatID, "渠道自动封禁探针通过", lines); err != nil {
			common.SysLog(fmt.Sprintf("飞书探针通过通知失败 channel #%d: %v", channelError.ChannelId, err))
		}
	})
}

// NotifyUpstreamRecharge sends a Feishu card when upstream account balance is depleted.
// err may be nil when triggered from balance polling.
func NotifyUpstreamRecharge(channelError types.ChannelError, err *types.NewAPIError) {
	chatID := common.FeishuOpsChatID()
	if chatID == "" {
		return
	}
	if !channelFeishuDedupe(&feishuRechargeDedupe, channelError.ChannelId, feishuRechargeDedupeWindow) {
		return
	}
	tag, baseURL := channelNotifyMeta(channelError.ChannelId)
	count := RechargeErrorCountInWindow(channelError.ChannelId)
	snip := "余额轮询检测到余额 ≤ 0"
	if err != nil {
		snip = err.MaskSensitiveErrorWithStatusCode()
		if len(snip) > 200 {
			snip = snip[:200] + "…"
		}
	}
	lines := []string{
		fmt.Sprintf("服务器：%s", channelNotifyServerName()),
		fmt.Sprintf("渠道：%s (#%d)", channelError.ChannelName, channelError.ChannelId),
	}
	if tag != "" {
		lines = append(lines, fmt.Sprintf("标签：%s", tag))
	}
	if baseURL != "" {
		lines = append(lines, fmt.Sprintf("Base URL：%s", baseURL))
	}
	lines = append(lines,
		fmt.Sprintf("检测原因：%s", snip),
		fmt.Sprintf("近 10 分钟同类错误：%d 次", count),
		"请尽快在上游平台充值后，于控制台重新启用渠道",
	)
	gopool.Go(func() {
		if sendErr := common.SendFeishuCard(chatID, "💳 上游渠道需充值", lines); sendErr != nil {
			common.SysLog(fmt.Sprintf("飞书充值通知失败 channel #%d: %v", channelError.ChannelId, sendErr))
		}
	})
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
		// 立即清除路由缓存，避免其他请求在 TTL 内继续命中已禁用渠道
		InvalidateChannelRoutingCache()
		subject := fmt.Sprintf("通道「%s」（#%d）已被禁用", channelError.ChannelName, channelError.ChannelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, reason)
		NotifyRootUser(formatNotifyType(channelError.ChannelId, common.ChannelStatusAutoDisabled), subject, content)
		notifyFeishuChannelDisabled(channelError, "", reason)
	}
}

func DisableChannelModel(channelError types.ChannelError, modelName string, reason string) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		common.SysLog(fmt.Sprintf("通道「%s」（#%d）模型级自动禁用缺少模型名，跳过禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, reason))
		return
	}

	common.SysLog(fmt.Sprintf("通道「%s」（#%d）模型「%s」发生错误，准备禁用该模型，原因：%s", channelError.ChannelName, channelError.ChannelId, modelName, reason))
	if !channelError.AutoBan {
		common.SysLog(fmt.Sprintf("通道「%s」（#%d）未启用自动禁用功能，跳过模型禁用操作", channelError.ChannelName, channelError.ChannelId))
		return
	}

	channel, err := model.GetChannelById(channelError.ChannelId, true)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to load channel #%d for model disable: %v", channelError.ChannelId, err))
		return
	}
	if channel.Status == common.ChannelStatusManuallyDisabled {
		common.SysLog(fmt.Sprintf("通道「%s」（#%d）已手动禁用，跳过模型级自动禁用", channelError.ChannelName, channelError.ChannelId))
		return
	}

	result := model.DB.Table("abilities").
		Where("channel_id = ? AND model = ? AND enabled = ?", channelError.ChannelId, modelName, true).
		Update("enabled", false)
	if result.Error != nil {
		common.SysError(fmt.Sprintf("failed to disable ability: channel_id=%d model=%s error=%v", channelError.ChannelId, modelName, result.Error))
		return
	}
	if result.RowsAffected == 0 {
		common.SysLog(fmt.Sprintf("通道「%s」（#%d）模型「%s」已不可路由，跳过重复禁用", channelError.ChannelName, channelError.ChannelId, modelName))
		return
	}

	info := channel.GetOtherInfo()
	autoDisabledModels := autoDisabledModelInfo(info)
	autoDisabledModels[modelName] = newAutoDisabledModelEntry(common.GetTimestamp(), reason)
	info[autoDisabledModelsInfoKey] = autoDisabledModels
	channel.SetOtherInfo(info)
	if err := model.DB.Model(&model.Channel{}).Where("id = ?", channelError.ChannelId).Update("other_info", channel.OtherInfo).Error; err != nil {
		common.SysError(fmt.Sprintf("failed to save model disable metadata: channel_id=%d model=%s error=%v", channelError.ChannelId, modelName, err))
	}

	model.InitChannelCache()
	InvalidateChannelRoutingCache()
	subject := fmt.Sprintf("通道「%s」（#%d）模型「%s」已被禁用", channelError.ChannelName, channelError.ChannelId, modelName)
	content := fmt.Sprintf("通道「%s」（#%d）模型「%s」已被禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, modelName, reason)
	NotifyRootUser(formatNotifyType(channelError.ChannelId, common.ChannelStatusAutoDisabled), subject, content)
	notifyFeishuChannelDisabled(channelError, modelName, reason)
}

func EnableChannel(channelId int, usingKey string, channelName string) {
	success := model.UpdateChannelStatus(channelId, usingKey, common.ChannelStatusEnabled, "")
	if success {
		subject := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		NotifyRootUser(formatNotifyType(channelId, common.ChannelStatusEnabled), subject, content)
		notifyFeishuChannelEnabled(channelId, channelName, "")
	}
}

func EnableChannelModel(channelId int, modelName string, channelName string) {
	modelName = strings.TrimSpace(modelName)
	if channelId <= 0 || modelName == "" {
		return
	}

	result := model.DB.Table("abilities").
		Where("channel_id = ? AND model = ?", channelId, modelName).
		Update("enabled", true)
	if result.Error != nil {
		common.SysError(fmt.Sprintf("failed to enable ability: channel_id=%d model=%s error=%v", channelId, modelName, result.Error))
		return
	}

	channel, err := model.GetChannelById(channelId, true)
	if err == nil && channel != nil {
		info := channel.GetOtherInfo()
		autoDisabledModels := autoDisabledModelInfo(info)
		delete(autoDisabledModels, modelName)
		if len(autoDisabledModels) == 0 {
			delete(info, autoDisabledModelsInfoKey)
		} else {
			info[autoDisabledModelsInfoKey] = autoDisabledModels
		}
		channel.SetOtherInfo(info)
		if err := model.DB.Model(&model.Channel{}).Where("id = ?", channelId).Update("other_info", channel.OtherInfo).Error; err != nil {
			common.SysError(fmt.Sprintf("failed to clear model auto-disabled metadata: channel_id=%d model=%s error=%v", channelId, modelName, err))
		}
	}

	model.InitChannelCache()
	InvalidateChannelRoutingCache()
	subject := fmt.Sprintf("通道「%s」（#%d）模型「%s」已被启用", channelName, channelId, modelName)
	content := fmt.Sprintf("通道「%s」（#%d）模型「%s」自动恢复检测通过，已启用", channelName, channelId, modelName)
	NotifyRootUser(formatNotifyType(channelId, common.ChannelStatusEnabled), subject, content)
	notifyFeishuChannelEnabled(channelId, channelName, modelName)
}

func ShouldDisableChannel(err *types.NewAPIError) bool {
	if !common.AutomaticDisableChannelEnabled {
		return false
	}
	if err == nil {
		return false
	}
	if types.IsImageGenerationTimeoutError(err) {
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
