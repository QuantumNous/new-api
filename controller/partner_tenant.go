package controller

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createPartnerTenantRequest struct {
	Name  string `json:"name"`
	Group string `json:"group"`
}

func AdminListPartnerTenants(c *gin.Context) {
	tenants, err := model.ListPartnerTenants()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, tenants)
}

func AdminCreatePartnerTenant(c *gin.Context) {
	var req createPartnerTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Group = strings.TrimSpace(req.Group)
	if req.Name == "" || len([]rune(req.Name)) > 64 || req.Group == "" || req.Group == "auto" || req.Group == "default" {
		common.ApiErrorT(c, "A name and dedicated model group are required")
		return
	}
	if _, ok := ratio_setting.GetGroupRatioCopy()[req.Group]; !ok {
		common.ApiErrorT(c, "The model group does not exist")
		return
	}
	proofContext, err := json.Marshal(service.PartnerTenantSensitiveWriteContext{
		Action: "create",
		Group:  req.Group,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{
		Scope:   service.VerificationScopePartnerTenantSensitiveWrite,
		Context: proofContext,
	}) == nil {
		return
	}
	tenant, secret, err := model.CreatePartnerTenant(req.Name, req.Group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordPartnerTenantAdminAudit(c, "partner_tenant.create", tenant.Id, []string{"name", "group", "secret"})
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"tenant": tenant,
			"secret": secret,
		},
	})
}

