package controller

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"net/url"
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
)

func GetMixPayConfig(c *gin.Context) {
	config, err := model.CurrentMixPayConfig()
	if err != nil {
		common.ApiErrorMsg(c, "无法读取 MixPay 配置")
		return
	}
	common.ApiSuccess(c, gin.H{"config": config})
}

func SaveMixPayConfig(c *gin.Context) {
	if c.GetBool("use_access_token") || c.GetInt("role") != common.RoleRootUser {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	if c.ContentType() != "application/json" {
		c.AbortWithStatus(http.StatusUnsupportedMediaType)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 8192))
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var config model.MixPayConfig
	if common.Unmarshal(body, &config) != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if err := service.ValidateMixPayConfig(&config); err != nil {
		common.ApiError(c, err)
		return
	}
	if config.Enabled && !requirePaymentCompliance(c) {
		return
	}
	hash := sha256.Sum256(body)
	binding, _ := common.Marshal(map[string]string{"config_hash": hex.EncodeToString(hash[:])})
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeMixPayConfig, Context: binding}) == nil {
		return
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		// Serialize configuration changes with other operations on the root account.
		if err := tx.Model(&model.User{}).Where("id = ?", c.GetInt("id")).UpdateColumn("id", gorm.Expr("id")).Error; err != nil {
			return err
		}
		var current model.MixPayConfig
		err := tx.Order("id DESC").First(&current).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if current.ID != config.ID {
			return errors.New("MixPay 配置已变更，请刷新后重试")
		}
		config.ID = 0
		config.CreatedAt = common.GetTimestamp()
		return tx.Create(&config).Error
	})
	if err != nil {
		common.ApiErrorMsg(c, "保存 MixPay 配置失败，请刷新后重试")
		return
	}
	model.RecordAuditLog(c, model.AuditLog{UserId: c.GetInt("id"), ActorRole: c.GetInt("role"), Category: model.AuditCategoryOperation, Action: "payment.mixpay.configure", Content: "MixPay configuration revision created", Success: true})
	common.ApiSuccess(c, gin.H{"config": config})
}

type mixPayPurchaseRequest struct {
	Amount         int64  `json:"amount"`
	PlanID         int    `json:"plan_id"`
	ExpectedAmount string `json:"expected_amount"`
	RequestKey     string `json:"request_key"`
}

func MixPayQuote(c *gin.Context) {
	var req mixPayPurchaseRequest
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	if c.ContentType() != "application/json" || c.ShouldBindJSON(&req) != nil || req.PlanID < 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	config, err := model.CurrentMixPayConfig()
	if err != nil || !config.Enabled || !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorMsg(c, "MixPay 未启用")
		return
	}
	group, err := model.GetUserGroup(c.GetInt("id"), true)
	if err != nil {
		common.ApiErrorMsg(c, "无法获取用户分组")
		return
	}
	amount, quota, _, err := service.QuoteMixPay(config, req.Amount, group, req.PlanID)
	if err == nil && req.PlanID == 0 {
		err = model.ValidateTopUpQuotaCapacity(c.GetInt("id"), quota)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, amount)
}

