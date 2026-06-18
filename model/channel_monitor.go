package model

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type ChannelMonitor struct {
	Id               int64      `json:"id"`
	Name             string     `json:"name" gorm:"type:varchar(100);not null;index"`
	Provider         string     `json:"provider" gorm:"type:varchar(20);not null;index"`
	APIMode          string     `json:"api_mode" gorm:"type:varchar(32);not null;default:'chat_completions';index"`
	Endpoint         string     `json:"endpoint" gorm:"type:varchar(500);not null"`
	APIKeyEncrypted  string     `json:"-" gorm:"type:text;not null"`
	PrimaryModel     string     `json:"primary_model" gorm:"type:varchar(200);not null;index"`
	ExtraModels      string     `json:"extra_models" gorm:"type:text;not null;default:'[]'"`
	GroupName        string     `json:"group_name" gorm:"type:varchar(100);not null;default:'';index"`
	Enabled          bool       `json:"enabled" gorm:"not null;default:true;index"`
	UserVisible      *bool      `json:"user_visible" gorm:"not null;default:true;index"`
	IntervalSeconds  int        `json:"interval_seconds" gorm:"not null"`
	JitterSeconds    int        `json:"jitter_seconds" gorm:"not null;default:0"`
	LastCheckedAt    *time.Time `json:"last_checked_at" gorm:"index"`
	CreatedBy        int64      `json:"created_by" gorm:"not null;index"`
	TemplateID       *int64     `json:"template_id" gorm:"index"`
	ExtraHeaders     string     `json:"extra_headers" gorm:"type:text;not null;default:'{}'"`
	BodyOverrideMode string     `json:"body_override_mode" gorm:"type:varchar(10);not null;default:'off'"`
	BodyOverride     string     `json:"body_override" gorm:"type:text"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	APIKey              string `json:"-" gorm:"-"`
	APIKeyDecryptFailed bool   `json:"-" gorm:"-"`
}

type ChannelMonitorRequestTemplate struct {
	Id               int64     `json:"id"`
	Name             string    `json:"name" gorm:"type:varchar(100);not null;uniqueIndex:idx_channel_monitor_templates_provider_name,priority:2"`
	Provider         string    `json:"provider" gorm:"type:varchar(20);not null;index;uniqueIndex:idx_channel_monitor_templates_provider_name,priority:1;index:idx_channel_monitor_templates_provider_api_mode,priority:1"`
	APIMode          string    `json:"api_mode" gorm:"type:varchar(32);not null;default:'chat_completions';index:idx_channel_monitor_templates_provider_api_mode,priority:2"`
	Description      string    `json:"description" gorm:"type:varchar(500);not null;default:''"`
	ExtraHeaders     string    `json:"extra_headers" gorm:"type:text;not null;default:'{}'"`
	BodyOverrideMode string    `json:"body_override_mode" gorm:"type:varchar(10);not null;default:'off'"`
	BodyOverride     string    `json:"body_override" gorm:"type:text"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type ChannelMonitorHistory struct {
	Id            int64     `json:"id"`
	MonitorID     int64     `json:"monitor_id" gorm:"not null;index:idx_channel_monitor_histories_monitor_model_checked,priority:1"`
	Model         string    `json:"model" gorm:"type:varchar(200);not null;index:idx_channel_monitor_histories_monitor_model_checked,priority:2"`
	Status        string    `json:"status" gorm:"type:varchar(20);not null"`
	LatencyMs     *int      `json:"latency_ms"`
	PingLatencyMs *int      `json:"ping_latency_ms"`
	Message       string    `json:"message" gorm:"type:varchar(500);not null;default:''"`
	CheckedAt     time.Time `json:"checked_at" gorm:"not null;index;index:idx_channel_monitor_histories_monitor_model_checked,priority:3,sort:desc"`
}

type ChannelMonitorListParams struct {
	Page     int
	PageSize int
	Provider string
	Enabled  *bool
	Search   string
}

type ChannelMonitorRequestTemplateListParams struct {
	Provider string
	APIMode  string
}

type ChannelMonitorHistoryRow struct {
	MonitorID     int64
	Model         string
	Status        string
	LatencyMs     *int
	PingLatencyMs *int
	Message       string
	CheckedAt     time.Time
}

type ChannelMonitorLatest struct {
	MonitorID     int64
	Model         string
	Status        string
	LatencyMs     *int
	PingLatencyMs *int
	CheckedAt     time.Time
}

type ChannelMonitorAvailability struct {
	MonitorID         int64
	Model             string
	WindowDays        int
	TotalChecks       int
	OperationalChecks int
	AvailabilityPct   float64
	AvgLatencyMs      *int
}

func (m *ChannelMonitor) GetExtraModels() []string {
	if m == nil || strings.TrimSpace(m.ExtraModels) == "" {
		return []string{}
	}
	var models []string
	if err := common.Unmarshal([]byte(m.ExtraModels), &models); err != nil {
		common.SysError(fmt.Sprintf("failed to unmarshal channel monitor extra models: monitor_id=%d error=%v", m.Id, err))
		return []string{}
	}
	return models
}

func (m *ChannelMonitor) SetExtraModels(models []string) error {
	if m == nil {
		return nil
	}
	if models == nil {
		models = []string{}
	}
	bytes, err := common.Marshal(models)
	if err != nil {
		return err
	}
	m.ExtraModels = string(bytes)
	return nil
}

func (m *ChannelMonitor) GetExtraHeaders() map[string]string {
	if m == nil || strings.TrimSpace(m.ExtraHeaders) == "" {
		return map[string]string{}
	}
	var headers map[string]string
	if err := common.Unmarshal([]byte(m.ExtraHeaders), &headers); err != nil {
		common.SysError(fmt.Sprintf("failed to unmarshal channel monitor extra headers: monitor_id=%d error=%v", m.Id, err))
		return map[string]string{}
	}
	if headers == nil {
		return map[string]string{}
	}
	return headers
}

func (m *ChannelMonitor) SetExtraHeaders(headers map[string]string) error {
	if m == nil {
		return nil
	}
	if headers == nil {
		headers = map[string]string{}
	}
	bytes, err := common.Marshal(headers)
	if err != nil {
		return err
	}
	m.ExtraHeaders = string(bytes)
	return nil
}

func (m *ChannelMonitor) GetBodyOverride() map[string]any {
	if m == nil || strings.TrimSpace(m.BodyOverride) == "" {
		return map[string]any{}
	}
	var body map[string]any
	if err := common.Unmarshal([]byte(m.BodyOverride), &body); err != nil {
		common.SysError(fmt.Sprintf("failed to unmarshal channel monitor body override: monitor_id=%d error=%v", m.Id, err))
		return map[string]any{}
	}
	if body == nil {
		return map[string]any{}
	}
	return body
}

func (m *ChannelMonitor) SetBodyOverride(body map[string]any) error {
	if m == nil {
		return nil
	}
	if len(body) == 0 {
		m.BodyOverride = ""
		return nil
	}
	bytes, err := common.Marshal(body)
	if err != nil {
		return err
	}
	m.BodyOverride = string(bytes)
	return nil
}

func (m *ChannelMonitor) IsUserVisible() bool {
	if m == nil || m.UserVisible == nil {
		return true
	}
	return *m.UserVisible
}

func (m *ChannelMonitor) SetUserVisible(visible bool) {
	if m == nil {
		return
	}
	m.UserVisible = &visible
}

func (t *ChannelMonitorRequestTemplate) GetExtraHeaders() map[string]string {
	if t == nil || strings.TrimSpace(t.ExtraHeaders) == "" {
		return map[string]string{}
	}
	var headers map[string]string
	if err := common.Unmarshal([]byte(t.ExtraHeaders), &headers); err != nil {
		common.SysError(fmt.Sprintf("failed to unmarshal channel monitor template extra headers: template_id=%d error=%v", t.Id, err))
		return map[string]string{}
	}
	if headers == nil {
		return map[string]string{}
	}
	return headers
}

func (t *ChannelMonitorRequestTemplate) SetExtraHeaders(headers map[string]string) error {
	if t == nil {
		return nil
	}
	if headers == nil {
		headers = map[string]string{}
	}
	bytes, err := common.Marshal(headers)
	if err != nil {
		return err
	}
	t.ExtraHeaders = string(bytes)
	return nil
}

func (t *ChannelMonitorRequestTemplate) GetBodyOverride() map[string]any {
	if t == nil || strings.TrimSpace(t.BodyOverride) == "" {
		return map[string]any{}
	}
	var body map[string]any
	if err := common.Unmarshal([]byte(t.BodyOverride), &body); err != nil {
		common.SysError(fmt.Sprintf("failed to unmarshal channel monitor template body override: template_id=%d error=%v", t.Id, err))
		return map[string]any{}
	}
	if body == nil {
		return map[string]any{}
	}
	return body
}

func (t *ChannelMonitorRequestTemplate) SetBodyOverride(body map[string]any) error {
	if t == nil {
		return nil
	}
	if len(body) == 0 {
		t.BodyOverride = ""
		return nil
	}
	bytes, err := common.Marshal(body)
	if err != nil {
		return err
	}
	t.BodyOverride = string(bytes)
	return nil
}

func CreateChannelMonitor(m *ChannelMonitor) error {
	return DB.Create(m).Error
}

func GetChannelMonitorByID(id int64) (*ChannelMonitor, error) {
	var monitor ChannelMonitor
	if err := DB.First(&monitor, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &monitor, nil
}

func UpdateChannelMonitor(m *ChannelMonitor) error {
	return DB.Save(m).Error
}

func DeleteChannelMonitor(id int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("monitor_id = ?", id).Delete(&ChannelMonitorHistory{}).Error; err != nil {
			return err
		}
		return tx.Delete(&ChannelMonitor{}, "id = ?", id).Error
	})
}

