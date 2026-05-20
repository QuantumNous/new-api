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
	AutoTestChannelExcludedIDs string  `json:"auto_test_channel_excluded_ids"`
}

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:     false,
	AutoTestChannelMinutes:     10,
	AutoTestChannelExcludedIDs: "",
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

func ParseAutoTestChannelExcludedIDs(value string) map[int]struct{} {
	ids := make(map[int]struct{})
	for _, token := range strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r' || r == '\t' || r == ' '
	}) {
		id, err := strconv.Atoi(strings.TrimSpace(token))
		if err != nil || id <= 0 {
			continue
		}
		ids[id] = struct{}{}
	}
	return ids
}

func GetAutoTestChannelExcludedIDSet() map[int]struct{} {
	return ParseAutoTestChannelExcludedIDs(monitorSetting.AutoTestChannelExcludedIDs)
}
