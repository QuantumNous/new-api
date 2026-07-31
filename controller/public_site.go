package controller

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetSiteConfig 营销站配置：复用 SystemName/Logo/Footer，无鉴权。
func GetSiteConfig(c *gin.Context) {
	common.ApiSuccess(c, service.GetPublicSiteConfig())
}

// GetPublicPricing 营销站定价方案列表（按 locale）。
func GetPublicPricing(c *gin.Context) {
	locale := c.Query("locale")
	plans, err := service.GetPublicPricing(locale)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"plans": plans})
}

// GetPublicModelCatalog 营销站模型能力分类列表（按 locale）。
func GetPublicModelCatalog(c *gin.Context) {
	locale := c.Query("locale")
	categories, err := service.GetPublicModelCatalog(locale)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"categories": categories})
}

// ContactSalesRequest “联系销售”表单提交体。
type ContactSalesRequest struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Company        string `json:"company"`
	Region         string `json:"region"`
	UseCase        string `json:"use_case"`
	MonthlyVolume  string `json:"monthly_volume"`
	RequiredModels string `json:"required_models"`
	Message        string `json:"message"`
	Redirect       string `json:"redirect"`
}

// ContactSales 写入销售线索（公开接口，限流 + 字段校验 + redirect 白名单）。
func ContactSales(c *gin.Context) {
	var req ContactSalesRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.Name == "" || len(req.Name) > 64 {
		common.ApiErrorMsg(c, "name is required and must be <= 64 characters")
		return
	}
	if req.Email == "" || len(req.Email) > 128 || common.Validate.Var(req.Email, "email") != nil {
		common.ApiErrorMsg(c, "a valid email (<=128 chars) is required")
		return
	}
	if req.Region == "" || len(req.Region) > 64 {
		common.ApiErrorMsg(c, "region is required and must be <= 64 characters")
		return
	}
	if req.UseCase == "" || len(req.UseCase) > 256 {
		common.ApiErrorMsg(c, "use_case is required and must be <= 256 characters")
		return
	}
	if len(req.Company) > 128 {
		common.ApiErrorMsg(c, "company must be <= 128 characters")
		return
	}
	if len(req.MonthlyVolume) > 64 {
		common.ApiErrorMsg(c, "monthly_volume must be <= 64 characters")
		return
	}
	if len(req.RequiredModels) > 512 {
		common.ApiErrorMsg(c, "required_models must be <= 512 characters")
		return
	}
	if len(req.Message) > 1024 {
		common.ApiErrorMsg(c, "message must be <= 1024 characters")
		return
	}
	if !common.IsSafeRedirect(req.Redirect) {
		common.ApiErrorMsg(c, "unsafe redirect target")
		return
	}

	lead := &model.SalesLead{
		Name:           req.Name,
		Email:          req.Email,
		Company:        req.Company,
		Region:         req.Region,
		UseCase:        req.UseCase,
		MonthlyVolume:  req.MonthlyVolume,
		RequiredModels: req.RequiredModels,
		Message:        req.Message,
		Status:         "new",
		Source:         c.GetHeader("Referer"),
	}
	if err := model.CreateSalesLead(lead); err != nil {
		common.ApiError(c, err)
		return
	}

	// P1: 异步通知管理员（SMTP 未配置时静默跳过，不影响提交）
	notifySalesLeadAsync(lead)

	common.ApiSuccess(c, gin.H{"id": lead.Id})
}

// notifySalesLeadAsync 在后台给管理员发邮件通知，失败不影响线索提交。
func notifySalesLeadAsync(lead *model.SalesLead) {
	if common.SMTPServer == "" || common.SMTPAccount == "" || common.SMTPFrom == "" {
		return
	}
	go func() {
		body := fmt.Sprintf(
			"New OriginFlow sales lead\n\nName: %s\nEmail: %s\nCompany: %s\nRegion: %s\nUse case: %s\nMonthly volume: %s\nRequired models: %s\nMessage: %s\nSource: %s\n",
			lead.Name, lead.Email, lead.Company, lead.Region, lead.UseCase,
			lead.MonthlyVolume, lead.RequiredModels, lead.Message, lead.Source,
		)
		_ = common.SendEmail("New OriginFlow sales lead: "+lead.Name, common.SMTPFrom, body)
	}()
}

// TrackEventRequest 埋点事件上报体（P1-06）。
type TrackEventRequest struct {
	Event    string `json:"event"`
	Path     string `json:"path"`
	Locale   string `json:"locale"`
	Referrer string `json:"referrer"`
}

// TrackEvent 记录前端埋点事件（公开接口，限流 + 事件名校验）。
func TrackEvent(c *gin.Context) {
	var req TrackEventRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Event = strings.TrimSpace(req.Event)
	if !model.IsValidAnalyticsEvent(req.Event) {
		common.ApiErrorMsg(c, "invalid event")
		return
	}
	event := &model.AnalyticsEvent{
		Event:    req.Event,
		Path:     truncateStr(req.Path, 512),
		Locale:   truncateStr(req.Locale, 16),
		Referrer: truncateStr(req.Referrer, 512),
	}
	if err := model.CreateAnalyticsEvent(event); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// ── 销售线索后台管理（管理员，需 AdminAuth）─────────────────────────────────

// ListSalesLeads 管理员列出销售线索，可选 status 过滤。
func ListSalesLeads(c *gin.Context) {
	status := c.Query("status")
	leads, err := model.GetSalesLeads(status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": leads})
}

// GetSalesLead 管理员查看单条线索。
func GetSalesLead(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	lead, err := model.GetSalesLeadById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, lead)
}

// UpdateSalesLeadRequest 线索状态流转请求体。
type UpdateSalesLeadRequest struct {
	Status string `json:"status"`
	Note   string `json:"note"`
}

// UpdateSalesLead 管理员更新线索状态/备注（状态白名单校验）。
func UpdateSalesLead(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var req UpdateSalesLeadRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Status = strings.TrimSpace(req.Status)
	if !model.AllowedSalesLeadStatuses[req.Status] {
		common.ApiErrorMsg(c, "invalid status")
		return
	}
	if len(req.Note) > 4096 {
		common.ApiErrorMsg(c, "note too long")
		return
	}
	if err := model.UpdateSalesLeadStatus(id, req.Status, req.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}
