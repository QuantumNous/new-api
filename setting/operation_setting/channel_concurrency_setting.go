package operation_setting

import (
	"time"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	defaultChannelConcurrencySlotTTLMinutes = 30
	defaultChannelConcurrencyWaitTimeoutMS  = 5000
	defaultChannelConcurrencyWaitIntervalMS = 100
	defaultChannelConcurrencyCooldownSecs   = 30
)

type ChannelConcurrencySetting struct {
	SlotTTLMinutes       int  `json:"slot_ttl_minutes"`
	WaitEnabled          bool `json:"wait_enabled"`
	WaitTimeoutMS        int  `json:"wait_timeout_ms"`
	WaitIntervalMS       int  `json:"wait_interval_ms"`
	MaxWaitingPerChannel int  `json:"max_waiting_per_channel"`
	CooldownEnabled      bool `json:"cooldown_enabled"`
	CooldownSeconds      int  `json:"cooldown_seconds"`
}

var channelConcurrencySetting = ChannelConcurrencySetting{
	SlotTTLMinutes:       defaultChannelConcurrencySlotTTLMinutes,
	WaitEnabled:          true,
	WaitTimeoutMS:        defaultChannelConcurrencyWaitTimeoutMS,
	WaitIntervalMS:       defaultChannelConcurrencyWaitIntervalMS,
	MaxWaitingPerChannel: 0,
	CooldownEnabled:      true,
	CooldownSeconds:      defaultChannelConcurrencyCooldownSecs,
}

func init() {
	config.GlobalConfig.Register("channel_concurrency_setting", &channelConcurrencySetting)
}

func GetChannelConcurrencySetting() *ChannelConcurrencySetting {
	return &channelConcurrencySetting
}

func GetChannelConcurrencySlotTTLMinutes() int {
	if channelConcurrencySetting.SlotTTLMinutes <= 0 {
		return defaultChannelConcurrencySlotTTLMinutes
	}
	return channelConcurrencySetting.SlotTTLMinutes
}

func GetChannelConcurrencySlotTTL() time.Duration {
	return time.Duration(GetChannelConcurrencySlotTTLMinutes()) * time.Minute
}

func IsChannelConcurrencyWaitEnabled() bool {
	return channelConcurrencySetting.WaitEnabled
}

func GetChannelConcurrencyWaitTimeout() time.Duration {
	if channelConcurrencySetting.WaitTimeoutMS <= 0 {
		return time.Duration(defaultChannelConcurrencyWaitTimeoutMS) * time.Millisecond
	}
	return time.Duration(channelConcurrencySetting.WaitTimeoutMS) * time.Millisecond
}

func GetChannelConcurrencyWaitInterval() time.Duration {
	if channelConcurrencySetting.WaitIntervalMS <= 0 {
		return time.Duration(defaultChannelConcurrencyWaitIntervalMS) * time.Millisecond
	}
	return time.Duration(channelConcurrencySetting.WaitIntervalMS) * time.Millisecond
}

func GetChannelConcurrencyMaxWaiting(maxConcurrency int) int {
	if channelConcurrencySetting.MaxWaitingPerChannel > 0 {
		return channelConcurrencySetting.MaxWaitingPerChannel
	}
	if maxConcurrency > 0 {
		return maxConcurrency
	}
	return 1
}

func IsChannelConcurrencyCooldownEnabled() bool {
	return channelConcurrencySetting.CooldownEnabled
}

func GetChannelConcurrencyCooldown() time.Duration {
	if channelConcurrencySetting.CooldownSeconds <= 0 {
		return time.Duration(defaultChannelConcurrencyCooldownSecs) * time.Second
	}
	return time.Duration(channelConcurrencySetting.CooldownSeconds) * time.Second
}
