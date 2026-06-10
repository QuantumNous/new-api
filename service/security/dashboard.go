package security

import (
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// GetSecurityDashboard 获取完整看板数据
func GetSecurityDashboard(startTime, endTime int64) (*dto.SecurityDashboardResponse, error) {
	if endTime == 0 {
		endTime = time.Now().Unix()
	}
	if startTime == 0 {
		startTime = endTime - 7*24*3600 // 默认7天
	}

	response := &dto.SecurityDashboardResponse{}

	// 总检测数
	var totalDetections int64
	model.DB.Model(&model.SecurityHitLog{}).Where("created_at BETWEEN ? AND ?", startTime, endTime).Count(&totalDetections)
	response.Summary.TotalDetections = int(totalDetections)

	// 拦截数
	var totalInterceptions int64
	model.DB.Model(&model.SecurityHitLog{}).Where("created_at BETWEEN ? AND ? AND action = ?", startTime, endTime, constant.SecurityActionBlock).Count(&totalInterceptions)
	response.Summary.TotalInterceptions = int(totalInterceptions)

	// 告警数
	var totalAlerts int64
	model.DB.Model(&model.SecurityHitLog{}).Where("created_at BETWEEN ? AND ? AND action = ?", startTime, endTime, constant.SecurityActionAlert).Count(&totalAlerts)
	response.Summary.TotalAlerts = int(totalAlerts)

	// 今日检测数
	todayStart := time.Now().Truncate(24 * time.Hour).Unix()
	var todayDetections int64
	model.DB.Model(&model.SecurityHitLog{}).Where("created_at >= ?", todayStart).Count(&todayDetections)
	response.Summary.TodayDetections = int(todayDetections)

	// TOP 分类
	type CategoryCount struct {
		Category string
		Count    int64
	}
	var categoryCounts []CategoryCount
	model.DB.Model(&model.SecurityHitLog{}).
		Select("security_groups.name as category, COUNT(*) as count").
		Joins("LEFT JOIN security_groups ON security_hit_logs.group_id = security_groups.id").
		Where("security_hit_logs.created_at BETWEEN ? AND ?", startTime, endTime).
		Group("security_hit_logs.group_id, security_groups.name").
		Order("count DESC").
		Limit(10).
		Scan(&categoryCounts)
	for _, c := range categoryCounts {
		response.TopCategories = append(response.TopCategories, struct {
			Category string `json:"category"`
			Count    int    `json:"count"`
		}{Category: c.Category, Count: int(c.Count)})
	}

	// TOP 用户
	type UserCount struct {
		UserID   int
		UserName string
		Count    int64
	}
	var userCounts []UserCount
	model.DB.Model(&model.SecurityHitLog{}).
		Select("security_hit_logs.user_id, users.username as user_name, COUNT(*) as count").
		Joins("LEFT JOIN users ON security_hit_logs.user_id = users.id").
		Where("security_hit_logs.created_at BETWEEN ? AND ?", startTime, endTime).
		Group("security_hit_logs.user_id, users.username").
		Order("count DESC").
		Limit(10).
		Scan(&userCounts)
	for _, c := range userCounts {
		response.TopUsers = append(response.TopUsers, struct {
			UserID   int    `json:"user_id"`
			UserName string `json:"user_name"`
			Count    int    `json:"count"`
		}{UserID: c.UserID, UserName: c.UserName, Count: int(c.Count)})
	}

	// TOP 模型
	type ModelCount struct {
		ModelName string
		Count     int64
	}
	var modelCounts []ModelCount
	model.DB.Model(&model.SecurityHitLog{}).
		Select("model_name, COUNT(*) as count").
		Where("created_at BETWEEN ? AND ? AND model_name != ''", startTime, endTime).
		Group("model_name").
		Order("count DESC").
		Limit(10).
		Scan(&modelCounts)
	for _, c := range modelCounts {
		response.TopModels = append(response.TopModels, struct {
			ModelName string `json:"model_name"`
			Count     int    `json:"count"`
		}{ModelName: c.ModelName, Count: int(c.Count)})
	}

	// 风险分布
	type RiskCount struct {
		RiskLevel int
		Count     int64
	}
	var riskCounts []RiskCount
	model.DB.Model(&model.SecurityHitLog{}).
		Select("risk_level, COUNT(*) as count").
		Where("created_at BETWEEN ? AND ?", startTime, endTime).
		Group("risk_level").
		Scan(&riskCounts)
	for _, c := range riskCounts {
		switch c.RiskLevel {
		case constant.SecurityRiskLevelLow:
			response.RiskDistribution.Low = int(c.Count)
		case constant.SecurityRiskLevelMedium:
			response.RiskDistribution.Medium = int(c.Count)
		case constant.SecurityRiskLevelHigh:
			response.RiskDistribution.High = int(c.Count)
		case constant.SecurityRiskLevelCritical:
			response.RiskDistribution.Critical = int(c.Count)
		}
	}

	return response, nil
}
