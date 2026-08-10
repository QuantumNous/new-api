package model

import (
	"time"
)

// SlaIncident 服务事件记录（故障 / 维护公告）。
type SlaIncident struct {
	Id          int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Title       string `json:"title" gorm:"type:varchar(128);not null"`
	Description string `json:"description" gorm:"type:text"`
	Status      int    `json:"status" gorm:"not null;default:1;index"` // 1 investigating, 2 identified, 3 monitoring, 4 resolved
	Severity    string `json:"severity" gorm:"type:varchar(16);default:'minor'"` // minor | major | critical
	StartedAt   int64  `json:"started_at" gorm:"bigint"`
	ResolvedAt  int64  `json:"resolved_at" gorm:"bigint"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

// SLA 事件状态常量。
const (
	SlaIncidentStatusInvestigating = 1
	SlaIncidentStatusIdentified    = 2
	SlaIncidentStatusMonitoring    = 3
	SlaIncidentStatusResolved      = 4
)

// AllowedSlaIncidentStatuses 事件状态白名单。
var AllowedSlaIncidentStatuses = map[int]bool{
	SlaIncidentStatusInvestigating: true,
	SlaIncidentStatusIdentified:    true,
	SlaIncidentStatusMonitoring:    true,
	SlaIncidentStatusResolved:      true,
}

// AllowedSlaIncidentSeverities 事件严重度白名单。
var AllowedSlaIncidentSeverities = map[string]bool{
	"minor":   true,
	"major":   true,
	"critical": true,
}

// CreateSlaIncident 创建事件（填充时间戳）。
func CreateSlaIncident(m *SlaIncident) error {
	now := time.Now().Unix()
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.StartedAt == 0 {
		m.StartedAt = now
	}
	return DB.Create(m).Error
}

// GetSlaIncidentById 按 id 获取事件。
func GetSlaIncidentById(id int64) (*SlaIncident, error) {
	var m SlaIncident
	if err := DB.Where("id = ?", id).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// SearchSlaIncidents 分页列出事件；status 为空时返回全部，按创建时间倒序。
func SearchSlaIncidents(page, pageSize int, status string) ([]*SlaIncident, int64, error) {
	var items []*SlaIncident
	var total int64
	q := DB.Model(&SlaIncident{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// UpdateSlaIncident 更新事件可编辑字段。
func UpdateSlaIncident(m *SlaIncident) error {
	updates := map[string]interface{}{
		"title":       m.Title,
		"description": m.Description,
		"status":      m.Status,
		"severity":    m.Severity,
		"started_at":  m.StartedAt,
		"resolved_at": m.ResolvedAt,
		"updated_at":  time.Now().Unix(),
	}
	return DB.Model(&SlaIncident{}).Where("id = ?", m.Id).Updates(updates).Error
}

// DeleteSlaIncident 删除事件。
func DeleteSlaIncident(id int64) error {
	return DB.Where("id = ?", id).Delete(&SlaIncident{}).Error
}

// SlaNodeStatus 节点（渠道）状态摘要，用于状态页展示。
type SlaNodeStatus struct {
	Id           int    `json:"id"`
	Name         string `json:"name"`
	Status       int    `json:"status"`
	ResponseTime int    `json:"response_time"`
}

// SlaStatusSummary 状态页整体摘要（复用既有 Channel 与 PerfMetric 数据，不新增存储）。
type SlaStatusSummary struct {
	Availability   float64          `json:"availability"`    // 0~1，近 24h 成功/总请求
	WindowHours    int              `json:"window_hours"`    // 统计窗口（小时）
	NodeCount      int64            `json:"node_count"`      // 节点总数
	OkNodeCount    int64            `json:"ok_node_count"`  // 正常节点数
	ActiveIncidents int64           `json:"active_incidents"` // 未解决事件数
	Nodes          []SlaNodeStatus  `json:"nodes"`
}

// GetSlaStatusSummary 聚合整体可用率、节点状态与活跃事件。
func GetSlaStatusSummary(windowHours int) (*SlaStatusSummary, error) {
	if windowHours <= 0 {
		windowHours = 24
	}
	startTs := time.Now().Unix() - int64(windowHours)*3600

	// 整体可用率：近窗口内 PerfMetric 的成功/总请求。
	var reqCount, succCount int64
	if err := DB.Model(&PerfMetric{}).
		Where("bucket_ts >= ?", startTs).
		Select("COALESCE(SUM(request_count),0), COALESCE(SUM(success_count),0)").
		Row().Scan(&reqCount, &succCount); err != nil {
		return nil, err
	}
	availability := 1.0
	if reqCount > 0 {
		availability = float64(succCount) / float64(reqCount)
	}

	// 节点状态：来自 channels。
	var channels []Channel
	if err := DB.Find(&channels).Error; err != nil {
		return nil, err
	}
	nodes := make([]SlaNodeStatus, 0, len(channels))
	var okNodeCount int64
	for _, ch := range channels {
		if ch.Status == 1 {
			okNodeCount++
		}
		nodes = append(nodes, SlaNodeStatus{
			Id:           ch.Id,
			Name:         ch.Name,
			Status:       ch.Status,
			ResponseTime: ch.ResponseTime,
		})
	}

	// 活跃事件：未解决（status != resolved）。
	var activeIncidents int64
	if err := DB.Model(&SlaIncident{}).
		Where("status <> ?", SlaIncidentStatusResolved).
		Count(&activeIncidents).Error; err != nil {
		return nil, err
	}

	return &SlaStatusSummary{
		Availability:     availability,
		WindowHours:      windowHours,
		NodeCount:        int64(len(channels)),
		OkNodeCount:      okNodeCount,
		ActiveIncidents:  activeIncidents,
		Nodes:            nodes,
	}, nil
}

// CountActiveSlaIncidents 未解决事件数（公开状态页使用）。
func CountActiveSlaIncidents() (int64, error) {
	var n int64
	err := DB.Model(&SlaIncident{}).Where("status <> ?", SlaIncidentStatusResolved).Count(&n).Error
	return n, err
}
