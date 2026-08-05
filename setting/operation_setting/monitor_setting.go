package operation_setting

import (
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/setting/config"
)

type MonitorSetting struct {
	AutoTestChannelEnabled bool    `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes float64 `json:"auto_test_channel_minutes"`
	ChannelTestMode        string  `json:"channel_test_mode"`
}

const (
	ChannelTestModeScheduledAll    = "scheduled_all"
	ChannelTestModePassiveRecovery = "passive_recovery"
)

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled: false,
	AutoTestChannelMinutes: 10,
	ChannelTestMode:        ChannelTestModeScheduledAll,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("monitor_setting", &monitorSetting)
	refreshMonitorSetting()
}

// refreshMonitorSetting 重新套用环境变量覆盖并归一化测试模式。
//
// 环境变量的优先级高于数据库配置，而周期同步每次都会把数据库的值写回 monitorSetting，
// 因此这两步必须在每次配置写入后重新执行，否则 env 指定的值会被冲掉且不再恢复。
//
// 原先这两步放在 GetMonitorSetting 里，使一个 getter 变成了共享状态的写者：并发调用同一个
// 读取接口就会互相写同一个结构体，不需要任何配置更新参与。
func refreshMonitorSetting() {
	if frequency, err := strconv.Atoi(os.Getenv("CHANNEL_TEST_FREQUENCY")); err == nil && frequency > 0 {
		monitorSetting.AutoTestChannelEnabled = true
		monitorSetting.AutoTestChannelMinutes = float64(frequency)
		monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
	}
	if enabled, ok := os.LookupEnv("CHANNEL_TEST_ENABLED"); ok {
		if parsed, err := strconv.ParseBool(enabled); err == nil {
			monitorSetting.AutoTestChannelEnabled = parsed
		}
	}
	if monitorSetting.ChannelTestMode != ChannelTestModePassiveRecovery {
		monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
	}
}

// AfterConfigUpdate 实现 config.PostUpdater，在热更新写完字段后恢复 env 优先级并归一化。
func (s *MonitorSetting) AfterConfigUpdate() {
	refreshMonitorSetting()
}

// GetMonitorSetting 返回当前配置。该函数只读，不得修改 monitorSetting。
func GetMonitorSetting() *MonitorSetting {
	return &monitorSetting
}
