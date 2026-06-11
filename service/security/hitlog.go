package security

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

// SecurityLogQueryParams 安全日志查询参数
type SecurityLogQueryParams struct {
	Page        int
	PageSize    int
	UserID      int
	Action      int
	RiskLevel   int
	ContentType int
}

// GetSecurityLogs 获取安全日志列表（通过 service 层）
func GetSecurityLogs(params SecurityLogQueryParams) ([]*model.SecurityHitLogWithDetails, int64, error) {
	var logs []*model.SecurityHitLogWithDetails
	var count int64

	db := model.DB.Model(&model.SecurityHitLog{}).
		Select("security_hit_logs.*, users.username as user_name, security_rules.name as rule_name, security_groups.name as group_name").
		Joins("LEFT JOIN users ON security_hit_logs.user_id = users.id").
		Joins("LEFT JOIN security_rules ON security_hit_logs.rule_id = security_rules.id").
		Joins("LEFT JOIN security_groups ON security_hit_logs.group_id = security_groups.id")

	if params.UserID > 0 {
		db = db.Where("security_hit_logs.user_id = ?", params.UserID)
	}
	if params.Action > 0 {
		db = db.Where("security_hit_logs.action = ?", params.Action)
	}
	if params.RiskLevel > 0 {
		db = db.Where("security_hit_logs.risk_level = ?", params.RiskLevel)
	}
	if params.ContentType > 0 {
		db = db.Where("security_hit_logs.content_type = ?", params.ContentType)
	}

	err := db.Count(&count).Error
	if err != nil {
		return nil, 0, err
	}

	err = db.Order("security_hit_logs.id DESC").
		Offset((params.Page - 1) * params.PageSize).
		Limit(params.PageSize).
		Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	return logs, count, nil
}

// ExportSecurityLogParams 安全日志导出参数
type ExportSecurityLogParams struct {
	Format      string
	UserID      int
	Action      int
	RiskLevel   int
	ContentType int
}

// GetSecurityLogsForExport 获取需要导出的安全日志
func GetSecurityLogsForExport(params ExportSecurityLogParams) ([]*model.SecurityHitLogWithDetails, error) {
	var logs []*model.SecurityHitLogWithDetails

	db := model.DB.Model(&model.SecurityHitLog{}).
		Select("security_hit_logs.*, users.username as user_name, security_rules.name as rule_name, security_groups.name as group_name").
		Joins("LEFT JOIN users ON security_hit_logs.user_id = users.id").
		Joins("LEFT JOIN security_rules ON security_hit_logs.rule_id = security_rules.id").
		Joins("LEFT JOIN security_groups ON security_hit_logs.group_id = security_groups.id")

	if params.UserID > 0 {
		db = db.Where("security_hit_logs.user_id = ?", params.UserID)
	}
	if params.Action > 0 {
		db = db.Where("security_hit_logs.action = ?", params.Action)
	}
	if params.RiskLevel > 0 {
		db = db.Where("security_hit_logs.risk_level = ?", params.RiskLevel)
	}
	if params.ContentType > 0 {
		db = db.Where("security_hit_logs.content_type = ?", params.ContentType)
	}

	err := db.Order("security_hit_logs.id DESC").Find(&logs).Error
	return logs, err
}

// FormatSecurityLogForExport 格式化日志为 CSV 行
type SecurityLogExportRow struct {
	ID              string
	RequestID       string
	Time            string
	UserName        string
	ModelName       string
	ContentType     string
	Action          string
	RiskLevel       string
	RiskScore       string
	RuleName        string
	GroupName       string
	IP              string
	MatchDetail     string
}

// ExportLogActionMap 动作映射
var ExportLogActionMap = map[int]string{
	constant.SecurityActionPass:  "Pass",
	constant.SecurityActionAlert: "Alert",
	constant.SecurityActionMask:  "Mask",
	constant.SecurityActionBlock: "Block",
	constant.SecurityActionReview: "Review",
}

// ExportLogRiskMap 风险等级映射
var ExportLogRiskMap = map[int]string{
	constant.SecurityRiskLevelLow:      "Low",
	constant.SecurityRiskLevelMedium:   "Medium",
	constant.SecurityRiskLevelHigh:     "High",
	constant.SecurityRiskLevelCritical: "Critical",
}

// ExportLogContentTypeMap 内容类型映射
var ExportLogContentTypeMap = map[int]string{
	constant.SecurityContentTypeRequest:  "Request",
	constant.SecurityContentTypeResponse: "Response",
}

// FormatLogRows 将日志格式化为导出行
func FormatLogRows(logs []*model.SecurityHitLogWithDetails) []SecurityLogExportRow {
	rows := make([]SecurityLogExportRow, 0, len(logs))
	for _, log := range logs {
		rows = append(rows, SecurityLogExportRow{
			ID:          fmt.Sprintf("%d", log.ID),
			RequestID:   log.RequestID,
			Time:        time.Unix(log.CreatedAt, 0).Format("2006-01-02 15:04:05"),
			UserName:    log.UserName,
			ModelName:   log.ModelName,
			ContentType: ExportLogContentTypeMap[log.ContentType],
			Action:      ExportLogActionMap[log.Action],
			RiskLevel:   ExportLogRiskMap[log.RiskLevel],
			RiskScore:   fmt.Sprintf("%d", log.RiskScore),
			RuleName:    log.RuleName,
			GroupName:   log.GroupName,
			IP:          log.IP,
			MatchDetail: log.MatchDetail,
		})
	}
	return rows
}
