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
	ChannelTestMode              string  `json:"channel_test_mode"`
	AutoTestChannelAllowedTypes  []int   `json:"auto_test_channel_allowed_types"`
	AutoTestChannelIgnoredTypes  []int   `json:"auto_test_channel_ignored_types"`
	DingTalkAlertEnabled         bool    `json:"dingtalk_alert_enabled"`
	DingTalkAlertWebhookURL      string  `json:"dingtalk_alert_webhook_url"`
	DingTalkAlertSecret          string  `json:"dingtalk_alert_secret"`
	DingTalkAlertCooldownMinutes float64 `json:"dingtalk_alert_cooldown_minutes"`
	AIAnalysisAPIKey             string  `json:"ai_analysis_api_key"`
	AIAnalysisBaseURL            string  `json:"ai_analysis_base_url"`
	AIAnalysisModel              string  `json:"ai_analysis_model"`
	// TemporaryChannelSpendThresholdUSD 单模型在临时渠道上的累计消耗（美元）超过此值即预警，
	// 驱动供应链侧寻找更便宜的直连资源。<=0 关闭。默认 200。
	TemporaryChannelSpendThresholdUSD float64 `json:"temporary_channel_spend_threshold_usd"`
}

const (
	ChannelTestModeScheduledAll    = "scheduled_all"
	ChannelTestModePassiveRecovery = "passive_recovery"
)

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:            false,
	AutoTestChannelMinutes:            10,
	ChannelTestMode:                   ChannelTestModeScheduledAll,
	AutoTestChannelAllowedTypes:       []int{},
	AutoTestChannelIgnoredTypes:       []int{},
	DingTalkAlertEnabled:              false,
	DingTalkAlertWebhookURL:           "",
	DingTalkAlertSecret:               "",
	DingTalkAlertCooldownMinutes:      60,
	AIAnalysisAPIKey:                  "",
	AIAnalysisBaseURL:                 DefaultMonitorAIAnalysisBaseURL,
	AIAnalysisModel:                   DefaultMonitorAIAnalysisModelName,
	TemporaryChannelSpendThresholdUSD: 200,
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
	if monitorSetting.ChannelTestMode != ChannelTestModePassiveRecovery {
		monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
	}
	return &monitorSetting
}

func GetMonitorAIAnalysisAPIKey() string {
	return strings.TrimSpace(GetMonitorSetting().AIAnalysisAPIKey)
}

func GetMonitorAIAnalysisBaseURL() string {
	return getMonitorStringWithEnvFallback(GetMonitorSetting().AIAnalysisBaseURL, DefaultMonitorAIAnalysisBaseURL, MonitorAIAnalysisBaseURLEnv)
}

func GetMonitorAIAnalysisModel() string {
	return getMonitorStringWithEnvFallback(GetMonitorSetting().AIAnalysisModel, DefaultMonitorAIAnalysisModelName, MonitorAIAnalysisModelEnv)
}

func getMonitorStringWithEnvFallback(configValue string, defaultValue string, envName string) string {
	value := strings.TrimSpace(configValue)
	if value != "" && value != defaultValue {
		return value
	}
	if envValue := strings.TrimSpace(os.Getenv(envName)); envValue != "" {
		return envValue
	}
	if value != "" {
		return value
	}
	return defaultValue
}
