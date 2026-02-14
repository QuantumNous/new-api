package group_monitor

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// GroupMonitorLog 分组监控日志
type GroupMonitorLog struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	GroupName   string `json:"group_name" gorm:"type:varchar(64);index:idx_gml_group_time,priority:1;index"`
	ChannelId   int    `json:"channel_id" gorm:"index"`
	ChannelName string `json:"channel_name" gorm:"type:varchar(255)"`
	ModelName   string `json:"model_name" gorm:"type:varchar(255)"`
	LatencyMs   int64  `json:"latency_ms"`
	Success     bool   `json:"success"`
	ErrorMsg    string `json:"error_msg" gorm:"type:text"`
	CachedModel string `json:"cached_model" gorm:"type:varchar(255)"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index:idx_gml_group_time,priority:2;index"`
}

// GroupMonitorConfig 分组监控配置（管理员为每个分组选择监控渠道）
type GroupMonitorConfig struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	GroupName  string `json:"group_name" gorm:"type:varchar(64);uniqueIndex"`
	ChannelId  int    `json:"channel_id"` // 监控的渠道 ID
	TestModel  string `json:"test_model" gorm:"type:varchar(255)"` // 该分组的测试模型（空则用全局默认）
	Enabled    bool   `json:"enabled" gorm:"default:true"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
}

func (GroupMonitorLog) TableName() string {
	return "group_monitor_logs"
}

func (GroupMonitorConfig) TableName() string {
	return "group_monitor_configs"
}

// CreateGroupMonitorLog 插入一条监控日志
func CreateGroupMonitorLog(log *GroupMonitorLog) error {
	return model.DB.Create(log).Error
}

// GetGroupMonitorLogs 分页查询日志
func GetGroupMonitorLogs(groupName string, startTs, endTs int64, startIdx, pageSize int) ([]*GroupMonitorLog, int64, error) {
	var logs []*GroupMonitorLog
	var total int64

	query := model.DB.Model(&GroupMonitorLog{})
	if groupName != "" {
		query = query.Where("group_name = ?", groupName)
	}
	if startTs > 0 {
		query = query.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		query = query.Where("created_at <= ?", endTs)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Order("created_at DESC").Offset(startIdx).Limit(pageSize).Find(&logs).Error
	return logs, total, err
}

// GetGroupMonitorLatest 获取每个 group 的最新一条记录
func GetGroupMonitorLatest() ([]*GroupMonitorLog, error) {
	var logs []*GroupMonitorLog

	// 先查所有 distinct group_name，再逐个查最新记录（兼容三种数据库）
	var groupNames []string
	err := model.DB.Model(&GroupMonitorLog{}).Distinct().Pluck("group_name", &groupNames).Error
	if err != nil {
		return nil, err
	}

	for _, gn := range groupNames {
		var log GroupMonitorLog
		err := model.DB.Where("group_name = ?", gn).Order("created_at DESC").First(&log).Error
		if err != nil {
			continue
		}
		logs = append(logs, &log)
	}
	return logs, nil
}

// GroupMonitorStat 聚合统计
type GroupMonitorStat struct {
	GroupName    string  `json:"group_name"`
	AvgLatency   float64 `json:"avg_latency"`
	TotalCount   int64   `json:"total_count"`
	SuccessCount int64   `json:"success_count"`
}

// GetGroupMonitorStats 获取聚合统计（1 小时维度）
func GetGroupMonitorStats(startTs, endTs int64) ([]GroupMonitorStat, error) {
	var stats []GroupMonitorStat

	query := model.DB.Model(&GroupMonitorLog{})
	if startTs > 0 {
		query = query.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		query = query.Where("created_at <= ?", endTs)
	}

	// 使用 GORM 的 Where("success = ?", true) 自动处理布尔值兼容
	err := query.Select(`group_name,
		AVG(latency_ms) as avg_latency,
		COUNT(*) as total_count`).
		Group("group_name").
		Scan(&stats).Error
	if err != nil {
		return nil, err
	}

	// 单独查询成功次数（避免 CASE WHEN 布尔值兼容问题）
	for i, stat := range stats {
		var count int64
		q := model.DB.Model(&GroupMonitorLog{}).Where("group_name = ? AND success = ?", stat.GroupName, true)
		if startTs > 0 {
			q = q.Where("created_at >= ?", startTs)
		}
		if endTs > 0 {
			q = q.Where("created_at <= ?", endTs)
		}
		q.Count(&count)
		stats[i].SuccessCount = count
	}

	return stats, nil
}

// CleanupGroupMonitorLogs 清理旧日志
func CleanupGroupMonitorLogs(retainDays int) error {
	threshold := common.GetTimestamp() - int64(retainDays*86400)
	return model.DB.Where("created_at < ?", threshold).Delete(&GroupMonitorLog{}).Error
}

// GetAllGroupMonitorConfigs 获取所有分组监控配置
func GetAllGroupMonitorConfigs() ([]*GroupMonitorConfig, error) {
	var configs []*GroupMonitorConfig
	err := model.DB.Find(&configs).Error
	return configs, err
}

// GetEnabledGroupMonitorConfigs 获取所有启用的分组监控配置
func GetEnabledGroupMonitorConfigs() ([]*GroupMonitorConfig, error) {
	var configs []*GroupMonitorConfig
	err := model.DB.Where("enabled = ?", true).Find(&configs).Error
	return configs, err
}

// SaveGroupMonitorConfig 保存/更新分组监控配置
func SaveGroupMonitorConfig(cfg *GroupMonitorConfig) error {
	cfg.UpdatedAt = common.GetTimestamp()
	// Upsert by group_name
	var existing GroupMonitorConfig
	err := model.DB.Where("group_name = ?", cfg.GroupName).First(&existing).Error
	if err != nil {
		// 不存在，创建
		return model.DB.Create(cfg).Error
	}
	// 已存在，更新
	return model.DB.Model(&existing).Updates(map[string]interface{}{
		"channel_id": cfg.ChannelId,
		"test_model": cfg.TestModel,
		"enabled":    cfg.Enabled,
		"updated_at": cfg.UpdatedAt,
	}).Error
}

// DeleteGroupMonitorConfig 删除分组监控配置
func DeleteGroupMonitorConfig(groupName string) error {
	return model.DB.Where("group_name = ?", groupName).Delete(&GroupMonitorConfig{}).Error
}

// GetGroupMonitorTimeSeries 获取时间序列数据（用于趋势图）
func GetGroupMonitorTimeSeries(groupName string, startTs, endTs int64) ([]*GroupMonitorLog, error) {
	var logs []*GroupMonitorLog
	query := model.DB.Model(&GroupMonitorLog{})
	if groupName != "" {
		query = query.Where("group_name = ?", groupName)
	}
	if startTs > 0 {
		query = query.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		query = query.Where("created_at <= ?", endTs)
	}
	err := query.Order("created_at ASC").Find(&logs).Error
	return logs, err
}

// ParseChannelIds 解析逗号分隔的渠道 ID 字符串
func ParseChannelIds(channelIdsStr string) []int {
	if channelIdsStr == "" {
		return nil
	}
	parts := strings.Split(channelIdsStr, ",")
	var ids []int
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if id, err := strconv.Atoi(p); err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}
