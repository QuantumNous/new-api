package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func buildEpayPaymentMethods(minTopUp int) []map[string]string {
	methods := make([]map[string]string, 0, len(operation_setting.PayMethods))
	for _, method := range operation_setting.PayMethods {
		methodType := method["type"]
		methodName := method["name"]
		if methodType == "" || methodName == "" {
			continue
		}
		cloned := make(map[string]string, len(method)+2)
		for key, value := range method {
			cloned[key] = value
		}
		cloned["provider"] = operation_setting.PaymentProviderEpay
		if cloned["min_topup"] == "" && minTopUp > 0 {
			cloned["min_topup"] = strconv.Itoa(minTopUp)
		}
		methods = append(methods, cloned)
	}
	return methods
}

func buildWalletTopUpPayMethods() []map[string]string {
	methods := []map[string]string{}
	if !operation_setting.IsPaymentComplianceConfirmed() ||
		!operation_setting.IsBillingFeatureEnabled(operation_setting.BillingFeatureWalletTopUp) {
		return methods
	}
	if isEpayTopUpEnabled() {
		methods = append(methods, buildEpayPaymentMethods(operation_setting.MinTopUp)...)
	}
	if isStripeTopUpEnabled() {
		methods = append(methods, map[string]string{
			"name":      "Stripe",
			"type":      model.PaymentMethodStripe,
			"provider":  operation_setting.PaymentProviderStripe,
			"color":     "rgba(var(--semi-purple-5), 1)",
			"min_topup": strconv.Itoa(setting.StripeMinTopUp),
		})
	}
	if isWaffoPancakeTopUpEnabled() {
		methods = append(methods, map[string]string{
			"name":      "Waffo Pancake",
			"type":      model.PaymentMethodWaffoPancake,
			"provider":  operation_setting.PaymentProviderWaffoPancake,
			"color":     "rgba(var(--semi-orange-5), 1)",
			"min_topup": strconv.Itoa(setting.WaffoPancakeMinTopUp),
		})
	}
	return methods
}

func buildWalletTopUpWaffoPayMethods() interface{} {
	if !operation_setting.IsPaymentComplianceConfirmed() ||
		!operation_setting.IsBillingFeatureEnabled(operation_setting.BillingFeatureWalletTopUp) {
		return nil
	}
	if isWaffoTopUpEnabled() {
		return setting.GetWaffoPayMethods()
	}
	return nil
}

func buildSubscriptionPayMethods() []map[string]string {
	methods := []map[string]string{}
	if !operation_setting.IsPaymentComplianceConfirmed() ||
		!operation_setting.IsBillingFeatureEnabled(operation_setting.BillingFeatureSubscriptionPurchase) {
		return methods
	}
	if isEpaySubscriptionEnabled() {
		methods = append(methods, buildEpayPaymentMethods(0)...)
	}
	if isStripeSubscriptionEnabled() {
		methods = append(methods, map[string]string{
			"name":     "Stripe",
			"type":     model.PaymentMethodStripe,
			"provider": operation_setting.PaymentProviderStripe,
			"color":    "rgba(var(--semi-purple-5), 1)",
		})
	}
	if isCreemSubscriptionEnabled() {
		methods = append(methods, map[string]string{
			"name":     "Creem",
			"type":     model.PaymentMethodCreem,
			"provider": operation_setting.PaymentProviderCreem,
			"color":    "rgba(var(--semi-teal-5), 1)",
		})
	}
	return methods
}

func buildCapabilityFeatures() map[string]bool {
	complianceConfirmed := operation_setting.IsPaymentComplianceConfirmed()
	features := operation_setting.DefaultBusinessFeatures()
	for feature := range features {
		features[feature] = complianceConfirmed && operation_setting.IsBillingFeatureEnabled(feature)
	}
	return features
}

func buildPaymentMethodsByScene() map[string][]map[string]string {
	return map[string][]map[string]string{
		operation_setting.PaymentSceneWalletTopUp:          buildWalletTopUpPayMethods(),
		operation_setting.PaymentSceneSubscriptionPurchase: buildSubscriptionPayMethods(),
	}
}

func buildBillingCapabilitiesData() gin.H {
	paymentSetting := operation_setting.GetPaymentSetting()
	return gin.H{
		"payment_compliance_confirmed": operation_setting.IsPaymentComplianceConfirmed(),
		"features":                     buildCapabilityFeatures(),
		"provider_scene_scopes":        operation_setting.CopyProviderSceneScopes(paymentSetting.ProviderSceneScopes),
		"payment_methods":              buildPaymentMethodsByScene(),
	}
}

func GetBillingCapabilities(c *gin.Context) {
	common.ApiSuccess(c, buildBillingCapabilitiesData())
}