func RequestMixPayPayment(c *gin.Context) {
	var req mixPayPurchaseRequest
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	if c.ContentType() != "application/json" || c.ShouldBindJSON(&req) != nil || req.PlanID < 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if _, err := uuid.Parse(req.RequestKey); err != nil {
		common.ApiErrorMsg(c, "无效的支付请求标识")
		return
	}
	if strings.HasPrefix(c.FullPath(), "/api/subscription/") && req.PlanID <= 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	userID := c.GetInt("id")
	existing, err := model.FindMixPayRequest(userID, req.RequestKey)
	if err == nil {
		if existing.RequestedAmount != req.Amount || existing.PlanID != req.PlanID {
			c.AbortWithStatus(http.StatusConflict)
			return
		}
		common.ApiSuccess(c, service.MixPayCheckout(existing))
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	config, err := model.CurrentMixPayConfig()
	if err != nil || !config.Enabled || !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorMsg(c, "MixPay 未启用")
		return
	}
	group, err := model.GetUserGroup(userID, true)
	if err != nil {
		common.ApiErrorMsg(c, "无法获取用户分组")
		return
	}
	amount, quota, plan, err := service.QuoteMixPay(config, req.Amount, group, req.PlanID)
	if err == nil && plan == nil {
		err = model.ValidateTopUpQuotaCapacity(userID, quota)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	expected, err := service.MixPayAmount(req.ExpectedAmount)
	actual, _ := decimal.NewFromString(amount)
	if err != nil || !expected.Equal(actual) {
		common.ApiErrorMsg(c, "支付金额已变化，请重新确认")
		return
	}
	now := common.GetTimestamp()
	trade := "MX" + strings.ReplaceAll(uuid.NewString(), "-", "")
	returnURL, err := url.Parse(config.ReturnURL)
	if err != nil || returnURL.Host == "" {
		common.ApiErrorMsg(c, "Invalid payment redirect URL")
		return
	}
	returnURL.Path = "/payment/mixpay/" + trade
	returnURL.RawPath, returnURL.RawQuery, returnURL.Fragment = "", "", ""
	o := model.MixPayOrder{TradeNo: trade, TraceID: uuid.NewString(), UserID: userID, RequestKey: req.RequestKey, RequestedAmount: req.Amount, PlanID: req.PlanID, ConfigID: config.ID, PayeeID: config.PayeeID, QuoteAmount: amount, QuoteAssetID: "usd", SettlementAssetID: config.SettlementAssetID, StrictMode: config.StrictMode, CallbackURL: service.MixPayCallbackURL(config), ReturnURL: returnURL.String(), CreditedQuota: quota, CreationState: "queued", Status: "pending", CreatedAt: now, ExpiresAt: now + config.TTLSeconds, NextCheckAt: now}
	top := model.TopUp{UserId: userID, Amount: req.Amount, Money: actual.InexactFloat64(), TradeNo: trade, PaymentMethod: model.PaymentMethodMixPay, PaymentProvider: model.PaymentProviderMixPay, CreateTime: now, Status: common.TopUpStatusPending}
	var sub *model.SubscriptionOrder
	if plan != nil {
		sub = &model.SubscriptionOrder{UserId: userID, PlanId: plan.Id, Money: top.Money, TradeNo: trade, PaymentMethod: model.PaymentMethodMixPay, PaymentProvider: model.PaymentProviderMixPay, CreateTime: now, Status: common.TopUpStatusPending}
	}
	if err := model.CreateMixPayOrder(&o, &top, sub, plan); err != nil {
		duplicate, readErr := model.FindMixPayRequest(userID, req.RequestKey)
		if readErr == nil && duplicate.RequestedAmount == req.Amount && duplicate.PlanID == req.PlanID {
			common.ApiSuccess(c, service.MixPayCheckout(duplicate))
			return
		}
		common.ApiErrorMsg(c, "无法创建支付订单，请检查未完成订单后重试")
		return
	}
	_ = service.ReconcileMixPayOrder(c.Request.Context(), trade)
	saved, err := model.GetMixPayOrder(trade)
	if err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	common.ApiSuccess(c, service.MixPayCheckout(saved))
}

func GetMixPayOrderStatus(c *gin.Context) {
	o, err := model.GetMixPayOrder(c.Param("trade_no"))
	if err != nil || o.UserID != c.GetInt("id") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	common.ApiSuccess(c, service.MixPayCheckout(o))
}

func MixPayNotify(c *gin.Context) {
	// ClientIP is safe only with the application's explicit trusted proxy setup.
	if c.ClientIP() != "52.198.117.57" {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	var req struct {
		OrderID string `json:"orderId"`
		TraceID string `json:"traceId"`
		PayeeID string `json:"payeeId"`
	}
	if c.ContentType() != "application/json" || c.ShouldBindJSON(&req) != nil || len(req.OrderID) > 36 || len(req.TraceID) > 36 || len(req.PayeeID) > 64 || (req.OrderID == "" && req.TraceID == "") {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var o model.MixPayOrder
	query := model.DB.Where("payee_id = ?", req.PayeeID)
	if req.OrderID != "" {
		query = query.Where("trade_no = ?", req.OrderID)
	}
	if req.TraceID != "" {
		query = query.Where("trace_id = ?", req.TraceID)
	}
	if err := query.First(&o).Error; err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if err := model.WakeMixPayOrder(o.TradeNo); err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS"})
}

// RecheckMixPayReturn never creates a checkout or trusts browser return parameters.
func RecheckMixPayReturn(c *gin.Context) {
	trade := c.Param("trade_no")
	LockOrder(trade)
	defer UnlockOrder(trade)
	o, err := model.GetMixPayOrder(trade)
	if err != nil || o.UserID != c.GetInt("id") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if (o.Status == "pending" || o.Status == "paid") && o.CreationState != "queued" && o.CheckedAt <= common.GetTimestamp()-5 && o.LeaseUntil <= common.GetTimestamp() {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
		defer cancel()
		if err = service.RecheckMixPayOrder(ctx, trade); err != nil {
			common.ApiError(c, err)
			return
		}
		o, err = model.GetMixPayOrder(trade)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	c.Header("Cache-Control", "no-store")
	common.ApiSuccess(c, service.MixPayCheckout(o))
}
