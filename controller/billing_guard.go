package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const (
	billingFeatureDisabledMessage = "billing feature is disabled"
	paymentSceneDisabledMessage   = "payment provider is not available for this scene"
)

func requireBillingFeature(c *gin.Context, feature string) bool {
	if !requirePaymentCompliance(c) {
		return false
	}
	if !operation_setting.IsBillingFeatureEnabled(feature) {
		common.ApiErrorMsg(c, billingFeatureDisabledMessage)
		return false
	}
	return true
}

func requirePaymentProviderForScene(c *gin.Context, provider string, scene string) bool {
	if !operation_setting.IsPaymentProviderAllowedForScene(provider, scene) {
		common.ApiErrorMsg(c, paymentSceneDisabledMessage)
		return false
	}
	return true
}

func requireWalletTopUp(c *gin.Context, provider string) bool {
	return requireBillingFeature(c, operation_setting.BillingFeatureWalletTopUp) &&
		requirePaymentProviderForScene(c, provider, operation_setting.PaymentSceneWalletTopUp)
}

func requireSubscriptionPurchase(c *gin.Context, provider string) bool {
	return requireBillingFeature(c, operation_setting.BillingFeatureSubscriptionPurchase) &&
		requirePaymentProviderForScene(c, provider, operation_setting.PaymentSceneSubscriptionPurchase)
}
