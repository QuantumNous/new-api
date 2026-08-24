package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func CancelRecurringSubscription(c *gin.Context) {
	bindingID, err := strconv.ParseInt(c.Param("binding_id"), 10, 64)
	if err != nil || bindingID <= 0 {
		common.ApiErrorI18n(c, i18n.MsgSubscriptionInvalidRecurring)
		return
	}
	binding, err := service.CancelStripeRecurringSubscription(c.GetInt("id"), bindingID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, recurringSubscriptionDTOs([]model.SubscriptionProviderBinding{*binding})[0])
}

func ResumeRecurringSubscription(c *gin.Context) {
	bindingID, err := strconv.ParseInt(c.Param("binding_id"), 10, 64)
	if err != nil || bindingID <= 0 {
		common.ApiErrorI18n(c, i18n.MsgSubscriptionInvalidRecurring)
		return
	}
	binding, err := service.ResumeStripeRecurringSubscription(c.GetInt("id"), bindingID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, recurringSubscriptionDTOs([]model.SubscriptionProviderBinding{*binding})[0])
}
