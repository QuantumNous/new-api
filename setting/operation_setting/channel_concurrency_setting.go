package operation_setting

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	defaultChannelConcurrencySlotTTLMinutes = 30
	defaultChannelConcurrencyWaitTimeoutMS  = 5000
	defaultChannelConcurrencyWaitIntervalMS = 100
	defaultChannelConcurrencyCooldownSecs   = 30

	maxChannelConcurrencySlotTTLMinutes       = 24 * 60
	maxChannelConcurrencyWaitTimeoutMS        = 60 * 1000
	maxChannelConcurrencyWaitIntervalMS       = 5 * 1000
	maxChannelConcurrencyCooldownSeconds      = 60 * 60
	maxChannelConcurrencyMaxWaitingPerChannel = 10000
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

var channelConcurrencySettingMu sync.RWMutex

func init() {
	config.GlobalConfig.Register("channel_concurrency_setting", &channelConcurrencySetting)
}

func (s *ChannelConcurrencySetting) LockConfig() {
	channelConcurrencySettingMu.Lock()
}

func (s *ChannelConcurrencySetting) UnlockConfig() {
	channelConcurrencySettingMu.Unlock()
}

func (s *ChannelConcurrencySetting) RLockConfig() {
	channelConcurrencySettingMu.RLock()
}

func (s *ChannelConcurrencySetting) RUnlockConfig() {
	channelConcurrencySettingMu.RUnlock()
}

func GetChannelConcurrencySetting() ChannelConcurrencySetting {
	channelConcurrencySettingMu.RLock()
	defer channelConcurrencySettingMu.RUnlock()
	return channelConcurrencySetting
}

func SetChannelConcurrencySettingForTest(setting ChannelConcurrencySetting) {
	channelConcurrencySettingMu.Lock()
	defer channelConcurrencySettingMu.Unlock()
	channelConcurrencySetting = setting
}

func GetChannelConcurrencySlotTTLMinutes() int {
	channelConcurrencySettingMu.RLock()
	defer channelConcurrencySettingMu.RUnlock()
	if channelConcurrencySetting.SlotTTLMinutes <= 0 || channelConcurrencySetting.SlotTTLMinutes > maxChannelConcurrencySlotTTLMinutes {
		return defaultChannelConcurrencySlotTTLMinutes
	}
	return channelConcurrencySetting.SlotTTLMinutes
}

func GetChannelConcurrencySlotTTL() time.Duration {
	return time.Duration(GetChannelConcurrencySlotTTLMinutes()) * time.Minute
}

func IsChannelConcurrencyWaitEnabled() bool {
	channelConcurrencySettingMu.RLock()
	defer channelConcurrencySettingMu.RUnlock()
	return channelConcurrencySetting.WaitEnabled
}

func GetChannelConcurrencyWaitTimeout() time.Duration {
	channelConcurrencySettingMu.RLock()
	defer channelConcurrencySettingMu.RUnlock()
	if channelConcurrencySetting.WaitTimeoutMS <= 0 || channelConcurrencySetting.WaitTimeoutMS > maxChannelConcurrencyWaitTimeoutMS {
		return time.Duration(defaultChannelConcurrencyWaitTimeoutMS) * time.Millisecond
	}
	return time.Duration(channelConcurrencySetting.WaitTimeoutMS) * time.Millisecond
}

func GetChannelConcurrencyWaitInterval() time.Duration {
	channelConcurrencySettingMu.RLock()
	defer channelConcurrencySettingMu.RUnlock()
	if channelConcurrencySetting.WaitIntervalMS <= 0 || channelConcurrencySetting.WaitIntervalMS > maxChannelConcurrencyWaitIntervalMS {
		return time.Duration(defaultChannelConcurrencyWaitIntervalMS) * time.Millisecond
	}
	return time.Duration(channelConcurrencySetting.WaitIntervalMS) * time.Millisecond
}

func GetChannelConcurrencyMaxWaiting(maxConcurrency int) int {
	channelConcurrencySettingMu.RLock()
	defer channelConcurrencySettingMu.RUnlock()
	maxWaiting := 1
	if channelConcurrencySetting.MaxWaitingPerChannel > 0 {
		maxWaiting = channelConcurrencySetting.MaxWaitingPerChannel
	} else if maxConcurrency > 0 {
		maxWaiting = maxConcurrency
	}
	if maxWaiting > maxChannelConcurrencyMaxWaitingPerChannel {
		return maxChannelConcurrencyMaxWaitingPerChannel
	}
	return maxWaiting
}

func IsChannelConcurrencyCooldownEnabled() bool {
	channelConcurrencySettingMu.RLock()
	defer channelConcurrencySettingMu.RUnlock()
	return channelConcurrencySetting.CooldownEnabled
}

func GetChannelConcurrencyCooldown() time.Duration {
	channelConcurrencySettingMu.RLock()
	defer channelConcurrencySettingMu.RUnlock()
	if channelConcurrencySetting.CooldownSeconds <= 0 || channelConcurrencySetting.CooldownSeconds > maxChannelConcurrencyCooldownSeconds {
		return time.Duration(defaultChannelConcurrencyCooldownSecs) * time.Second
	}
	return time.Duration(channelConcurrencySetting.CooldownSeconds) * time.Second
}