func CreateChannelMonitorRequestTemplate(t *ChannelMonitorRequestTemplate) error {
	return DB.Create(t).Error
}

func GetChannelMonitorRequestTemplateByID(id int64) (*ChannelMonitorRequestTemplate, error) {
	var template ChannelMonitorRequestTemplate
	if err := DB.First(&template, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &template, nil
}

func UpdateChannelMonitorRequestTemplate(t *ChannelMonitorRequestTemplate) error {
	return DB.Save(t).Error
}

func DeleteChannelMonitorRequestTemplate(id int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&ChannelMonitor{}).
			Where("template_id = ?", id).
			Update("template_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&ChannelMonitorRequestTemplate{}, "id = ?", id).Error
	})
}

func ListChannelMonitorRequestTemplates(params ChannelMonitorRequestTemplateListParams) ([]*ChannelMonitorRequestTemplate, error) {
	query := DB.Model(&ChannelMonitorRequestTemplate{})
	if provider := strings.TrimSpace(params.Provider); provider != "" {
		query = query.Where("provider = ?", provider)
	}
	if apiMode := strings.TrimSpace(params.APIMode); apiMode != "" {
		query = query.Where("api_mode = ?", apiMode)
	}
	var items []*ChannelMonitorRequestTemplate
	err := query.Order("provider asc, api_mode asc, name asc").Find(&items).Error
	return items, err
}

