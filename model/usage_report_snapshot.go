package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// 快照周期类型
const (
	ReportPeriodDaily   = "daily"
	ReportPeriodWeekly  = "weekly"
	ReportPeriodMonthly = "monthly"
)

// 快照维度类型
const (
	ReportScopePlatform  = "platform"  // 平台总览
	ReportScopeAccount   = "account"   // 账号(个人用户+组织类智能体账号)
	ReportScopeToken     = "token"     // Token 维度
	ReportScopeModel     = "model"     // 模型趋势
	ReportScopeAnomaly   = "anomaly"   // 异常预警
	ReportScopeOrgDept   = "department" // 部门维度(预留,第一版不做推送)
)

// 接收人类型
const (
	ReceiverTypePersonalUser = "personal_user" // 个人用户本人
	ReceiverTypeAgentOwner   = "agent_owner"   // 组织类智能体账号负责人
	ReceiverTypeNone         = "none"          // 无接收人
)

// 同步/推送状态
const (
	SyncStatusPending = "pending"
	SyncStatusSuccess = "success"
	SyncStatusFailed  = "failed"
)

// UsageReportSnapshot 用量报表快照（日/周/月聚合结果）
type UsageReportSnapshot struct {
	Id        int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// --- 周期 ---
	PeriodType  string `json:"period_type" gorm:"column:period_type;type:varchar(16);default:'';index:idx_report_period"`
	PeriodStart int64  `json:"period_start" gorm:"column:period_start;index:idx_report_period"`
	PeriodEnd   int64  `json:"period_end" gorm:"column:period_end"`
	PeriodLabel string `json:"period_label" gorm:"column:period_label;type:varchar(64);default:''"`

	// --- 维度 ---
	ScopeType   string `json:"scope_type" gorm:"column:scope_type;type:varchar(32);default:'';index:idx_report_scope"`
	AccountType *int   `json:"account_type" gorm:"column:account_type;type:int;index"` // 0=个人,1=组织类智能体,nullable

	// --- 账号信息 ---
	UserId      int    `json:"user_id" gorm:"column:user_id;index"`
	Username    string `json:"username" gorm:"column:username;type:varchar(64);default:'';index"`
	DisplayName string `json:"display_name" gorm:"column:display_name;type:varchar(64);default:''"`
	UserGroup   string `json:"user_group" gorm:"column:user_group;type:varchar(64);default:''"`

	// --- 接收人(用于多维表格人员字段和自动化推送) ---
	ReceiverType           string `json:"receiver_type" gorm:"column:receiver_type;type:varchar(32);default:''"`
	ReceiverName           string `json:"receiver_name" gorm:"column:receiver_name;type:varchar(255);default:''"`
	ReceiverFeishuOpenId   string `json:"receiver_feishu_open_id" gorm:"column:receiver_feishu_open_id;type:varchar(128);default:''"`
	ReceiverFeishuUserId   string `json:"receiver_feishu_user_id" gorm:"column:receiver_feishu_user_id;type:varchar(128);default:''"`
	ReceiverDepartmentId   string `json:"receiver_department_id" gorm:"column:receiver_department_id;type:varchar(128);default:''"`
	ReceiverDepartmentName string `json:"receiver_department_name" gorm:"column:receiver_department_name;type:varchar(255);default:''"`

	// --- 组织信息 ---
	OrgLevel1Name string `json:"org_level1_name" gorm:"column:org_level1_name;type:varchar(255);default:''"`
	OrgLevel2Name string `json:"org_level2_name" gorm:"column:org_level2_name;type:varchar(255);default:''"`
	OrgPath       string `json:"org_path" gorm:"column:org_path;type:text"`

	// --- Token/Model 维度 ---
	TokenId   int    `json:"token_id" gorm:"column:token_id;default:0;index"`
	TokenName string `json:"token_name" gorm:"column:token_name;type:varchar(255);default:''"`
	UseGroup  string `json:"use_group" gorm:"column:use_group;type:varchar(64);default:''"`
	ModelName string `json:"model_name" gorm:"column:model_name;type:varchar(255);default:'';index"`

	// --- 用量 ---
	RequestCount int `json:"request_count" gorm:"column:request_count;default:0"`
	TokenUsed    int `json:"token_used" gorm:"column:token_used;default:0"`
	Quota        int `json:"quota" gorm:"column:quota;default:0"`
	QuotaUSD     float64 `json:"quota_usd" gorm:"column:quota_usd;default:0"`
	QuotaCNY     float64 `json:"quota_cny" gorm:"column:quota_cny;default:0"`

	// --- 环比 ---
	PreviousRequestCount     int     `json:"previous_request_count" gorm:"column:previous_request_count;default:0"`
	PreviousTokenUsed        int     `json:"previous_token_used" gorm:"column:previous_token_used;default:0"`
	PreviousQuota            int     `json:"previous_quota" gorm:"column:previous_quota;default:0"`
	RequestCountGrowthRate   float64 `json:"request_count_growth_rate" gorm:"column:request_count_growth_rate;default:0"`
	TokenGrowthRate          float64 `json:"token_growth_rate" gorm:"column:token_growth_rate;default:0"`
	QuotaGrowthRate          float64 `json:"quota_growth_rate" gorm:"column:quota_growth_rate;default:0"`

	// --- 平台总览专用(platform scope) ---
	TotalUsers         int `json:"total_users" gorm:"column:total_users;default:0"`
	ActiveUsers        int `json:"active_users" gorm:"column:active_users;default:0"`
	InactiveUsers      int `json:"inactive_users" gorm:"column:inactive_users;default:0"`
	NewUsers           int `json:"new_users" gorm:"column:new_users;default:0"`
	BoundFeishuUsers   int `json:"bound_feishu_users" gorm:"column:bound_feishu_users;default:0"`
	UnboundFeishuUsers int `json:"unbound_feishu_users" gorm:"column:unbound_feishu_users;default:0"`
	TotalOrgAccounts   int `json:"total_org_accounts" gorm:"column:total_org_accounts;default:0"`
	ActiveOrgAccounts  int `json:"active_org_accounts" gorm:"column:active_org_accounts;default:0"`
	NewOrgAccounts     int `json:"new_org_accounts" gorm:"column:new_org_accounts;default:0"`

	// --- 模型趋势专用 ---
	UsageShare           float64 `json:"usage_share" gorm:"column:usage_share;default:0"`
	RankNo               int     `json:"rank_no" gorm:"column:rank_no;default:0"`
	Rolling7dAvgQuota    float64 `json:"rolling_7d_avg_quota" gorm:"column:rolling_7d_avg_quota;default:0"`
	Rolling30dAvgQuota   float64 `json:"rolling_30d_avg_quota" gorm:"column:rolling_30d_avg_quota;default:0"`
	ConsecutiveGrowthDays int    `json:"consecutive_growth_days" gorm:"column:consecutive_growth_days;default:0"`
	IsPurchaseWarning    bool    `json:"is_purchase_warning" gorm:"column:is_purchase_warning;default:false"`
	PurchaseWarningReason string `json:"purchase_warning_reason" gorm:"column:purchase_warning_reason;type:varchar(500);default:''"`

	// --- 异常与预警 ---
	IsAnomaly      bool   `json:"is_anomaly" gorm:"column:is_anomaly;default:false;index"`
	AnomalyType    string `json:"anomaly_type" gorm:"column:anomaly_type;type:varchar(64);default:''"`
	AnomalyReason  string `json:"anomaly_reason" gorm:"column:anomaly_reason;type:varchar(500);default:''"`
	WarningLevel   string `json:"warning_level" gorm:"column:warning_level;type:varchar(32);default:''"`
	SuggestedAction string `json:"suggested_action" gorm:"column:suggested_action;type:varchar(500);default:''"`

	// --- 同步/推送状态 ---
	BaseSyncedAt      *time.Time `json:"base_synced_at" gorm:"column:base_synced_at"`
	BaseSyncStatus    string     `json:"base_sync_status" gorm:"column:base_sync_status;type:varchar(32);default:''"`
	BaseSyncError     string     `json:"base_sync_error" gorm:"column:base_sync_error;type:varchar(500);default:''"`
	AdminGroupPushedAt *time.Time `json:"admin_group_pushed_at" gorm:"column:admin_group_pushed_at"`
	AdminGroupPushStatus string  `json:"admin_group_push_status" gorm:"column:admin_group_push_status;type:varchar(32);default:''"`
	AdminGroupPushError string   `json:"admin_group_push_error" gorm:"column:admin_group_push_error;type:varchar(500);default:''"`
}

