package operation_setting

import (
	"os"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	MonitorAIAnalysisBaseURLEnv       = "MONITOR_AI_ANALYSIS_BASE_URL"
	MonitorAIAnalysisModelEnv         = "MONITOR_AI_ANALYSIS_MODEL"
	DefaultMonitorAIAnalysisBaseURL   = "https://api.openai.com/v1"
	DefaultMonitorAIAnalysisModelName = "gpt-5.4-mini"
)

type MonitorSetting struct {
	AutoTestChannelEnabled       bool    `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes       float64 `json:"auto_test_channel_minutes"`
	AutoTestChannelAllowedTypes  []int   `json:"auto_test_channel_allowed_types"`
	AutoTestChannelIgnoredTypes  []int   `json:"auto_test_channel_ignored_types"`
	DingTalkAlertEnabled         bool    `json:"dingtalk_alert_enabled"`
	DingTalkAlertWebhookURL      string  `json:"dingtalk_alert_webhook_url"`
	DingTalkAlertSecret          string  `json:"dingtalk_alert_secret"`
	DingTalkAlertCooldownMinutes float64 `json:"dingtalk_alert_cooldown_minutes"`
	AIAnalysisAPIKey             string  `json:"ai_analysis_api_key"`
	AIAnalysisBaseURL            string  `json:"ai_analysis_base_url"`
	AIAnalysisModel              string  `json:"ai_analysis_model"`
}

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:       false,
	AutoTestChannelMinutes:       10,
	AutoTestChannelAllowedTypes:  []int{},
	AutoTestChannelIgnoredTypes:  []int{},
	DingTalkAlertEnabled:         false,
	DingTalkAlertWebhookURL:      "",
	DingTalkAlertSecret:          "",
	DingTalkAlertCooldownMinutes: 60,
	AIAnalysisAPIKey:             "",
	AIAnalysisBaseURL:            DefaultMonitorAIAnalysisBaseURL,
	AIAnalysisModel:              DefaultMonitorAIAnalysisModelName,
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

func GetMonitorAIAnalysisAPIKey() string {
	return strings.TrimSpace(GetMonitorSetting().AIAnalysisAPIKey)
}

func GetMonitorAIAnalysisBaseURL() string {
	baseURL := strings.TrimSpace(GetMonitorSetting().AIAnalysisBaseURL)
	if baseURL != "" {
		return baseURL
	}
	baseURL = strings.TrimSpace(os.Getenv(MonitorAIAnalysisBaseURLEnv))
	if baseURL != "" {
		return baseURL
	}
	return DefaultMonitorAIAnalysisBaseURL
}

func GetMonitorAIAnalysisModel() string {
	modelName := strings.TrimSpace(GetMonitorSetting().AIAnalysisModel)
	if modelName != "" {
		return modelName
	}
	modelName = strings.TrimSpace(os.Getenv(MonitorAIAnalysisModelEnv))
	if modelName != "" {
		return modelName
	}
	return DefaultMonitorAIAnalysisModelName
}
