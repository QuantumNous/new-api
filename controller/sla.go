package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ListSlaIncidents 管理端分页列出事件。
func ListSlaIncidents(c *gin.Context) {
	page, pageSize := parsePage(c)
	status := c.Query("status")
	items, total, err := model.SearchSlaIncidents(page, pageSize, status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total})
}

// CreateSlaIncident 创建事件。
func CreateSlaIncident(c *gin.Context) {
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Status      int    `json:"status"`
		Severity    string `json:"severity"`
		StartedAt   int64  `json:"started_at"`
		ResolvedAt  int64  `json:"resolved_at"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Title == "" || len(req.Title) > 128 {
		common.ApiErrorMsg(c, "title is required and must be <= 128 characters")
		return
	}
	if !model.AllowedSlaIncidentStatuses[req.Status] {
		common.ApiErrorMsg(c, "invalid status (expected 1 investigating|2 identified|3 monitoring|4 resolved)")
		return
	}
	severity := req.Severity
	if severity == "" {
		severity = "minor"
	}
	if !model.AllowedSlaIncidentSeverities[severity] {
		common.ApiErrorMsg(c, "invalid severity (expected minor|major|critical)")
		return
	}
	m := &model.SlaIncident{
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		Severity:    severity,
		StartedAt:   req.StartedAt,
		ResolvedAt:  req.ResolvedAt,
	}
	if err := model.CreateSlaIncident(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": m.Id})
}

// GetSlaIncident 获取单个事件。
func GetSlaIncident(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	m, err := model.GetSlaIncidentById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, m)
}

// UpdateSlaIncident 更新事件。
func UpdateSlaIncident(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Status      int    `json:"status"`
		Severity    string `json:"severity"`
		StartedAt   int64  `json:"started_at"`
		ResolvedAt  int64  `json:"resolved_at"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if !model.AllowedSlaIncidentStatuses[req.Status] {
		common.ApiErrorMsg(c, "invalid status (expected 1 investigating|2 identified|3 monitoring|4 resolved)")
		return
	}
	if !model.AllowedSlaIncidentSeverities[req.Severity] {
		common.ApiErrorMsg(c, "invalid severity (expected minor|major|critical)")
		return
	}
	m := &model.SlaIncident{
		Id:          id,
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		Severity:    req.Severity,
		StartedAt:   req.StartedAt,
		ResolvedAt:  req.ResolvedAt,
	}
	if err := model.UpdateSlaIncident(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// DeleteSlaIncident 删除事件。
func DeleteSlaIncident(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeleteSlaIncident(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// GetPublicSlaIncidents 公开事件列表（状态页展示，匿名可读）。
func GetPublicSlaIncidents(c *gin.Context) {
	// 公开页展示最近事件（含已解决），限制条数避免过大。
	items, _, err := model.SearchSlaIncidents(1, 50, "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items})
}

// GetPublicSlaStatus 公开服务状态摘要（匿名可读），聚合渠道与性能数据。
func GetPublicSlaStatus(c *gin.Context) {
	window := 24
	if w, err := strconv.Atoi(c.Query("window_hours")); err == nil && w > 0 && w <= 720 {
		window = w
	}
	summary, err := model.GetSlaStatusSummary(window)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}
