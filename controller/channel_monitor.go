package controller

import (
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

type channelMonitorCreateRequest struct {
	Name             string            `json:"name"`
	Provider         string            `json:"provider"`
	APIMode          string            `json:"api_mode"`
	Endpoint         string            `json:"endpoint"`
	APIKey           string            `json:"api_key"`
	PrimaryModel     string            `json:"primary_model"`
	ExtraModels      []string          `json:"extra_models"`
	GroupName        string            `json:"group_name"`
	Enabled          *bool             `json:"enabled"`
	UserVisible      *bool             `json:"user_visible"`
	IntervalSeconds  int               `json:"interval_seconds"`
	JitterSeconds    int               `json:"jitter_seconds"`
	TemplateID       *int64            `json:"template_id"`
	ExtraHeaders     map[string]string `json:"extra_headers"`
	BodyOverrideMode string            `json:"body_override_mode"`
	BodyOverride     map[string]any    `json:"body_override"`
}

type channelMonitorUpdateRequest struct {
	Name             *string            `json:"name"`
	Provider         *string            `json:"provider"`
	APIMode          *string            `json:"api_mode"`
	Endpoint         *string            `json:"endpoint"`
	APIKey           *string            `json:"api_key"`
	PrimaryModel     *string            `json:"primary_model"`
	ExtraModels      *[]string          `json:"extra_models"`
	GroupName        *string            `json:"group_name"`
	Enabled          *bool              `json:"enabled"`
	UserVisible      *bool              `json:"user_visible"`
	IntervalSeconds  *int               `json:"interval_seconds"`
	JitterSeconds    *int               `json:"jitter_seconds"`
	TemplateID       *int64             `json:"template_id"`
	ClearTemplate    bool               `json:"clear_template"`
	ExtraHeaders     *map[string]string `json:"extra_headers"`
	BodyOverrideMode *string            `json:"body_override_mode"`
	BodyOverride     *map[string]any    `json:"body_override"`
}

type channelMonitorAdminResponse struct {
	ID                  int64                      `json:"id"`
	Name                string                     `json:"name"`
	Provider            string                     `json:"provider"`
	APIMode             string                     `json:"api_mode"`
	Endpoint            string                     `json:"endpoint"`
	APIKeyMasked        string                     `json:"api_key_masked"`
	APIKeyDecryptFailed bool                       `json:"api_key_decrypt_failed"`
	PrimaryModel        string                     `json:"primary_model"`
	ExtraModels         []string                   `json:"extra_models"`
	GroupName           string                     `json:"group_name"`
	Enabled             bool                       `json:"enabled"`
	UserVisible         bool                       `json:"user_visible"`
	IntervalSeconds     int                        `json:"interval_seconds"`
	JitterSeconds       int                        `json:"jitter_seconds"`
	LastCheckedAt       *time.Time                 `json:"last_checked_at"`
	CreatedBy           int64                      `json:"created_by"`
	CreatedAt           time.Time                  `json:"created_at"`
	UpdatedAt           time.Time                  `json:"updated_at"`
	PrimaryStatus       string                     `json:"primary_status"`
	PrimaryLatencyMs    *int                       `json:"primary_latency_ms"`
	Availability7d      float64                    `json:"availability_7d"`
	ExtraModelStatuses  []service.ExtraModelStatus `json:"extra_model_statuses"`
	TemplateID          *int64                     `json:"template_id"`
	ExtraHeaders        map[string]string          `json:"extra_headers"`
	BodyOverrideMode    string                     `json:"body_override_mode"`
	BodyOverride        map[string]any             `json:"body_override"`
}

type channelMonitorTemplateRequest struct {
	Name             string            `json:"name"`
	Provider         string            `json:"provider"`
	APIMode          string            `json:"api_mode"`
	Description      string            `json:"description"`
	ExtraHeaders     map[string]string `json:"extra_headers"`
	BodyOverrideMode string            `json:"body_override_mode"`
	BodyOverride     map[string]any    `json:"body_override"`
}

type channelMonitorTemplateUpdateRequest struct {
	Name             *string            `json:"name"`
	APIMode          *string            `json:"api_mode"`
	Description      *string            `json:"description"`
	ExtraHeaders     *map[string]string `json:"extra_headers"`
	BodyOverrideMode *string            `json:"body_override_mode"`
	BodyOverride     *map[string]any    `json:"body_override"`
}

type channelMonitorTemplateResponse struct {
	ID                 int64             `json:"id"`
	Name               string            `json:"name"`
	Provider           string            `json:"provider"`
	APIMode            string            `json:"api_mode"`
	Description        string            `json:"description"`
	ExtraHeaders       map[string]string `json:"extra_headers"`
	BodyOverrideMode   string            `json:"body_override_mode"`
	BodyOverride       map[string]any    `json:"body_override"`
	CreatedAt          time.Time         `json:"created_at"`
	UpdatedAt          time.Time         `json:"updated_at"`
	AssociatedMonitors int64             `json:"associated_monitors"`
}

type channelMonitorTemplateApplyRequest struct {
	MonitorIDs []int64 `json:"monitor_ids"`
}

type channelMonitorAssociatedMonitorResponse struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	APIMode  string `json:"api_mode"`
	Enabled  bool   `json:"enabled"`
}

