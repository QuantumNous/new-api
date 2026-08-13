package service

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// channelDisableWindow / channelDisableThreshold / channelDisableMinUsers
// implement a windowed, multi-user gate before an upstream error may
// auto-disable a channel. F-24: without a gate, a single request that hits an
// upstream quota/rate-limit message (e.g. "You exceeded your current quota")
// disables the whole channel for every user. Requiring several error events
// from at least two distinct users inside a short window makes accidental or
// single-account triggered disables materially harder while still catching
// genuinely broken channels.
const (
	channelDisableErrorWindow      = 60 * time.Second
	channelDisableErrorThreshold   = 3
	channelDisableMinDistinctUsers = 2
)

type channelErrorStreak struct {
	mu          sync.Mutex
	windowStart time.Time
	users       map[int]struct{}
	count       int
}

var channelErrorStreaks sync.Map // channelID int -> *channelErrorStreak

// RecordChannelErrorAndShouldDisable records an auto-ban-worthy error for a
// channel and reports whether the disable threshold has been crossed.
func RecordChannelErrorAndShouldDisable(channelID int, userID int) bool {
	if userID <= 0 {
		// Unauthenticated/background errors: treat as one distinct pseudo-user
		// so a genuinely broken channel still converges with enough events.
		userID = -1
	}
	now := time.Now()
	raw, _ := channelErrorStreaks.LoadOrStore(channelID, &channelErrorStreak{
		windowStart: now,
		users:       make(map[int]struct{}),
	})
	s := raw.(*channelErrorStreak)
	s.mu.Lock()
	defer s.mu.Unlock()
	if now.Sub(s.windowStart) > channelDisableErrorWindow {
		s.windowStart = now
		s.users = make(map[int]struct{})
		s.count = 0
	}
	s.users[userID] = struct{}{}
	s.count++
	if s.count >= channelDisableErrorThreshold && len(s.users) >= channelDisableMinDistinctUsers {
		channelErrorStreaks.Delete(channelID)
		return true
	}
	return false
}

// ClearChannelErrorStreak resets the disable gate for a channel after a
// successful request.
func ClearChannelErrorStreak(channelID int) {
	channelErrorStreaks.Delete(channelID)
}

func formatNotifyType(channelId int, status int) string {
	return fmt.Sprintf("%s_%d_%d", dto.NotifyTypeChannelUpdate, channelId, status)
}

// disable & notify
func DisableChannel(channelError types.ChannelError, reason string) {
	common.SysLog(fmt.Sprintf("通道「%s」（#%d）发生错误，准备禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, common.LocalLogPreview(reason)))

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
