package security

import (
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// GetDashboardSummary 获取看板汇总数据
func GetDashboardSummary(startTime, endTime int64) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	// 总检测数
	var totalDetections int64
	model.DB.Model(&model.SecurityHitLog{}).Where("created_at BETWEEN ? AND ?", startTime, endTime).Count(&totalDetections)
	result["total_detections"] = totalDetections

	// 拦截数
	var totalInterceptions int64
	model.DB.Model(&model.SecurityHitLog{}).Where("created_at BETWEEN ? AND ? AND action = ?", startTime, endTime, constant.SecurityActionBlock).Count(&totalInterceptions)
	result["total_interceptions"] = totalInterceptions

	// 告警数
	var totalAlerts int64
	model.DB.Model(&model.SecurityHitLog{}).Where("created_at BETWEEN ? AND ? AND action = ?", startTime, endTime, constant.SecurityActionAlert).Count(&totalAlerts)
	result["total_alerts"] = totalAlerts

	// 今日检测数
	todayStart := time.Now().Truncate(24 * time.Hour).Unix()
	var todayDetections int64
	model.DB.Model(&model.SecurityHitLog{}).Where("created_at >= ?", todayStart).Count(&todayDetections)
	result["today_detections"] = todayDetections

	return result, nil
}

// GetTopCategories 获取 TOP 敏感分类
func GetTopCategories(startTime, endTime int64, limit int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}

	type CategoryCount struct {
		Category string
		Count    int64
	}
	var counts []CategoryCount

	err := model.DB.Model(&model.SecurityHitLog{}).
		Select("security_groups.name as category, COUNT(*) as count").
		Joins("LEFT JOIN security_groups ON security_hit_logs.group_id = security_groups.id").
		Where("security_hit_logs.created_at BETWEEN ? AND ?", startTime, endTime).
		Group("security_hit_logs.group_id, security_groups.name").
		Order("count DESC").
		Limit(limit).
		Scan(&counts).Error

	if err != nil {
		return nil, err
	}

	for _, c := range counts {
		results = append(results, map[string]interface{}{
			"category": c.Category,
			"count":    c.Count,
		})
	}

	return results, nil
}

// GetTopUsers 获取 TOP 用户
func GetTopUsers(startTime, endTime int64, limit int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}

	type UserCount struct {
		UserID   int
		UserName string
		Count    int64
	}
	var counts []UserCount

	err := model.DB.Model(&model.SecurityHitLog{}).
		Select("security_hit_logs.user_id, users.username as user_name, COUNT(*) as count").
		Joins("LEFT JOIN users ON security_hit_logs.user_id = users.id").
		Where("security_hit_logs.created_at BETWEEN ? AND ?", startTime, endTime).
		Group("security_hit_logs.user_id, users.username").
		Order("count DESC").
		Limit(limit).
		Scan(&counts).Error

	if err != nil {
		return nil, err
	}

	for _, c := range counts {
		results = append(results, map[string]interface{}{
			"user_id":   c.UserID,
			"user_name": c.UserName,
			"count":     c.Count,
		})
	}

	return results, nil
}

// GetTopModels 获取 TOP 模型
func GetTopModels(startTime, endTime int64, limit int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}

	type ModelCount struct {
		ModelName string
		Count     int64
	}
	var counts []ModelCount

	err := model.DB.Model(&model.SecurityHitLog{}).
		Select("model_name, COUNT(*) as count").
		Where("created_at BETWEEN ? AND ? AND model_name != ''", startTime, endTime).
		Group("model_name").
		Order("count DESC").
		Limit(limit).
		Scan(&counts).Error

	if err != nil {
		return nil, err
	}

	for _, c := range counts {
		results = append(results, map[string]interface{}{
			"model_name": c.ModelName,
			"count":      c.Count,
		})
	}

	return results, nil
}

// GetRiskDistribution 获取风险分布
func GetRiskDistribution(startTime, endTime int64) (map[string]int64, error) {
	distribution := map[string]int64{
		"low":      0,
		"medium":   0,
		"high":     0,
		"critical": 0,
	}

	type RiskCount struct {
		RiskLevel int
		Count     int64
	}
	var counts []RiskCount

	err := model.DB.Model(&model.SecurityHitLog{}).
		Select("risk_level, COUNT(*) as count").
		Where("created_at BETWEEN ? AND ?", startTime, endTime).
		Group("risk_level").
		Scan(&counts).Error

	if err != nil {
		return nil, err
	}

	for _, c := range counts {
		switch c.RiskLevel {
		case constant.SecurityRiskLevelLow:
			distribution["low"] = c.Count
		case constant.SecurityRiskLevelMedium:
			distribution["medium"] = c.Count
		case constant.SecurityRiskLevelHigh:
			distribution["high"] = c.Count
		case constant.SecurityRiskLevelCritical:
			distribution["critical"] = c.Count
		}
	}

	return distribution, nil
}

// GetSecurityDashboard 获取完整看板数据
func GetSecurityDashboard(startTime, endTime int64) (*dto.SecurityDashboardResponse, error) {
	if endTime == 0 {
		endTime = time.Now().Unix()
	}
	if startTime == 0 {
		startTime = endTime - 7*24*3600 // 默认7天
	}

	summary, err := GetDashboardSummary(startTime, endTime)
	if err != nil {
		return nil, err
	}

	topCategories, err := GetTopCategories(startTime, endTime, 10)
	if err != nil {
		return nil, err
	}

	topUsers, err := GetTopUsers(startTime, endTime, 10)
	if err != nil {
		return nil, err
	}

	topModels, err := GetTopModels(startTime, endTime, 10)
	if err != nil {
		return nil, err
	}

	riskDistribution, err := GetRiskDistribution(startTime, endTime)
	if err != nil {
		return nil, err
	}

	return &model.SecurityDashboardResponse{
		Summary:          summary,
		TopCategories:    topCategories,
		TopUsers:         topUsers,
		TopModels:        topModels,
		RiskDistribution: riskDistribution,
	}, nil
}