func CountChannelMonitorsByTemplateID(id int64) (int64, error) {
	var count int64
	err := DB.Model(&ChannelMonitor{}).Where("template_id = ?", id).Count(&count).Error
	return count, err
}

func ListChannelMonitorsByTemplateID(id int64) ([]*ChannelMonitor, error) {
	var items []*ChannelMonitor
	err := DB.Where("template_id = ?", id).Order("name asc").Find(&items).Error
	return items, err
}

func ApplyChannelMonitorRequestTemplateToMonitors(template *ChannelMonitorRequestTemplate, monitorIDs []int64) (int64, error) {
	if template == nil || len(monitorIDs) == 0 {
		return 0, nil
	}
	values := map[string]any{
		"api_mode":           template.APIMode,
		"extra_headers":      template.ExtraHeaders,
		"body_override_mode": template.BodyOverrideMode,
		"body_override":      template.BodyOverride,
		"updated_at":         time.Now(),
	}
	result := DB.Model(&ChannelMonitor{}).
		Where("template_id = ? AND id IN ? AND provider = ? AND api_mode = ?", template.Id, monitorIDs, template.Provider, template.APIMode).
		Updates(values)
	return result.RowsAffected, result.Error
}

func ListChannelMonitors(params ChannelMonitorListParams) ([]*ChannelMonitor, int64, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize <= 0 || params.PageSize > 100 {
		params.PageSize = 20
	}

	query := applyChannelMonitorFilters(DB.Model(&ChannelMonitor{}), params)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []*ChannelMonitor
	err := applyChannelMonitorFilters(DB.Model(&ChannelMonitor{}), params).
		Order("id desc").
		Limit(params.PageSize).
		Offset((params.Page - 1) * params.PageSize).
		Find(&items).Error
	return items, total, err
}

