package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

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

func GetWebMoneyConfig(c *gin.Context) {
	config, err := model.CurrentWebMoneyConfig()
	if err != nil {
		common.ApiErrorMsg(c, "Unable to load WebMoney configuration")
		return
	}
	common.ApiSuccess(c, gin.H{"config": config, "has_secret": config.Secret != ""})
}
func SaveWebMoneyConfig(c *gin.Context) {
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
	var req struct {
		model.WebMoneyConfig
		Secret string `json:"secret"`
	}
	if common.Unmarshal(body, &req) != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	current, err := model.CurrentWebMoneyConfig()
	if err != nil || current.ID != req.ID {
		common.ApiErrorMsg(c, "WebMoney configuration changed; refresh and retry")
		return
	}
	req.WebMoneyConfig.Secret = req.Secret
	if req.Secret == "" && current.Purse == req.Purse {
		req.WebMoneyConfig.Secret = current.Secret
	}
	if err := service.ValidateWebMoneyConfig(&req.WebMoneyConfig); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Enabled && !requirePaymentCompliance(c) {
		return
	}
	hash := sha256.Sum256(body)
	binding, _ := common.Marshal(map[string]string{"config_hash": hex.EncodeToString(hash[:])})
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeWebMoneyConfig, Context: binding}) == nil {
		return
	}
	req.PreviousID = current.ID
	req.ID = 0
	if err := model.DB.Session(&gorm.Session{Logger: logger.Discard}).Create(&req.WebMoneyConfig).Error; err != nil {
		common.ApiErrorMsg(c, "Unable to save WebMoney configuration")
		return
	}
	model.RecordAuditLog(c, model.AuditLog{UserId: c.GetInt("id"), ActorRole: c.GetInt("role"), Category: model.AuditCategoryOperation, Action: "payment.webmoney.configure", Content: "WebMoney configuration revision created", Success: true})
	common.ApiSuccess(c, gin.H{"config": req.WebMoneyConfig, "has_secret": req.WebMoneyConfig.Secret != ""})
}
func WebMoneyQuote(c *gin.Context)          { requestWebMoney(c, false) }
func RequestWebMoneyPayment(c *gin.Context) { requestWebMoney(c, true) }
func requestWebMoney(c *gin.Context, create bool) {
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
		var existing model.WebMoneyOrder
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
			o, config, e := model.GetWebMoneyOrder(existing.TradeNo)
			if e != nil {
				c.AbortWithStatus(http.StatusServiceUnavailable)
				return
			}
			common.ApiSuccess(c, service.WebMoneyCheckout(o, config))
			return
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.AbortWithStatus(http.StatusServiceUnavailable)
			return
		}
	}
	config, err := model.CurrentWebMoneyConfig()
	if err != nil || !config.Enabled || !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorMsg(c, "WebMoney payments are not enabled")
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
	amount, quota, plan, err := service.QuoteWebMoneyOrder(config, req.Amount, group, req.PlanID)
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
	trade := "WM" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if plan != nil {
		trade = "SUB" + trade
	}
	o := model.WebMoneyOrder{TradeNo: trade, UserID: userID, RequestKey: req.RequestKey, RequestedAmount: req.Amount, ConfigID: config.ID, Amount: amount, CreditedQuota: quota, Status: "pending", CreatedAt: now, ExpiresAt: now + 1800}
	money, _ := decimal.NewFromString(amount)
	top := model.TopUp{UserId: userID, Amount: decimal.NewFromInt(int64(quota)).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart(), Money: money.InexactFloat64(), TradeNo: trade, PaymentMethod: model.PaymentProviderWebMoney, PaymentProvider: model.PaymentProviderWebMoney, CreateTime: now, Status: "pending"}
	if plan != nil {
		sub := model.SubscriptionOrder{UserId: userID, PlanId: plan.Id, Money: plan.PriceAmount, TradeNo: trade, PaymentMethod: model.PaymentProviderWebMoney, PaymentProvider: model.PaymentProviderWebMoney, CreateTime: now, Status: common.TopUpStatusPending}
		err = model.CreateDirectSubscriptionOrder(&sub, plan, &o)
	} else {
		err = model.CreateWebMoneyOrder(&o, &top)
	}
	if err != nil {
		common.ApiErrorMsg(c, "Unable to create WebMoney order; retry with the same request")
		return
	}
	common.ApiSuccess(c, service.WebMoneyCheckout(&o, config))
}
func WebMoneyNotify(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16384)
	if c.ContentType() != "application/x-www-form-urlencoded" || c.Request.ParseForm() != nil {
		c.String(400, "NO")
		return
	}
	v := c.Request.PostForm
	id, err := strconv.ParseInt(v.Get("LMI_PAYMENT_NO"), 10, 64)
	if err != nil || id <= 0 {
		c.String(400, "NO")
		return
	}
	var order model.WebMoneyOrder
	if model.DB.First(&order, id).Error != nil {
		c.String(400, "NO")
		return
	}
	o, config, err := model.GetWebMoneyOrder(order.TradeNo)
	if err != nil {
		c.String(503, "NO")
		return
	}
	if v.Get("LMI_PREREQUEST") == "1" {
		if service.ValidateWebMoneyPayment(o, config, v) != nil || o.Status != "pending" || o.ExpiresAt <= common.GetTimestamp() {
			c.String(400, "NO")
			return
		}
		c.String(200, "YES")
		return
	}
	if service.VerifyWebMoneyNotification(o, config, v) != nil {
		c.String(400, "NO")
		return
	}
	if model.RecordWebMoneyPayment(o, v.Get("LMI_SYS_TRANS_NO")) != nil {
		c.String(503, "NO")
		return
	}
	// Evidence is durable before ACK; the background worker retries fulfillment.
	_ = model.CompleteWebMoneyOrder(o.TradeNo)
	c.String(200, "YES")
}
func GetWebMoneyOrderStatus(c *gin.Context) {
	o, config, err := model.GetWebMoneyOrder(c.Param("trade_no"))
	if err != nil || o.UserID != c.GetInt("id") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	common.ApiSuccess(c, service.WebMoneyCheckout(o, config))
}