func AdminRotatePartnerTenantSecret(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	proofContext, err := json.Marshal(service.PartnerTenantSensitiveWriteContext{
		Action:   "rotate_secret",
		TenantID: id,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{
		Scope:   service.VerificationScopePartnerTenantSensitiveWrite,
		Context: proofContext,
	}) == nil {
		return
	}
	secret, err := model.RotatePartnerTenantSecret(id)
	if err != nil {
		if err == model.ErrPartnerTenantNotFound {
			common.ApiErrorMsg(c, "Partner tenant not found")
		} else {
			common.ApiError(c, err)
		}
		return
	}
	recordPartnerTenantAdminAudit(c, "partner_tenant.secret_rotate", id, []string{"secret"})
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	common.ApiSuccess(c, gin.H{"secret": secret})
}

type updatePartnerTenantStatusRequest struct {
	Status *int `json:"status"`
}

func AdminUpdatePartnerTenantStatus(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var req updatePartnerTenantStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Status == nil || (*req.Status != model.PartnerTenantStatusEnabled && *req.Status != model.PartnerTenantStatusDisabled) {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := model.UpdatePartnerTenantStatus(id, *req.Status); err != nil {
		if err == model.ErrPartnerTenantNotFound {
			common.ApiErrorMsg(c, "Partner tenant not found")
		} else {
			common.ApiError(c, err)
		}
		return
	}
	action := "partner_tenant.enable"
	if *req.Status == model.PartnerTenantStatusDisabled {
		action = "partner_tenant.disable"
	}
	recordPartnerTenantAdminAudit(c, action, id, []string{"status"})
	common.ApiSuccess(c, nil)
}

type partnerTenantSubscriptionQuota struct {
	PlanID         int    `json:"plan_id"`
	PlanTitle      string `json:"plan_title"`
	StartTime      int64  `json:"start_time"`
	EndTime        int64  `json:"end_time"`
	Status         string `json:"status"`
	QuotaTotal     int64  `json:"quota_total"`
	QuotaUsed      int64  `json:"quota_used"`
	QuotaRemain    int64  `json:"quota_remaining"`
	QuotaUnlimited bool   `json:"quota_unlimited"`
	NextReset      int64  `json:"next_reset_time"`
}

func PartnerTenantSubscriptionQuota(c *gin.Context) {
	tenant := middleware.PartnerTenantFromContext(c)
	if tenant == nil {
		writePartnerTenantAPIError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication failed")
		return
	}
	externalUserID := strings.TrimSpace(c.Param("external_user_id"))
	account, err := model.GetPartnerTenantAccount(tenant.Id, externalUserID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writePartnerTenantAPIError(c, http.StatusNotFound, "account_not_found", "account not found")
		return
	}
	if err != nil {
		writePartnerTenantAPIError(c, http.StatusInternalServerError, "server_error", "please try again later")
		return
	}
	summaries, err := model.GetPartnerTenantActiveUserSubscriptions(tenant.Id, account.UserId)
	if err != nil {
		writePartnerTenantAPIError(c, http.StatusInternalServerError, "server_error", "please try again later")
		return
	}
	items := make([]partnerTenantSubscriptionQuota, 0, len(summaries))
	for _, summary := range summaries {
		if summary.Subscription == nil {
			continue
		}
		plan, err := model.GetSubscriptionPlanById(summary.Subscription.PlanId)
		if err != nil {
			writePartnerTenantAPIError(c, http.StatusInternalServerError, "server_error", "please try again later")
			return
		}
		if plan.PartnerTenantId != tenant.Id {
			continue
		}
		quotaRemain := int64(0)
		if summary.Subscription.AmountTotal > 0 {
			quotaRemain = max(summary.Subscription.AmountTotal-summary.Subscription.AmountUsed, 0)
		}
		items = append(items, partnerTenantSubscriptionQuota{
			PlanID:         plan.Id,
			PlanTitle:      plan.Title,
			StartTime:      summary.Subscription.StartTime,
			EndTime:        summary.Subscription.EndTime,
			Status:         summary.Subscription.Status,
			QuotaTotal:     summary.Subscription.AmountTotal,
			QuotaUsed:      summary.Subscription.AmountUsed,
			QuotaRemain:    quotaRemain,
			QuotaUnlimited: summary.Subscription.AmountTotal == 0,
			NextReset:      summary.Subscription.NextResetTime,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"external_user_id": externalUserID,
		"subscriptions":    items,
	})
}

func PartnerTenantListPlans(c *gin.Context) {
	tenant := middleware.PartnerTenantFromContext(c)
	if tenant == nil {
		writePartnerTenantAPIError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication failed")
		return
	}
	plans := make([]model.SubscriptionPlan, 0)
	if err := model.DB.Where("enabled = ? AND partner_tenant_id = ?", true, tenant.Id).
		Order("sort_order desc, id desc").Find(&plans).Error; err != nil {
		writePartnerTenantAPIError(c, http.StatusInternalServerError, "server_error", "please try again later")
		return
	}
	for i := range plans {
		plans[i].NormalizeDefaults()
	}
	c.JSON(http.StatusOK, gin.H{"plans": plans})
}

type partnerTenantGrantSubscriptionRequest struct {
	PlanId int `json:"plan_id"`
}

func PartnerTenantGrantSubscription(c *gin.Context) {
	tenant := middleware.PartnerTenantFromContext(c)
	if tenant == nil {
		writePartnerTenantAPIError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication failed")
		return
	}
	externalUserID := strings.TrimSpace(c.Param("external_user_id"))
	if !model.IsValidPartnerTenantExternalUserID(externalUserID) {
		writePartnerTenantAPIError(c, http.StatusBadRequest, "invalid_request", "external_user_id is invalid")
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<10)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	var req partnerTenantGrantSubscriptionRequest
	if err := decoder.Decode(&req); err != nil {
		writePartnerTenantAPIError(c, http.StatusBadRequest, "invalid_request", "request body is invalid")
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF || req.PlanId <= 0 {
		writePartnerTenantAPIError(c, http.StatusBadRequest, "invalid_request", "request body must contain a positive plan_id")
		return
	}
	idempotencyHash, err := service.ValidatePartnerOAuthIdempotencyKey(c.GetHeader("Idempotency-Key"))
	if err != nil {
		writePartnerTenantAPIError(c, http.StatusBadRequest, "invalid_request", "Idempotency-Key header is required and must be 16-64 URL-safe characters")
		return
	}
	requestHash := model.PartnerTenantSubscriptionRequestHash(externalUserID, req.PlanId)
	subscription, created, err := model.GrantPartnerTenantSubscription(tenant.Id, externalUserID, req.PlanId, idempotencyHash, requestHash)
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		writePartnerTenantAPIError(c, http.StatusNotFound, "account_not_found", "account not found")
		return
	case errors.Is(err, model.ErrPartnerTenantPlanNotFound):
		writePartnerTenantAPIError(c, http.StatusNotFound, "plan_not_found", "plan not found")
		return
	case errors.Is(err, model.ErrPartnerTenantIdempotencyConflict):
		writePartnerTenantAPIError(c, http.StatusConflict, "idempotency_conflict", "Idempotency-Key was used with a different request")
		return
	case errors.Is(err, model.ErrPartnerTenantNotFound):
		writePartnerTenantAPIError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication failed")
		return
	case err != nil:
		writePartnerTenantAPIError(c, http.StatusInternalServerError, "server_error", "please try again later")
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	c.JSON(status, gin.H{
		"external_user_id": externalUserID,
		"subscription_id":  subscription.Id,
		"plan_id":          subscription.PlanId,
		"status":           subscription.Status,
		"start_time":       subscription.StartTime,
		"end_time":         subscription.EndTime,
		"quota_total":      subscription.AmountTotal,
		"quota_used":       subscription.AmountUsed,
		"quota_unlimited":  subscription.AmountTotal == 0,
		"next_reset_time":  subscription.NextResetTime,
		"created":          created,
	})
}

type provisionPartnerTenantAccountRequest struct {
	ExternalUserId string `json:"external_user_id"`
	DisplayName    string `json:"display_name"`
}

func PartnerTenantProvisionAccount(c *gin.Context) {
	tenant := middleware.PartnerTenantFromContext(c)
	if tenant == nil {
		writePartnerTenantAPIError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication failed")
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<10)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	var req provisionPartnerTenantAccountRequest
	if err := decoder.Decode(&req); err != nil {
		writePartnerTenantAPIError(c, http.StatusBadRequest, "invalid_request", "request body is invalid")
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writePartnerTenantAPIError(c, http.StatusBadRequest, "invalid_request", "request body must contain one JSON object")
		return
	}
	req.ExternalUserId = strings.TrimSpace(req.ExternalUserId)
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if !model.IsValidPartnerTenantExternalUserID(req.ExternalUserId) || utf8.RuneCountInString(req.DisplayName) > 128 {
		writePartnerTenantAPIError(c, http.StatusBadRequest, "invalid_request", "external_user_id or display_name is invalid")
		return
	}
	account, err := model.ProvisionPartnerTenantAccount(tenant.Id, req.ExternalUserId, req.DisplayName)
	if errors.Is(err, model.ErrPartnerTenantNotFound) {
		writePartnerTenantAPIError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication failed")
		return
	}
	if errors.Is(err, model.ErrPartnerTenantAccountDisabled) {
		writePartnerTenantAPIError(c, http.StatusForbidden, "account_disabled", "account is disabled")
		return
	}
	if errors.Is(err, model.ErrPartnerTenantCredentialUnavailable) {
		writePartnerTenantAPIError(c, http.StatusConflict, "credential_unavailable", "account credential is unavailable")
		return
	}
	if err != nil {
		writePartnerTenantAPIError(c, http.StatusInternalServerError, "server_error", "please try again later")
		return
	}
	status := http.StatusOK
	if account.Created {
		status = http.StatusCreated
	}
	c.JSON(status, gin.H{
		"external_user_id": account.ExternalUserId,
		"api_key":          account.APIKey,
		"created":          account.Created,
	})
}

func writePartnerTenantAPIError(c *gin.Context, status int, code, message string) {
	requestID := c.GetString(common.RequestIdKey)
	c.Header("X-Request-Id", requestID)
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(status, gin.H{
		"error":      gin.H{"code": code, "message": message},
		"request_id": requestID,
	})
}

func recordPartnerTenantAdminAudit(c *gin.Context, action string, tenantID int64, fields []string) {
	role := c.GetInt("role")
	params := model.AuditFields{"tenant_id": tenantID, "actor_id": c.GetInt("id"), "actor_role": role}
	if len(fields) > 0 {
		params["changed_fields"] = fields
	}
	model.RecordAuditLog(c, model.AuditLog{
		UserId:    c.GetInt("id"),
		ActorRole: role,
		Category:  model.AuditCategorySecurity,
		Action:    action,
		Success:   true,
		Other:     model.AuditOther{Op: &model.AuditOperation{Action: action, Params: params}},
	})
	markAuditLogged(c)
}