func (UsageReportSnapshot) TableName() string {
	return "usage_report_snapshots"
}

// 唯一标识键（用于幂等: 同周期+同维度+同主体不重复生成）
type ReportSnapshotKey struct {
	PeriodType string
	PeriodStart int64
	ScopeType  string
	UserId     int
	TokenId    int
	ModelName  string
}

// DeleteReportSnapshotsByPeriod 删除指定周期+维度的快照（用于覆盖式重算）
func DeleteReportSnapshotsByPeriod(periodType string, periodStart int64, scopeType string) error {
	return DB.Where("period_type = ? AND period_start = ? AND scope_type = ?",
		periodType, periodStart, scopeType).Delete(&UsageReportSnapshot{}).Error
}

// BatchCreateReportSnapshots 批量写入快照
func BatchCreateReportSnapshots(items []*UsageReportSnapshot) error {
	if len(items) == 0 {
		return nil
	}
	return DB.CreateInBatches(items, 500).Error
}

// GetReportSnapshots 查询指定周期+维度的快照
func GetReportSnapshots(periodType string, periodStart int64, scopeType string) ([]*UsageReportSnapshot, error) {
	var items []*UsageReportSnapshot
	err := DB.Where("period_type = ? AND period_start = ? AND scope_type = ?",
		periodType, periodStart, scopeType).
		Order("quota desc, token_used desc").
		Find(&items).Error
	return items, err
}

