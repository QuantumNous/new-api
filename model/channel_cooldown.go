package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// 渠道 quota 冷却：上游返回余额/额度不足时，把渠道短暂移出选路候选，
// 避免坏渠道在恢复前持续吃首跳；冷却到期自动恢复，无需探活。
// 冷却期间每个冷却周期最多放行一次请求（兜底路径），天然起到被动探活作用。

var channelQuotaCooldowns sync.Map // channelId int -> time.Time（冷却截止时间）

var quotaCooldownDuration = time.Duration(common.GetEnvOrDefault("QUOTA_ERROR_COOLDOWN_SECONDS", 600)) * time.Second

// SetChannelQuotaCooldown 将渠道置入 quota 冷却。
func SetChannelQuotaCooldown(channelId int) {
	if channelId <= 0 || quotaCooldownDuration <= 0 {
		return
	}
	channelQuotaCooldowns.Store(channelId, time.Now().Add(quotaCooldownDuration))
	common.SysLog(fmt.Sprintf("channel #%d entered quota cooldown for %s", channelId, quotaCooldownDuration))
}

// IsChannelInQuotaCooldown 判断渠道是否处于冷却期，过期条目惰性清除。
func IsChannelInQuotaCooldown(channelId int) bool {
	value, ok := channelQuotaCooldowns.Load(channelId)
	if !ok {
		return false
	}
	until, ok := value.(time.Time)
	if !ok || time.Now().After(until) {
		channelQuotaCooldowns.Delete(channelId)
		return false
	}
	return true
}

// ClearChannelQuotaCooldown 主动解除冷却（渠道被人工启用/测试通过时调用）。
func ClearChannelQuotaCooldown(channelId int) {
	channelQuotaCooldowns.Delete(channelId)
}
