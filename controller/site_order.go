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
	common.ApiSuccess(c, order)
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
	if order.OrderType != "topup" || (order.PaymentProvider != model.PaymentProviderAlipay && order.PaymentProvider != model.PaymentProviderWechatPay) {
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
	if order.PaymentProvider == model.PaymentProviderAlipay {
		err = service.ReconcileAlipayOrder(c.Request.Context(), order.TradeNo)
	} else {
		err = service.ReconcileWechatPayOrder(c.Request.Context(), order.TradeNo)
	}

	result := "verification_failed"
	updated, readErr := model.GetSiteOrder(id)
	if readErr == nil {
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
		case common.TopUpStatusPending:
			if err == nil {
				result = "unpaid"
			}
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
		"order_type": order.OrderType, "currency": order.PaymentReceipt.ReceiptCurrency, "payment_amount": order.PaymentReceipt.ReceiptAmount,
		"id": order.Id, "trade_no": order.TradeNo, "provider_trade_no": order.ProviderTradeNo,
		"payment_provider": order.PaymentProvider, "payment_method": order.PaymentMethod,
		"order_status": order.OrderStatus, "amount_fen": order.AmountFen, "frozen_quota": order.FrozenQuota,
		"money": order.Money, "create_time": order.CreateTime, "complete_time": order.CompleteTime,
		"expires_at": order.ExpiresAt, "sandbox": order.Sandbox,
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