// GetPlatformSnapshot 获取平台总览快照
func GetPlatformSnapshot(periodType string, periodStart int64) (*UsageReportSnapshot, error) {
	var item UsageReportSnapshot
	err := DB.Where("period_type = ? AND period_start = ? AND scope_type = ?",
		periodType, periodStart, ReportScopePlatform).First(&item).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// UpdateReportSnapshotSyncStatus 更新多维表格同步状态
func UpdateReportSnapshotSyncStatus(id int64, status, errMsg string) {
	now := time.Now()
	updates := map[string]interface{}{
		"base_sync_status": status,
		"updated_at":       now,
	}
	if status == SyncStatusSuccess {
		updates["base_synced_at"] = now
		updates["base_sync_error"] = ""
	} else {
		updates["base_sync_error"] = errMsg
	}
	DB.Model(&UsageReportSnapshot{}).Where("id = ?", id).Updates(updates)
}

// UpdateReportSnapshotAdminPushStatus 更新管理群推送状态
func UpdateReportSnapshotAdminPushStatus(id int64, status, errMsg string) {
	now := time.Now()
	updates := map[string]interface{}{
		"admin_group_push_status": status,
		"updated_at":              now,
	}
	if status == SyncStatusSuccess {
		updates["admin_group_pushed_at"] = now
		updates["admin_group_push_error"] = ""
	} else {
		updates["admin_group_push_error"] = errMsg
	}
	DB.Model(&UsageReportSnapshot{}).Where("id = ?", id).Updates(updates)
}

// 计算环比增长率（处理除零）
func GrowthRate(current, previous int) float64 {
	if previous <= 0 {
		if current <= 0 {
			return 0
		}
		return 100 // 前值为0且有用量,记为100%
	}
	return (float64(current-previous) / float64(previous)) * 100
}

// 抑制未使用警告
var _ = common.GetTimestamp