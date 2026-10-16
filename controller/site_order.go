package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetSiteOrders(c *gin.Context) {
	if c.GetInt("role") < common.RoleAdminUser {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	filter := model.SiteOrderFilter{Page: 1, PageSize: 20}
	if c.ShouldBindQuery(&filter) != nil || (filter.End > 0 && filter.Start > filter.End) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	orders, total, err := model.ListSiteOrders(filter)
	if err != nil {
		common.ApiErrorMsg(c, "无法读取订单")
		return
	}
	common.ApiSuccess(c, gin.H{"items": orders, "total": total, "page": filter.Page, "page_size": filter.PageSize})
}

func GetSiteOrder(c *gin.Context) {
	if c.GetInt("role") < common.RoleAdminUser {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id == 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	order, err := model.GetSiteOrder(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	if err := model.DB.Where("trade_no = ? AND provider = ?", order.TradeNo, order.PaymentProvider).Order("id DESC").Limit(20).Find(&order.Reviews).Error; err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	common.ApiSuccess(c, order)
}

func ReviewSiteOrder(c *gin.Context) {
	if c.GetInt("role") < common.RoleRootUser || c.GetBool("use_access_token") {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	if c.ContentType() != "application/json" {
		c.AbortWithStatus(http.StatusUnsupportedMediaType)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	var request struct {
		Note string `json:"note"`
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id == 0 || c.ShouldBindJSON(&request) != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	order, err := model.GetSiteOrder(id)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if err = model.RecordPaymentReview(order, c.GetInt("id"), request.Note); err != nil {
		common.ApiErrorMsg(c, "无法记录复核结果，请检查订单状态及备注长度")
		return
	}
	model.RecordAuditLog(c, model.AuditLog{UserId: c.GetInt("id"), ActorRole: c.GetInt("role"), Category: model.AuditCategoryOperation, Action: "payment.order.review", Content: order.TradeNo, Success: true})
	common.ApiSuccess(c, nil)
}

func RecheckSiteOrder(c *gin.Context) {
	reconcileSiteOrder(c, "")
}

func RecoverSiteOrder(c *gin.Context) {
	if c.GetInt("role") < common.RoleRootUser || c.GetBool("use_access_token") {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	if c.ContentType() != "application/json" {
		c.AbortWithStatus(http.StatusUnsupportedMediaType)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	var req struct {
		Reason string `json:"reason"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if utf8.RuneCountInString(req.Reason) < 5 || utf8.RuneCountInString(req.Reason) > 500 {
		common.ApiErrorMsg(c, "补单原因需填写 5 至 500 个字符")
		return
	}
	reconcileSiteOrder(c, req.Reason)
}

func reconcileSiteOrder(c *gin.Context, reason string) {
	if c.GetInt("role") < common.RoleRootUser || c.GetBool("use_access_token") {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id == 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	order, err := model.GetSiteOrder(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	if order.PaymentProvider != model.PaymentProviderMixPay && order.PaymentProvider != model.PaymentProviderAntom && order.PaymentProvider != model.PaymentProviderWebMoney && order.PaymentProvider != model.PaymentProviderAlipay && order.PaymentProvider != model.PaymentProviderWechatPay {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	LockOrder(order.TradeNo)
	defer UnlockOrder(order.TradeNo)
	// Read again after the process lock; database settlement remains the cross-instance guard.
	order, err = model.GetSiteOrder(id)
	if err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	beforeStatus := order.OrderStatus
	if order.PaymentProvider == model.PaymentProviderMixPay {
		err = service.RecheckMixPayOrder(c.Request.Context(), order.TradeNo)
	} else if order.PaymentProvider == model.PaymentProviderAntom {
		err = service.RecheckAntomOrder(c.Request.Context(), order.TradeNo)
	} else if order.PaymentProvider == model.PaymentProviderWebMoney {
		err = service.RecheckWebMoneyOrder(c.Request.Context(), order.TradeNo)
	} else if order.PaymentProvider == model.PaymentProviderAlipay {
		err = service.RecheckAlipayOrder(c.Request.Context(), order.TradeNo)
	} else {
		err = service.RecheckWechatPayOrder(c.Request.Context(), order.TradeNo)
	}

	result := "verification_failed"
	updated, readErr := model.GetSiteOrder(id)
	if err == nil && errors.Is(readErr, gorm.ErrRecordNotFound) {
		result = "closed"
		readErr = nil
	}
	if readErr == nil && updated != nil {
		switch updated.OrderStatus {
		case common.TopUpStatusSuccess:
			result = "credited"
			if beforeStatus == common.TopUpStatusSuccess {
				result = "already_credited"
			}
			if updated.CachePending {
				result = "cache_pending"
			}
		case "paid":
			result = "credit_pending"
		case common.TopUpStatusExpired:
			result = "closed"
			if updated.CloseReason == "local_expiry" {
				result = "expired"
			}
		case common.TopUpStatusPending:
			if err == nil {
				result = "unpaid"
			}
		}
	}
	if (err != nil && !errors.Is(err, service.ErrPaymentFulfillmentPending)) || readErr != nil || (updated != nil && updated.ReviewRequired) {
		result = "verification_failed"
	}
	if order.PaymentProvider == model.PaymentProviderMixPay {
		if err != nil || (updated != nil && updated.ReviewRequired) {
			result = "verification_failed"
		} else if updated != nil && updated.OrderStatus == "failed" {
			result = "closed"
		}
	}
	action := "payment.order.recheck"
	params := model.AuditFields{"trade_no": order.TradeNo, "payment_provider": order.PaymentProvider, "target_user_id": order.UserId, "before_status": beforeStatus, "result": result}
	if reason != "" {
		action = "payment.order.recover"
		params["reason"] = reason
	}
	if updated != nil {
		params["after_status"] = updated.OrderStatus
		params["frozen_quota"] = updated.FrozenQuota
	}
	recovered := result == "credited" || result == "already_credited"
	auditSuccess := err == nil && readErr == nil
	if reason != "" {
		auditSuccess = recovered
	}
	model.RecordAuditLog(c, model.AuditLog{UserId: c.GetInt("id"), ActorRole: c.GetInt("role"), Category: model.AuditCategoryOperation, Action: action, Content: order.TradeNo, Success: auditSuccess, Other: model.AuditOther{Op: &model.AuditOperation{Action: action, Params: params}}})

	c.Set(string(constant.ContextKeyAuditLogged), true)
	if reason != "" {
		common.ApiSuccess(c, gin.H{"result": result})
		return
	}
	if err != nil || readErr != nil {
		common.ApiErrorMsg(c, "订单核查失败，请稍后重试")
		return
	}
	common.ApiSuccess(c, nil)
}

// Personal orders expose customer-facing payment data only, without internal
// reconciliation errors or administrator audit information.
func personalOrderView(order model.SiteOrder) gin.H {
	return gin.H{
		"gateway_status":     order.GatewayStatus,
		"close_reason":       order.CloseReason,
		"cancellation_state": order.CancellationState,
		"cancellation_code":  order.CancellationCode,
		"order_type":         order.OrderType, "currency": order.Currency, "payment_amount": order.PaymentAmount,
		"id": order.Id, "trade_no": order.TradeNo, "provider_trade_no": order.ProviderTradeNo,
		"payment_provider": order.PaymentProvider, "payment_method": order.PaymentMethod,
		"order_status": order.OrderStatus, "amount_fen": order.AmountFen, "frozen_quota": order.FrozenQuota,
		"money": order.Money, "create_time": order.CreateTime, "complete_time": order.CompleteTime,
		"expires_at": order.ExpiresAt, "sandbox": order.Sandbox, "cancel_requested": order.CancelRequested, "close_requested_at": order.CloseRequestedAt, "closed_at": order.ClosedAt, "review_required": order.ReviewRequired,
	}
}

func GetPersonalOrders(c *gin.Context) {
	userID := c.GetInt("id")
	if userID <= 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	filter := model.SiteOrderFilter{Page: 1, PageSize: 20}
	if c.ShouldBindQuery(&filter) != nil || (filter.End > 0 && filter.Start > filter.End) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	// Ownership always comes from authentication, never a query parameter.
	filter.OwnerID = userID
	filter.ExcludeClosed = filter.Status == ""
	filter.User = ""
	orders, total, err := model.ListSiteOrders(filter)
	if err != nil {
		common.ApiErrorMsg(c, "无法读取订单")
		return
	}
	items := make([]gin.H, 0, len(orders))
	for _, order := range orders {
		items = append(items, personalOrderView(order))
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total, "page": filter.Page, "page_size": filter.PageSize})
}

func GetPersonalOrder(c *gin.Context) {
	userID := c.GetInt("id")
	if userID <= 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id == 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	orders, _, err := model.ListSiteOrders(model.SiteOrderFilter{ID: id, OwnerID: userID, Page: 1, PageSize: 1})
	if err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	if len(orders) == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	common.ApiSuccess(c, personalOrderView(orders[0]))
}

func CancelAntomSiteOrder(c *gin.Context) {
	if c.GetInt("role") < common.RoleRootUser || c.GetBool("use_access_token") {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id == 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	order, err := model.GetSiteOrder(id)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if order.PaymentProvider != model.PaymentProviderAntom {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	LockOrder(order.TradeNo)
	defer UnlockOrder(order.TradeNo)
	status, err := service.CancelAntomOrder(c.Request.Context(), order.TradeNo)
	model.RecordAuditLog(c, model.AuditLog{UserId: c.GetInt("id"), ActorRole: c.GetInt("role"), Category: model.AuditCategoryOperation, Action: "payment.antom.cancel", Content: order.TradeNo, Success: err == nil})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"status": status})
}
