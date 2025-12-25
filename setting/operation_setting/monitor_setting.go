package operation_setting

import (
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/setting/config"
)

type MonitorSetting struct {
	AutoTestChannelEnabled         bool    `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes         float64 `json:"auto_test_channel_minutes"`
	AutoTestDisabledChannelMinutes float64 `json:"auto_test_disabled_channel_minutes"`
}

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:         false,
	AutoTestChannelMinutes:         10,
	AutoTestDisabledChannelMinutes: 0,
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
		}
	}
	if os.Getenv("CHANNEL_TEST_DISABLED_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_TEST_DISABLED_FREQUENCY"))
		if err == nil && frequency > 0 {
			monitorSetting.AutoTestDisabledChannelMinutes = float64(frequency)
		}
	}
	return &monitorSetting
}