func applyChannelMonitorFilters(query *gorm.DB, params ChannelMonitorListParams) *gorm.DB {
	if provider := strings.TrimSpace(params.Provider); provider != "" {
		query = query.Where("provider = ?", provider)
	}
	if params.Enabled != nil {
		query = query.Where("enabled = ?", *params.Enabled)
	}
	if search := strings.TrimSpace(params.Search); search != "" {
		like := "%" + search + "%"
		query = query.Where(
			"id = ? OR name LIKE ? OR endpoint LIKE ? OR primary_model LIKE ? OR group_name LIKE ?",
			common.String2Int(search), like, like, like, like,
		)
	}
	return query
}

func ListEnabledChannelMonitors() ([]*ChannelMonitor, error) {
	var items []*ChannelMonitor
	err := DB.Where("enabled = ?", true).Order("id asc").Find(&items).Error
	return items, err
}

func ListUserVisibleChannelMonitors() ([]*ChannelMonitor, error) {
	var items []*ChannelMonitor
	err := DB.Where("enabled = ? AND (user_visible = ? OR user_visible IS NULL)", true, true).Order("id asc").Find(&items).Error
	return items, err
}

func MarkChannelMonitorChecked(id int64, checkedAt time.Time) error {
	return DB.Model(&ChannelMonitor{}).
		Where("id = ?", id).
		Updates(map[string]any{"last_checked_at": checkedAt, "updated_at": time.Now()}).Error
}

func InsertChannelMonitorHistoryBatch(rows []*ChannelMonitorHistoryRow) error {
	if len(rows) == 0 {
		return nil
	}
	items := make([]ChannelMonitorHistory, 0, len(rows))
	for _, row := range rows {
		if row == nil {
			continue
		}
		items = append(items, ChannelMonitorHistory{
			MonitorID:     row.MonitorID,
			Model:         row.Model,
			Status:        row.Status,
			LatencyMs:     row.LatencyMs,
			PingLatencyMs: row.PingLatencyMs,
			Message:       row.Message,
			CheckedAt:     row.CheckedAt,
		})
	}
	if len(items) == 0 {
		return nil
	}
	return DB.CreateInBatches(items, 100).Error
}

func DeleteChannelMonitorHistoryBefore(before time.Time) (int64, error) {
	result := DB.Where("checked_at < ?", before).Delete(&ChannelMonitorHistory{})
	return result.RowsAffected, result.Error
}

