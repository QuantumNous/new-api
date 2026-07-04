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
	now := time.Now()
	if v, ok := m.Load(channelID); ok {
		if now.Sub(v.(time.Time)) < window {
			return false
		}
	}
	m.Store(channelID, now)
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

func notifyFeishuChannelDisabled(channelError types.ChannelError, reason string) {
	chatID := common.FeishuOpsChatID()
	if chatID == "" {
		return
	}
	if !channelFeishuDedupe(&feishuDisableDedupe, channelError.ChannelId, feishuDisableDedupeWindow) {
		return
	}
	tag, _ := channelNotifyMeta(channelError.ChannelId)
	lines := []string{
		fmt.Sprintf("渠道：%s (#%d)", channelError.ChannelName, channelError.ChannelId),
	}
	if tag != "" {
		lines = append(lines, fmt.Sprintf("标签：%s", tag))
	}
	lines = append(lines,
		fmt.Sprintf("原因：%s", reason),
		fmt.Sprintf("时间：%s", time.Now().Format("2006-01-02 15:04:05")),
		"可在控制台重新启用",
	)
	gopool.Go(func() {
		if err := common.SendFeishuCard(chatID, "⚠️ 渠道已自动禁用", lines); err != nil {
			common.SysLog(fmt.Sprintf("飞书禁用通知失败 channel #%d: %v", channelError.ChannelId, err))
		}
	})
}

func notifyFeishuChannelEnabled(channelID int, channelName string) {
	chatID := common.FeishuOpsChatID()
	if chatID == "" {
		return
	}
	if !channelFeishuDedupe(&feishuEnableDedupe, channelID, feishuEnableDedupeWindow) {
		return
	}
	tag, _ := channelNotifyMeta(channelID)
	lines := []string{
		fmt.Sprintf("渠道：%s (#%d)", channelName, channelID),
	}
	if tag != "" {
		lines = append(lines, fmt.Sprintf("标签：%s", tag))
	}
	lines = append(lines,
		"原因：自动恢复探针测试通过",
		fmt.Sprintf("时间：%s", time.Now().Format("2006-01-02 15:04:05")),
		"已重新启用渠道",
	)
	gopool.Go(func() {
		if err := common.SendFeishuCard(chatID, "✅ 渠道已自动启用", lines); err != nil {
			common.SysLog(fmt.Sprintf("飞书启用通知失败 channel #%d: %v", channelID, err))
		}
	})
}

func NotifyChannelDisableProbePassed(channelError types.ChannelError, reason string, latencyMs int64) {
	chatID := common.FeishuOpsChatID()
	if chatID == "" {
		return
	}
	if !channelFeishuDedupe(&feishuProbePassDedupe, channelError.ChannelId, feishuProbePassDedupeWindow) {
		return
	}
	tag, _ := channelNotifyMeta(channelError.ChannelId)
	lines := []string{
		fmt.Sprintf("渠道：%s (#%d)", channelError.ChannelName, channelError.ChannelId),
	}
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
		notifyFeishuChannelDisabled(channelError, reason)
	}
}

func EnableChannel(channelId int, usingKey string, channelName string) {
	success := model.UpdateChannelStatus(channelId, usingKey, common.ChannelStatusEnabled, "")
	if success {
		subject := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		NotifyRootUser(formatNotifyType(channelId, common.ChannelStatusEnabled), subject, content)
		notifyFeishuChannelEnabled(channelId, channelName)
	}
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
