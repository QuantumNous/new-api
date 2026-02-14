package group_monitor

import (
	"github.com/QuantumNous/new-api/setting/config"
)

// GroupMonitorSetting 分组监控全局配置
type GroupMonitorSetting struct {
	Enabled      bool    `json:"enabled"`       // 全局开关
	IntervalMins float64 `json:"interval_mins"` // 探测间隔（分钟）
	TestModel    string  `json:"test_model"`    // 全局默认测试模型
	RetainDays   int     `json:"retain_days"`   // 日志保留天数
}

var groupMonitorSetting = GroupMonitorSetting{
	Enabled:      false,
	IntervalMins: 5,
	TestModel:    "claude-3-5-haiku-20241022",
	RetainDays:   7,
}

func init() {
	config.GlobalConfig.Register("group_monitor_setting", &groupMonitorSetting)
}

func GetGroupMonitorSetting() *GroupMonitorSetting {
	return &groupMonitorSetting
}
