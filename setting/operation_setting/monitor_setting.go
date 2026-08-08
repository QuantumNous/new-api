package operation_setting

import (
	"os"
	"strconv"
	"sync/atomic"

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

// monitorSetting 是注册给 ConfigManager 的写入目标，热更新会用反射原地改写它，
// 其中 ChannelTestMode 是 string（指针 + 长度的双字写入），随时可能处于中间状态。
//
// 读路径一律不得读取该变量，必须走 GetMonitorSetting() 返回的快照。
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled: false,
	AutoTestChannelMinutes: 10,
	ChannelTestMode:        ChannelTestModeScheduledAll,
}

// monitorSnapshot 持有一份对读者不可变的副本。MonitorSetting 全是标量字段，整体赋值即可完成拷贝。
var monitorSnapshot atomic.Pointer[MonitorSetting]

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("monitor_setting", &monitorSetting)
	refreshMonitorSetting()
}

// refreshMonitorSetting 重新套用环境变量覆盖、归一化测试模式，然后发布快照。
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
	snapshot := monitorSetting
	monitorSnapshot.Store(&snapshot)
}

// AfterConfigUpdate 实现 config.PostUpdater，在热更新写完字段后恢复 env 优先级、归一化并重新发布快照。
func (s *MonitorSetting) AfterConfigUpdate() {
	refreshMonitorSetting()
}

// GetMonitorSetting 返回当前配置的只读快照。返回值不得被调用方修改。
func GetMonitorSetting() *MonitorSetting {
	return monitorSnapshot.Load()
}