func ListChannelMonitorHistory(monitorID int64, modelName string, limit int) ([]*ChannelMonitorHistory, error) {
	if limit <= 0 {
		limit = 100
	}
	query := DB.Where("monitor_id = ?", monitorID)
	if modelName = strings.TrimSpace(modelName); modelName != "" {
		query = query.Where("model = ?", modelName)
	}
	var items []*ChannelMonitorHistory
	err := query.Order("checked_at desc").Limit(limit).Find(&items).Error
	return items, err
}

func ListLatestChannelMonitorHistoryForIDs(ids []int64) (map[int64][]*ChannelMonitorLatest, error) {
	out := make(map[int64][]*ChannelMonitorLatest, len(ids))
	if len(ids) == 0 {
		return out, nil
	}

	var rows []*ChannelMonitorHistory
	err := DB.Where("monitor_id IN ?", ids).
		Order("checked_at desc").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{})
	for _, row := range rows {
		key := fmt.Sprintf("%d\x00%s", row.MonitorID, row.Model)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out[row.MonitorID] = append(out[row.MonitorID], &ChannelMonitorLatest{
			MonitorID:     row.MonitorID,
			Model:         row.Model,
			Status:        row.Status,
			LatencyMs:     row.LatencyMs,
			PingLatencyMs: row.PingLatencyMs,
			CheckedAt:     row.CheckedAt,
		})
	}
	return out, nil
}

func ComputeChannelMonitorAvailabilityForIDs(ids []int64, windowDays int) (map[int64][]*ChannelMonitorAvailability, error) {
	out := make(map[int64][]*ChannelMonitorAvailability, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	if windowDays <= 0 {
		windowDays = 7
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -windowDays)

	var rows []*ChannelMonitorHistory
	err := DB.Where("monitor_id IN ? AND checked_at >= ?", ids, cutoff).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	type agg struct {
		total      int
		ok         int
		latencySum int
		latencyN   int
	}
	aggs := make(map[string]*agg)
	monitorModel := make(map[string]struct {
		monitorID int64
		model     string
	})
	for _, row := range rows {
		key := fmt.Sprintf("%d\x00%s", row.MonitorID, row.Model)
		a := aggs[key]
		if a == nil {
			a = &agg{}
			aggs[key] = a
			monitorModel[key] = struct {
				monitorID int64
				model     string
			}{monitorID: row.MonitorID, model: row.Model}
		}
		a.total++
		if row.Status == "operational" || row.Status == "degraded" {
			a.ok++
		}
		if row.LatencyMs != nil {
			a.latencySum += *row.LatencyMs
			a.latencyN++
		}
	}

	for key, a := range aggs {
		info := monitorModel[key]
		var avg *int
		if a.latencyN > 0 {
			v := a.latencySum / a.latencyN
			avg = &v
		}
		pct := 0.0
		if a.total > 0 {
			pct = float64(a.ok) * 100 / float64(a.total)
		}
		out[info.monitorID] = append(out[info.monitorID], &ChannelMonitorAvailability{
			MonitorID:         info.monitorID,
			Model:             info.model,
			WindowDays:        windowDays,
			TotalChecks:       a.total,
			OperationalChecks: a.ok,
			AvailabilityPct:   pct,
			AvgLatencyMs:      avg,
		})
	}
	return out, nil
}

func ListRecentChannelMonitorHistoryForPrimaries(ids []int64, primaryModels map[int64]string, perMonitorLimit int) (map[int64][]*ChannelMonitorHistory, error) {
	out := make(map[int64][]*ChannelMonitorHistory, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	if perMonitorLimit <= 0 {
		perMonitorLimit = 60
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -30)
	var rows []*ChannelMonitorHistory
	err := DB.Where("monitor_id IN ? AND checked_at >= ?", ids, cutoff).
		Order("checked_at desc").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if len(out[row.MonitorID]) >= perMonitorLimit {
			continue
		}
		if primaryModels[row.MonitorID] != row.Model {
			continue
		}
		out[row.MonitorID] = append(out[row.MonitorID], row)
	}
	return out, nil
}
