package operation_setting

import (
	"os"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type MonitorSetting struct {
	AutoTestChannelEnabled            bool    `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes            float64 `json:"auto_test_channel_minutes"`
	ChannelTestStreamRetryEnabled     bool    `json:"channel_test_stream_retry_enabled"`
	ChannelTestStreamRetryStatusCodes string  `json:"channel_test_stream_retry_status_codes"`
	ChannelTestStreamRetryKeywords    string  `json:"channel_test_stream_retry_keywords"`
}

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:            false,
	AutoTestChannelMinutes:            10,
	ChannelTestStreamRetryEnabled:     true,
	ChannelTestStreamRetryStatusCodes: "400",
	ChannelTestStreamRetryKeywords:    "stream must be set to true",
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

func ParseMonitorKeywords(input string) []string {
	input = strings.NewReplacer("\r\n", "\n", "\r", "\n").Replace(input)
	parts := strings.Split(input, "\n")
	keywords := make([]string, 0, len(parts))
	for _, part := range parts {
		keyword := strings.ToLower(strings.TrimSpace(part))
		if keyword == "" {
			continue
		}
		keywords = append(keywords, keyword)
	}
	return keywords
}

func ShouldRetryChannelTestWithStream(statusCode int, errText string) bool {
	setting := GetMonitorSetting()
	if !setting.ChannelTestStreamRetryEnabled {
		return false
	}
	ranges, err := ParseHTTPStatusCodeRanges(setting.ChannelTestStreamRetryStatusCodes)
	if err != nil || !shouldMatchStatusCodeRanges(ranges, statusCode) {
		return false
	}
	lowerErrText := strings.ToLower(strings.TrimSpace(errText))
	if lowerErrText == "" {
		return false
	}
	for _, keyword := range ParseMonitorKeywords(setting.ChannelTestStreamRetryKeywords) {
		if strings.Contains(lowerErrText, keyword) {
			return true
		}
	}
	return false
}