type channelMonitorHistoryResponse struct {
	ID            int64     `json:"id"`
	MonitorID     int64     `json:"monitor_id"`
	Model         string    `json:"model"`
	Status        string    `json:"status"`
	LatencyMs     *int      `json:"latency_ms"`
	PingLatencyMs *int      `json:"ping_latency_ms"`
	Message       string    `json:"message"`
	CheckedAt     time.Time `json:"checked_at"`
}

type channelMonitorUserStatusResponse struct {
	Enabled     bool                              `json:"enabled"`
	RefreshedAt time.Time                         `json:"refreshed_at"`
	Summary     channelMonitorOverallSummary      `json:"summary"`
	Monitors    []channelMonitorUserMonitorStatus `json:"monitors"`
}

type channelMonitorOverallSummary struct {
	OverallState     string     `json:"overall_state"`
	MonitoredCount   int        `json:"monitored_count"`
	OperationalCount int        `json:"operational_count"`
	DegradedCount    int        `json:"degraded_count"`
	FailedCount      int        `json:"failed_count"`
	ErrorCount       int        `json:"error_count"`
	UnknownCount     int        `json:"unknown_count"`
	LastCheckedAt    *time.Time `json:"last_checked_at"`
}

type channelMonitorUserMonitorStatus struct {
	ID                   int64                             `json:"id"`
	Name                 string                            `json:"name"`
	Provider             string                            `json:"provider"`
	GroupName            string                            `json:"group_name"`
	AdminOnly            bool                              `json:"admin_only"`
	PrimaryModel         string                            `json:"primary_model"`
	PrimaryStatus        string                            `json:"primary_status"`
	PrimaryLatencyMs     *int                              `json:"primary_latency_ms"`
	PrimaryPingLatencyMs *int                              `json:"primary_ping_latency_ms"`
	LastCheckedAt        *time.Time                        `json:"last_checked_at"`
	Availability7d       float64                           `json:"availability_7d"`
	Availability15d      float64                           `json:"availability_15d"`
	Availability30d      float64                           `json:"availability_30d"`
	ExtraModels          []service.ExtraModelStatus        `json:"extra_models"`
	Timeline             []channelMonitorUserTimelinePoint `json:"timeline"`
}

type channelMonitorUserTimelinePoint struct {
	Status        string    `json:"status"`
	LatencyMs     *int      `json:"latency_ms"`
	PingLatencyMs *int      `json:"ping_latency_ms"`
	CheckedAt     time.Time `json:"checked_at"`
}

type channelMonitorUserDetailResponse struct {
	Enabled bool                     `json:"enabled"`
	Monitor channelMonitorUserDetail `json:"monitor"`
}

type channelMonitorUserDetail struct {
	ID        int64                       `json:"id"`
	Name      string                      `json:"name"`
	Provider  string                      `json:"provider"`
	GroupName string                      `json:"group_name"`
	AdminOnly bool                        `json:"admin_only"`
	Models    []channelMonitorModelDetail `json:"models"`
}

type channelMonitorModelDetail struct {
	Model           string     `json:"model"`
	LatestStatus    string     `json:"latest_status"`
	LatestLatencyMs *int       `json:"latest_latency_ms"`
	LatestPingMs    *int       `json:"latest_ping_ms"`
	LatestCheckedAt *time.Time `json:"latest_checked_at"`
	Availability7d  float64    `json:"availability_7d"`
	Availability15d float64    `json:"availability_15d"`
	Availability30d float64    `json:"availability_30d"`
	AvgLatency7dMs  *int       `json:"avg_latency_7d_ms"`
}

