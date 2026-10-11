package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PersonalOrderPayment binds every operation to the authenticated owner before
// contacting a gateway. Neither amount nor merchant configuration is client input.
func PersonalOrderPayment(c *gin.Context) {
	userID := c.GetInt("id")
	if userID <= 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if c.ContentType() != "application/json" {
		c.AbortWithStatus(http.StatusUnsupportedMediaType)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id == 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var req struct {
		Mobile bool `json:"mobile"`
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024)
	if c.ShouldBindJSON(&req) != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	orders, _, err := model.ListSiteOrders(model.SiteOrderFilter{ID: id, OwnerID: userID, Page: 1, PageSize: 1})
	if err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	if len(orders) != 1 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	order := orders[0]
	if order.PaymentProvider != model.PaymentProviderAlipay && order.PaymentProvider != model.PaymentProviderWechatPay {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	LockOrder(order.TradeNo)
	defer UnlockOrder(order.TradeNo)
	var result any
	if c.Param("action") == "cancel" {
		var status string
		status, err = service.RequestDirectOrderCancellation(c.Request.Context(), userID, order.TradeNo, order.PaymentProvider)
		result = gin.H{"status": status}
	} else if c.Param("action") == "pay" {
		result, err = service.ResumeDirectOrder(c.Request.Context(), userID, order.TradeNo, order.PaymentProvider, req.Mobile)
	} else {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
