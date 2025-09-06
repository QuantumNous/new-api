package operation_setting

import (
	"one-api/setting/config"
	"os"
	"strconv"
)

type MonitorSetting struct {
	AutoTestChannelEnabled bool `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes int  `json:"auto_test_channel_minutes"`
}

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled: false,
	AutoTestChannelMinutes: 10,
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
			monitorSetting.AutoTestChannelMinutes = frequency
		}
	}
	return &monitorSetting
}
