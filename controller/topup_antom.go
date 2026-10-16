package controller

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func GetAntomConfig(c *gin.Context) {
	config, err := model.CurrentAntomConfig()
	if err != nil {
		common.ApiErrorMsg(c, "Unable to load Antom configuration")
		return
	}
	common.ApiSuccess(c, gin.H{"config": config, "has_secret": config.Secret != ""})
}
func SaveAntomConfig(c *gin.Context) {
	if c.GetBool("use_access_token") || c.GetInt("role") != common.RoleRootUser {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	if c.ContentType() != "application/json" {
		c.AbortWithStatus(http.StatusUnsupportedMediaType)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 65536))
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var req struct {
		model.AntomConfig
		Secret string `json:"secret"`
	}
	if common.Unmarshal(body, &req) != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	current, err := model.CurrentAntomConfig()
	if err != nil || current.ID != req.ID {
		common.ApiErrorMsg(c, "Antom configuration changed; refresh and retry")
		return
	}
	req.AntomConfig.Secret = req.Secret
	if req.Secret == "" && current.ClientID == req.ClientID && current.Sandbox == req.Sandbox {
		req.AntomConfig.Secret = current.Secret
	}
	if err := service.ValidateAntomConfig(&req.AntomConfig); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Enabled && !requirePaymentCompliance(c) {
		return
	}
	hash := sha256.Sum256(body)
	binding, _ := common.Marshal(map[string]string{"config_hash": hex.EncodeToString(hash[:])})
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAntomConfig, Context: binding}) == nil {
		return
	}
	req.PreviousID = current.ID
	req.ID = 0
	if err := model.DB.Session(&gorm.Session{Logger: logger.Discard}).Create(&req.AntomConfig).Error; err != nil {
		common.ApiErrorMsg(c, "Unable to save Antom configuration")
		return
	}
	model.RecordAuditLog(c, model.AuditLog{UserId: c.GetInt("id"), ActorRole: c.GetInt("role"), Category: model.AuditCategoryOperation, Action: "payment.antom.configure", Content: "Antom configuration revision created", Success: true})
	common.ApiSuccess(c, gin.H{"config": req.AntomConfig, "has_secret": req.AntomConfig.Secret != ""})
}
func AntomQuote(c *gin.Context)          { requestAntom(c, false) }
func RequestAntomPayment(c *gin.Context) { requestAntom(c, true) }
func requestAntom(c *gin.Context, create bool) {
	var req struct {
		Amount         int64  `json:"amount"`
		PlanID         int    `json:"plan_id"`
		ExpectedAmount string `json:"expected_amount"`
		RequestKey     string `json:"request_key"`
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	if c.ContentType() != "application/json" || c.ShouldBindJSON(&req) != nil || req.PlanID < 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if strings.HasPrefix(c.FullPath(), "/api/subscription/") && req.PlanID <= 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	userID := c.GetInt("id")
	if create {
		if _, err := uuid.Parse(req.RequestKey); err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		var existing model.AntomOrder
		err := model.DB.Where("user_id = ? AND request_key = ?", userID, req.RequestKey).First(&existing).Error
		if err == nil {
			var sub model.SubscriptionOrder
			planID := 0
			if strings.HasPrefix(existing.TradeNo, "SUB") {
				if model.DB.Where("trade_no = ?", existing.TradeNo).First(&sub).Error != nil {
					c.AbortWithStatus(http.StatusServiceUnavailable)
					return
				}
				planID = sub.PlanId
			}
			if planID != req.PlanID || existing.RequestedAmount != req.Amount || existing.Amount != req.ExpectedAmount {
				c.AbortWithStatus(http.StatusConflict)
				return
			}
			o, config, e := model.GetAntomOrder(existing.TradeNo)
			if e != nil {
				c.AbortWithStatus(http.StatusServiceUnavailable)
				return
			}
			common.ApiSuccess(c, service.AntomCheckout(o, config))
			return
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.AbortWithStatus(http.StatusServiceUnavailable)
			return
		}
	}
	config, err := model.CurrentAntomConfig()
	if err == nil && config.Sandbox && c.GetInt("role") != common.RoleRootUser {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	if err != nil || !config.Enabled || !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorMsg(c, "Antom payments are not enabled")
		return
	}
	group := ""
	if req.PlanID == 0 {
		group, err = model.GetUserGroup(userID, true)
		if err != nil {
			common.ApiErrorMsg(c, "Unable to load user group")
			return
		}
	}
	amount, quota, plan, err := service.QuoteAntomOrder(config, req.Amount, group, req.PlanID)
	if err == nil && req.PlanID == 0 {
		err = model.ValidateTopUpQuotaCapacity(userID, quota)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !create {
		common.ApiSuccess(c, amount)
		return
	}
	if amount != req.ExpectedAmount {
		common.ApiErrorMsg(c, "Payment amount changed; please try again")
		return
	}
	now := common.GetTimestamp()
	trade := "ANT" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if plan != nil {
		trade = "SUB" + trade
	}
	o := model.AntomOrder{TradeNo: trade, UserID: userID, RequestKey: req.RequestKey, RequestedAmount: req.Amount, ConfigID: config.ID, Amount: amount, CreditedQuota: quota, Status: "pending", CreatedAt: now, ExpiresAt: now + 1800}
	money, _ := decimal.NewFromString(amount)
	top := model.TopUp{UserId: userID, Amount: decimal.NewFromInt(int64(quota)).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart(), Money: money.InexactFloat64(), TradeNo: trade, PaymentMethod: model.PaymentProviderAntom, PaymentProvider: model.PaymentProviderAntom, CreateTime: now, Status: "pending"}
	if plan != nil {
		sub := model.SubscriptionOrder{UserId: userID, PlanId: plan.Id, Money: plan.PriceAmount, TradeNo: trade, PaymentMethod: model.PaymentProviderAntom, PaymentProvider: model.PaymentProviderAntom, CreateTime: now, Status: common.TopUpStatusPending}
		err = model.CreateDirectSubscriptionOrder(&sub, plan, &o)
	} else {
		err = model.CreateAntomOrder(&o, &top)
	}
	if err != nil {
		common.ApiErrorMsg(c, "Unable to create Antom order; retry with the same request")
		return
	}
	common.ApiSuccess(c, service.AntomCheckout(&o, config))
}
func AntomNotify(c *gin.Context) {
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 65536))
	if err != nil {
		c.AbortWithStatus(400)
		return
	}
	o, config, err := model.GetAntomOrder(c.Param("trade_no"))
	if err != nil {
		c.AbortWithStatus(400)
		return
	}
	if service.VerifyAntomSignature(config, c.Request.URL.EscapedPath(), c.GetHeader("Client-Id"), c.GetHeader("Request-Time"), c.GetHeader("Signature"), body) != nil {
		c.AbortWithStatus(400)
		return
	}
	var notify struct {
		Type         string `json:"notifyType"`
		RequestID    string `json:"paymentRequestId"`
		RefundStatus string `json:"refundStatus"`
	}
	if common.Unmarshal(body, &notify) != nil || (notify.Type != "PAYMENT_RESULT" && notify.Type != "CAPTURE_RESULT" && notify.Type != "REFUND_RESULT") || (notify.RequestID != "" && notify.RequestID != o.TradeNo) {
		c.AbortWithStatus(400)
		return
	}
	// Refunds and changes to a received payment need a fresh inquiry: the normal
	// fulfillment worker intentionally skips gateway queries for completed orders.
	// A failed inquiry is not acknowledged so Antom can retry the notification.
	if notify.Type == "REFUND_RESULT" || o.Status == "paid" || o.Status == "success" {
		if notify.Type == "REFUND_RESULT" && notify.RefundStatus == "SUCCESS" {
			// A verified refund notification fences fulfillment while inquiry catches
			// up. It never debits a wallet or replaces the verified gateway result.
			if err = model.DB.Model(o).Updates(map[string]any{"review_required": true, "last_error": "manual_review_required"}).Error; err != nil {
				c.AbortWithStatus(http.StatusServiceUnavailable)
				return
			}
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
		defer cancel()
		err = service.RecheckAntomOrder(ctx, o.TradeNo)
		if err != nil && !errors.Is(err, model.ErrPaymentReviewRequired) {
			c.AbortWithStatus(http.StatusServiceUnavailable)
			return
		}
		if notify.Type == "REFUND_RESULT" && notify.RefundStatus == "SUCCESS" {
			verified, _, readErr := model.GetAntomOrder(o.TradeNo)
			if readErr != nil || verified.GatewayStatus != "REFUNDED" {
				// Notification and inquiry can become visible at different times.
				// Keep retrying rather than lose a refund behind a stale success result.
				c.AbortWithStatus(http.StatusServiceUnavailable)
				return
			}
		}
		c.JSON(200, gin.H{"result": gin.H{"resultCode": "SUCCESS", "resultStatus": "S", "resultMessage": "success."}})
		return
	}
	// Signed notifications only wake an authoritative query. Never credit based on a client event.
	if err = model.DB.Model(o).Where("status IN ? AND COALESCE(gateway_status, '') NOT IN ?", []string{"pending", "expired"}, []string{"FAIL", "CANCELLED"}).Update("next_check_at", common.GetTimestamp()).Error; err != nil {
		c.AbortWithStatus(503)
		return
	}
	c.JSON(200, gin.H{"result": gin.H{"resultCode": "SUCCESS", "resultStatus": "S", "resultMessage": "success."}})
}
func CreateAntomCheckoutSession(c *gin.Context) {
	o, config, err := model.GetAntomOrder(c.Param("trade_no"))
	if err != nil || o.UserID != c.GetInt("id") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if config.Sandbox && c.GetInt("role") != common.RoleRootUser {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	data, err := service.CreateAntomSession(c.Request.Context(), o, config, c.ClientIP())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	common.ApiSuccess(c, gin.H{"checkout_url": data})
}
func GetAntomOrderStatus(c *gin.Context) {
	o, config, err := model.GetAntomOrder(c.Param("trade_no"))
	if err != nil || o.UserID != c.GetInt("id") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	common.ApiSuccess(c, service.AntomCheckout(o, config))
}

// RecheckAntomOrder verifies the result with the provider before returning local state.
func RecheckAntomOrder(c *gin.Context) {
	trade := c.Param("trade_no")
	LockOrder(trade)
	defer UnlockOrder(trade)
	o, config, err := model.GetAntomOrder(trade)
	if err != nil || o.UserID != c.GetInt("id") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	// Repeated return-page requests share the recently verified result.
	if o.Status == "paid" || (o.PaymentUnresolved() && o.CheckedAt <= common.GetTimestamp()-5) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
		defer cancel()
		if err = service.ReconcileAntomOrder(ctx, trade); err != nil {
			common.ApiError(c, err)
			return
		}
		o, config, err = model.GetAntomOrder(trade)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	c.Header("Cache-Control", "no-store")
	common.ApiSuccess(c, service.AntomCheckout(o, config))
}
