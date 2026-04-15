package operation_setting

import (
	"os"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type MonitorSetting struct {
	AutoTestChannelEnabled     bool    `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes     float64 `json:"auto_test_channel_minutes"`
	AutoTestChannelExcludedIds string  `json:"auto_test_channel_excluded_ids"`
}

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:     false,
	AutoTestChannelMinutes:     10,
	AutoTestChannelExcludedIds: "",
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
	return &monitorSetting
}

func (s *MonitorSetting) GetAutoTestChannelExcludedIDMap() map[int]bool {
	excludedIds := make(map[int]bool)
	if s == nil || strings.TrimSpace(s.AutoTestChannelExcludedIds) == "" {
		return excludedIds
	}
	parts := strings.FieldsFunc(s.AutoTestChannelExcludedIds, func(r rune) bool {
		return r == ',' || r == '\uFF0C' || r == '\n' || r == '\r' || r == '\t' || r == ' '
	})
	for _, part := range parts {
		id, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil || id <= 0 {
			continue
		}
		excludedIds[id] = true
	}
	return excludedIds
}
