package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type FeishuSettings struct {
	Enabled                         bool   `json:"enabled"`
	AppID                           string `json:"app_id"`
	AppSecret                       string `json:"app_secret"`
	DefaultGroup                    string `json:"default_group"`
	AuthPolicy                      string `json:"auth_policy"`
	AllowAdminManagePlaintextTokens bool   `json:"allow_admin_manage_plaintext_tokens"`
	InitWebhookSecret               string `json:"init_webhook_secret"`
	StatsBaseToken                  string `json:"stats_base_token"`

	// --- 用量报表推送配置 ---
	// 内部管理群 chat_id（后端推送平台日报/周报/月报）
	StatsAdminChatID string `json:"stats_admin_chat_id"`
	// 用量报表总开关
	UsageReportEnabled bool `json:"usage_report_enabled"`
	// 同步快照到多维表格开关
	UsageReportBaseSyncEnabled bool `json:"usage_report_base_sync_enabled"`
	// 管理推送任务写入开关（写入多维表格，由 Base 自动化决定推送目标）
	UsageReportAdminGroupPushEnabled bool `json:"usage_report_admin_group_push_enabled"`

	// --- 多维表格表ID（6张统一表，日/周/月共用，通过字段区分） ---
	ReportTableAccountID   string `json:"report_table_account_id"`
	ReportTableOrgID       string `json:"report_table_org_id"`
	ReportTablePlatformID  string `json:"report_table_platform_id"`
	ReportTableModelID     string `json:"report_table_model_id"`
	ReportTableAnomalyID   string `json:"report_table_anomaly_id"`
	ReportTableAdminPushID string `json:"report_table_admin_push_id"`

	// --- 异常/采购预警阈值(第一版规则型) ---
	AccountDailyQuotaThreshold         float64 `json:"account_daily_quota_threshold"`
	AccountGrowthRateThreshold         float64 `json:"account_growth_rate_threshold"`
	AccountRollingAvgMultiplier        float64 `json:"account_rolling_avg_multiplier"`
	ModelGrowthRateThreshold           float64 `json:"model_growth_rate_threshold"`
	ModelUsageShareThreshold           float64 `json:"model_usage_share_threshold"`
	ModelDailyQuotaThreshold           float64 `json:"model_daily_quota_threshold"`
	ModelConsecutiveGrowthDays         int     `json:"model_consecutive_growth_days"`
	PurchaseWarningUsageShareThreshold float64 `json:"purchase_warning_usage_share_threshold"`
	PurchaseWarningDailyQuotaThreshold float64 `json:"purchase_warning_daily_quota_threshold"`
}

var defaultFeishuSettings = FeishuSettings{
	DefaultGroup:                     "pending",
	AuthPolicy:                       "parallel",
	AllowAdminManagePlaintextTokens:  true,
	StatsBaseToken:                   "TYyybwhZKa5wzMsHGKdcGnm9nvg",
	UsageReportEnabled:               true,
	UsageReportBaseSyncEnabled:       true,
	UsageReportAdminGroupPushEnabled: true,
	ReportTableAccountID:             "tblhdpVWfwSg4U2W",
	ReportTableOrgID:                 "tblIZGhhYiTQcEs1",
	ReportTablePlatformID:            "tblmnSbza9Mf5tYH",
	ReportTableModelID:               "tblYBU0ItrLbxA3t",
	ReportTableAnomalyID:             "tblK7YrK0n97RkEg",
	ReportTableAdminPushID:           "tblVidLNFTD5nTyx",
	// 预警阈值默认值
	AccountGrowthRateThreshold:         200, // 200%
	AccountRollingAvgMultiplier:        3,
	ModelGrowthRateThreshold:           100, // 100%
	ModelUsageShareThreshold:           30,  // 30%
	ModelConsecutiveGrowthDays:         3,
	PurchaseWarningUsageShareThreshold: 35,
	PurchaseWarningDailyQuotaThreshold: 500, // USD
}

func init() {
	config.GlobalConfig.Register("feishu", &defaultFeishuSettings)
}

func GetFeishuSettings() *FeishuSettings {
	return &defaultFeishuSettings
}