func GetAllChannelMonitors(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	var enabled *bool
	if raw := c.Query("enabled"); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			common.ApiError(c, fmt.Errorf("invalid enabled filter: %w", err))
			return
		}
		enabled = &value
	}

	items, total, err := service.ListChannelMonitors(c.Request.Context(), service.ChannelMonitorListParams{
		Page:     pageInfo.GetPage(),
		PageSize: pageInfo.GetPageSize(),
		Provider: c.Query("provider"),
		Enabled:  enabled,
		Search:   c.Query("search"),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	summaries := service.BatchChannelMonitorStatusSummary(c.Request.Context(), items)
	resp := make([]channelMonitorAdminResponse, 0, len(items))
	for _, item := range items {
		resp = append(resp, buildChannelMonitorAdminResponse(item, summaries[item.Id]))
	}

	common.ApiSuccess(c, gin.H{
		"items":     resp,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

func GetChannelMonitor(c *gin.Context) {
	id, ok := parseChannelMonitorID(c)
	if !ok {
		return
	}
	monitor, err := service.GetChannelMonitor(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summary := service.BatchChannelMonitorStatusSummary(c.Request.Context(), []*model.ChannelMonitor{monitor})[monitor.Id]
	common.ApiSuccess(c, buildChannelMonitorAdminResponse(monitor, summary))
}

func CreateChannelMonitor(c *gin.Context) {
	var req channelMonitorCreateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	interval := req.IntervalSeconds
	if interval <= 0 {
		interval = channelMonitorDefaultIntervalSeconds()
	}
	monitor, err := service.CreateChannelMonitor(c.Request.Context(), service.ChannelMonitorCreateParams{
		Name:             req.Name,
		Provider:         req.Provider,
		APIMode:          req.APIMode,
		Endpoint:         req.Endpoint,
		APIKey:           req.APIKey,
		PrimaryModel:     req.PrimaryModel,
		ExtraModels:      req.ExtraModels,
		GroupName:        req.GroupName,
		Enabled:          enabled,
		UserVisible:      req.UserVisible,
		IntervalSeconds:  interval,
		JitterSeconds:    req.JitterSeconds,
		CreatedBy:        int64(c.GetInt("id")),
		TemplateID:       req.TemplateID,
		ExtraHeaders:     req.ExtraHeaders,
		BodyOverrideMode: req.BodyOverrideMode,
		BodyOverride:     req.BodyOverride,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summary := service.BatchChannelMonitorStatusSummary(c.Request.Context(), []*model.ChannelMonitor{monitor})[monitor.Id]
	common.ApiSuccess(c, buildChannelMonitorAdminResponse(monitor, summary))
}

func UpdateChannelMonitor(c *gin.Context) {
	id, ok := parseChannelMonitorID(c)
	if !ok {
		return
	}
	var req channelMonitorUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	monitor, err := service.UpdateChannelMonitor(c.Request.Context(), id, service.ChannelMonitorUpdateParams{
		Name:             req.Name,
		Provider:         req.Provider,
		APIMode:          req.APIMode,
		Endpoint:         req.Endpoint,
		APIKey:           req.APIKey,
		PrimaryModel:     req.PrimaryModel,
		ExtraModels:      req.ExtraModels,
		GroupName:        req.GroupName,
		Enabled:          req.Enabled,
		UserVisible:      req.UserVisible,
		IntervalSeconds:  req.IntervalSeconds,
		JitterSeconds:    req.JitterSeconds,
		TemplateID:       req.TemplateID,
		ClearTemplate:    req.ClearTemplate,
		ExtraHeaders:     req.ExtraHeaders,
		BodyOverrideMode: req.BodyOverrideMode,
		BodyOverride:     req.BodyOverride,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summary := service.BatchChannelMonitorStatusSummary(c.Request.Context(), []*model.ChannelMonitor{monitor})[monitor.Id]
	common.ApiSuccess(c, buildChannelMonitorAdminResponse(monitor, summary))
}

func DeleteChannelMonitor(c *gin.Context) {
	id, ok := parseChannelMonitorID(c)
	if !ok {
		return
	}
	if err := service.DeleteChannelMonitor(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func RunChannelMonitor(c *gin.Context) {
	id, ok := parseChannelMonitorID(c)
	if !ok {
		return
	}
	results, err := service.RunChannelMonitorCheck(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, results)
}

func GetChannelMonitorHistory(c *gin.Context) {
	id, ok := parseChannelMonitorID(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	rows, err := service.ListChannelMonitorHistory(id, c.Query("model"), limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	resp := make([]channelMonitorHistoryResponse, 0, len(rows))
	for _, row := range rows {
		resp = append(resp, channelMonitorHistoryResponse{
			ID:            row.Id,
			MonitorID:     row.MonitorID,
			Model:         row.Model,
			Status:        row.Status,
			LatencyMs:     row.LatencyMs,
			PingLatencyMs: row.PingLatencyMs,
			Message:       row.Message,
			CheckedAt:     row.CheckedAt,
		})
	}
	common.ApiSuccess(c, gin.H{"items": resp})
}

func GetAllChannelMonitorTemplates(c *gin.Context) {
	items, err := service.ListChannelMonitorRequestTemplates(c.Request.Context(), service.ChannelMonitorRequestTemplateListParams{
		Provider: c.Query("provider"),
		APIMode:  c.Query("api_mode"),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	resp := make([]channelMonitorTemplateResponse, 0, len(items))
	for _, item := range items {
		resp = append(resp, buildChannelMonitorTemplateResponse(c, item))
	}
	common.ApiSuccess(c, gin.H{"items": resp})
}

func GetChannelMonitorTemplate(c *gin.Context) {
	id, ok := parseChannelMonitorTemplateID(c)
	if !ok {
		return
	}
	template, err := service.GetChannelMonitorRequestTemplate(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildChannelMonitorTemplateResponse(c, template))
}

func CreateChannelMonitorTemplate(c *gin.Context) {
	var req channelMonitorTemplateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	template, err := service.CreateChannelMonitorRequestTemplate(c.Request.Context(), service.ChannelMonitorRequestTemplateCreateParams{
		Name:             req.Name,
		Provider:         req.Provider,
		APIMode:          req.APIMode,
		Description:      req.Description,
		ExtraHeaders:     req.ExtraHeaders,
		BodyOverrideMode: req.BodyOverrideMode,
		BodyOverride:     req.BodyOverride,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildChannelMonitorTemplateResponse(c, template))
}

func UpdateChannelMonitorTemplate(c *gin.Context) {
	id, ok := parseChannelMonitorTemplateID(c)
	if !ok {
		return
	}
	var req channelMonitorTemplateUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	template, err := service.UpdateChannelMonitorRequestTemplate(c.Request.Context(), id, service.ChannelMonitorRequestTemplateUpdateParams{
		Name:             req.Name,
		APIMode:          req.APIMode,
		Description:      req.Description,
		ExtraHeaders:     req.ExtraHeaders,
		BodyOverrideMode: req.BodyOverrideMode,
		BodyOverride:     req.BodyOverride,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildChannelMonitorTemplateResponse(c, template))
}

func DeleteChannelMonitorTemplate(c *gin.Context) {
	id, ok := parseChannelMonitorTemplateID(c)
	if !ok {
		return
	}
	if err := service.DeleteChannelMonitorRequestTemplate(c.Request.Context(), id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ApplyChannelMonitorTemplate(c *gin.Context) {
	id, ok := parseChannelMonitorTemplateID(c)
	if !ok {
		return
	}
	var req channelMonitorTemplateApplyRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	affected, err := service.ApplyChannelMonitorRequestTemplateToMonitors(c.Request.Context(), id, req.MonitorIDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"affected": affected})
}

func GetChannelMonitorTemplateAssociatedMonitors(c *gin.Context) {
	id, ok := parseChannelMonitorTemplateID(c)
	if !ok {
		return
	}
	items, err := service.ListChannelMonitorTemplateAssociatedMonitors(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	resp := make([]channelMonitorAssociatedMonitorResponse, 0, len(items))
	for _, item := range items {
		resp = append(resp, channelMonitorAssociatedMonitorResponse{
			ID:       item.ID,
			Name:     item.Name,
			Provider: item.Provider,
			APIMode:  item.APIMode,
			Enabled:  item.Enabled,
		})
	}
	common.ApiSuccess(c, gin.H{"items": resp})
}

func GetUserChannelMonitorStatus(c *gin.Context) {
	if !operation_setting.GetMonitorSetting().ChannelMonitorEnabled {
		common.ApiSuccess(c, channelMonitorUserStatusResponse{
			Enabled:     false,
			RefreshedAt: time.Now(),
			Summary:     channelMonitorOverallSummary{OverallState: "disabled"},
			Monitors:    []channelMonitorUserMonitorStatus{},
		})
		return
	}
	items, err := service.ListUserChannelMonitorViews(c.Request.Context(), channelMonitorIncludeAdminOnly(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	monitors := make([]channelMonitorUserMonitorStatus, 0, len(items))
	for _, item := range items {
		monitors = append(monitors, buildChannelMonitorUserMonitorStatus(item))
	}
	common.ApiSuccess(c, channelMonitorUserStatusResponse{
		Enabled:     true,
		RefreshedAt: time.Now(),
		Summary:     buildChannelMonitorOverallSummary(monitors),
		Monitors:    monitors,
	})
}

func GetUserChannelMonitorDetail(c *gin.Context) {
	if !operation_setting.GetMonitorSetting().ChannelMonitorEnabled {
		common.ApiErrorMsg(c, "channel monitor status is disabled")
		return
	}
	id, ok := parseChannelMonitorID(c)
	if !ok {
		return
	}
	detail, err := service.GetUserChannelMonitorDetail(c.Request.Context(), id, channelMonitorIncludeAdminOnly(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channelMonitorUserDetailResponse{
		Enabled: true,
		Monitor: channelMonitorUserDetail{
			ID:        detail.ID,
			Name:      detail.Name,
			Provider:  detail.Provider,
			GroupName: detail.GroupName,
			AdminOnly: detail.AdminOnly,
			Models:    buildChannelMonitorModelDetails(detail.Models),
		},
	})
}

func channelMonitorIncludeAdminOnly(c *gin.Context) bool {
	return c.GetInt("role") >= common.RoleAdminUser
}

func buildChannelMonitorAdminResponse(m *model.ChannelMonitor, summary service.MonitorStatusSummary) channelMonitorAdminResponse {
	apiKeyMasked := ""
	if !m.APIKeyDecryptFailed && m.APIKey != "" {
		apiKeyMasked = service.MaskChannelMonitorAPIKey(m.APIKey)
	}
	return channelMonitorAdminResponse{
		ID:                  m.Id,
		Name:                m.Name,
		Provider:            m.Provider,
		APIMode:             m.APIMode,
		Endpoint:            m.Endpoint,
		APIKeyMasked:        apiKeyMasked,
		APIKeyDecryptFailed: m.APIKeyDecryptFailed,
		PrimaryModel:        m.PrimaryModel,
		ExtraModels:         m.GetExtraModels(),
		GroupName:           m.GroupName,
		Enabled:             m.Enabled,
		UserVisible:         m.IsUserVisible(),
		IntervalSeconds:     m.IntervalSeconds,
		JitterSeconds:       m.JitterSeconds,
		LastCheckedAt:       m.LastCheckedAt,
		CreatedBy:           m.CreatedBy,
		CreatedAt:           m.CreatedAt,
		UpdatedAt:           m.UpdatedAt,
		PrimaryStatus:       normalizeMonitorResponseStatus(summary.PrimaryStatus),
		PrimaryLatencyMs:    summary.PrimaryLatencyMs,
		Availability7d:      summary.Availability7d,
		ExtraModelStatuses:  summary.ExtraModels,
		TemplateID:          m.TemplateID,
		ExtraHeaders:        m.GetExtraHeaders(),
		BodyOverrideMode:    m.BodyOverrideMode,
		BodyOverride:        m.GetBodyOverride(),
	}
}

func buildChannelMonitorTemplateResponse(c *gin.Context, template *model.ChannelMonitorRequestTemplate) channelMonitorTemplateResponse {
	count, _ := service.CountChannelMonitorTemplateAssociatedMonitors(c.Request.Context(), template.Id)
	return channelMonitorTemplateResponse{
		ID:                 template.Id,
		Name:               template.Name,
		Provider:           template.Provider,
		APIMode:            template.APIMode,
		Description:        template.Description,
		ExtraHeaders:       template.GetExtraHeaders(),
		BodyOverrideMode:   template.BodyOverrideMode,
		BodyOverride:       template.GetBodyOverride(),
		CreatedAt:          template.CreatedAt,
		UpdatedAt:          template.UpdatedAt,
		AssociatedMonitors: count,
	}
}

func buildChannelMonitorUserMonitorStatus(item *service.UserMonitorView) channelMonitorUserMonitorStatus {
	timeline := make([]channelMonitorUserTimelinePoint, 0, len(item.Timeline))
	for _, point := range item.Timeline {
		timeline = append(timeline, channelMonitorUserTimelinePoint{
			Status:        normalizeMonitorResponseStatus(point.Status),
			LatencyMs:     point.LatencyMs,
			PingLatencyMs: point.PingLatencyMs,
			CheckedAt:     point.CheckedAt,
		})
	}
	return channelMonitorUserMonitorStatus{
		ID:                   item.ID,
		Name:                 item.Name,
		Provider:             item.Provider,
		GroupName:            item.GroupName,
		AdminOnly:            item.AdminOnly,
		PrimaryModel:         item.PrimaryModel,
		PrimaryStatus:        normalizeMonitorResponseStatus(item.PrimaryStatus),
		PrimaryLatencyMs:     item.PrimaryLatencyMs,
		PrimaryPingLatencyMs: item.PrimaryPingLatencyMs,
		LastCheckedAt:        item.PrimaryCheckedAt,
		Availability7d:       item.Availability7d,
		Availability15d:      item.Availability15d,
		Availability30d:      item.Availability30d,
		ExtraModels:          item.ExtraModels,
		Timeline:             timeline,
	}
}

func buildChannelMonitorOverallSummary(items []channelMonitorUserMonitorStatus) channelMonitorOverallSummary {
	summary := channelMonitorOverallSummary{MonitoredCount: len(items), OverallState: "unknown"}
	for _, item := range items {
		switch normalizeMonitorResponseStatus(item.PrimaryStatus) {
		case service.MonitorStatusOperational:
			summary.OperationalCount++
		case service.MonitorStatusDegraded:
			summary.DegradedCount++
		case service.MonitorStatusFailed:
			summary.FailedCount++
		case service.MonitorStatusError:
			summary.ErrorCount++
		default:
			summary.UnknownCount++
		}
		if item.LastCheckedAt != nil && (summary.LastCheckedAt == nil || item.LastCheckedAt.After(*summary.LastCheckedAt)) {
			value := *item.LastCheckedAt
			summary.LastCheckedAt = &value
		}
	}
	if summary.MonitoredCount == 0 {
		return summary
	}
	if summary.DegradedCount > 0 || summary.FailedCount > 0 || summary.ErrorCount > 0 || summary.UnknownCount > 0 {
		summary.OverallState = service.MonitorStatusDegraded
		return summary
	}
	if summary.UnknownCount == 0 && summary.OperationalCount == summary.MonitoredCount {
		summary.OverallState = service.MonitorStatusOperational
	}
	return summary
}

func buildChannelMonitorModelDetails(models []service.ModelDetail) []channelMonitorModelDetail {
	resp := make([]channelMonitorModelDetail, 0, len(models))
	for _, item := range models {
		resp = append(resp, channelMonitorModelDetail{
			Model:           item.Model,
			LatestStatus:    normalizeMonitorResponseStatus(item.LatestStatus),
			LatestLatencyMs: item.LatestLatencyMs,
			LatestPingMs:    item.LatestPingMs,
			LatestCheckedAt: item.LatestCheckedAt,
			Availability7d:  item.Availability7d,
			Availability15d: item.Availability15d,
			Availability30d: item.Availability30d,
			AvgLatency7dMs:  item.AvgLatency7dMs,
		})
	}
	return resp
}

func normalizeMonitorResponseStatus(status string) string {
	if status == "" {
		return "unknown"
	}
	return status
}

func parseChannelMonitorID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		if err == nil {
			err = fmt.Errorf("invalid channel monitor id")
		}
		common.ApiError(c, err)
		return 0, false
	}
	return id, true
}

func parseChannelMonitorTemplateID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		if err == nil {
			err = fmt.Errorf("invalid channel monitor template id")
		}
		common.ApiError(c, err)
		return 0, false
	}
	return id, true
}

func channelMonitorDefaultIntervalSeconds() int {
	value := operation_setting.GetMonitorSetting().ChannelMonitorDefaultIntervalSeconds
	if value < 15 {
		return 60
	}
	return value
}
