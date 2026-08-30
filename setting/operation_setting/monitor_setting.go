package operation_setting

import (
	"fmt"
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/setting/config"
)

type MonitorSetting struct {
	AutoTestChannelEnabled bool    `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes float64 `json:"auto_test_channel_minutes"`
	ChannelTestMode        string  `json:"channel_test_mode"`
	ChannelTestConcurrency int     `json:"channel_test_concurrency"`
	// MultiKeyTestConcurrency controls how many keys in a multi-key channel are tested in parallel
	MultiKeyTestConcurrency int `json:"multi_key_test_concurrency"`
}

const (
	ChannelTestModeScheduledAll    = "scheduled_all"
	ChannelTestModeAutoBanOnly     = "auto_ban_only"
	ChannelTestModePassiveRecovery = "passive_recovery"

	ChannelTestConcurrencyOptionKey    = "monitor_setting.channel_test_concurrency"
	DefaultChannelTestConcurrency      = 1
	MaxChannelTestConcurrency          = 32
	MultiKeyTestConcurrencyOptionKey   = "monitor_setting.multi_key_test_concurrency"
	DefaultMultiKeyTestConcurrency     = 1
	MaxMultiKeyTestConcurrency         = 16
)

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:   false,
	AutoTestChannelMinutes:   10,
	ChannelTestMode:          ChannelTestModeScheduledAll,
	ChannelTestConcurrency:   DefaultChannelTestConcurrency,
	MultiKeyTestConcurrency:  DefaultMultiKeyTestConcurrency,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("monitor_setting", &monitorSetting)
}

func GetMonitorSetting() *MonitorSetting {
	if os.Getenv("CHANNEL_TEST_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_TEST_FREQUENCY"))
		if err == nil && frequency > 0 {
			monitorSetting.AutoTestChannelEnabled = true
			monitorSetting.AutoTestChannelMinutes = float64(frequency)
			monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
		}
	}
	if enabled, ok := os.LookupEnv("CHANNEL_TEST_ENABLED"); ok {
		parsed, err := strconv.ParseBool(enabled)
		if err == nil {
			monitorSetting.AutoTestChannelEnabled = parsed
		}
	}
	switch monitorSetting.ChannelTestMode {
	case ChannelTestModeAutoBanOnly, ChannelTestModePassiveRecovery:
	default:
		monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
	}
	monitorSetting.ChannelTestConcurrency = NormalizeChannelTestConcurrency(monitorSetting.ChannelTestConcurrency)
	monitorSetting.MultiKeyTestConcurrency = NormalizeMultiKeyTestConcurrency(monitorSetting.MultiKeyTestConcurrency)
	return &monitorSetting
}

// GetMultiKeyTestConcurrency returns the configured concurrency for multi-key channel testing
func GetMultiKeyTestConcurrency() int {
	return monitorSetting.MultiKeyTestConcurrency
}

func NormalizeChannelTestConcurrency(concurrency int) int {
	if concurrency < 1 {
		return DefaultChannelTestConcurrency
	}
	if concurrency > MaxChannelTestConcurrency {
		return MaxChannelTestConcurrency
	}
	return concurrency
}

func ValidateChannelTestConcurrency(value string) error {
	concurrency, err := strconv.Atoi(value)
	if err != nil || concurrency < 1 || concurrency > MaxChannelTestConcurrency {
		return fmt.Errorf("channel test concurrency must be between 1 and %d", MaxChannelTestConcurrency)
	}
	return nil
}

func NormalizeMultiKeyTestConcurrency(concurrency int) int {
	if concurrency < 1 {
		return DefaultMultiKeyTestConcurrency
	}
	if concurrency > MaxMultiKeyTestConcurrency {
		return MaxMultiKeyTestConcurrency
	}
	return concurrency
}

func ValidateMultiKeyTestConcurrency(value string) error {
	concurrency, err := strconv.Atoi(value)
	if err != nil || concurrency < 1 || concurrency > MaxMultiKeyTestConcurrency {
		return fmt.Errorf("multi-key test concurrency must be between 1 and %d", MaxMultiKeyTestConcurrency)
	}
	return nil
}
