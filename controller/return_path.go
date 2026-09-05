package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func paymentReturnPath(suffix string) string {
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	return base + suffix
}

func fixedPaymentReturnPath(suffix string) string {
	if !common.CustomDomainEnabled {
		return paymentReturnPath(suffix)
	}
	base := strings.TrimRight(common.CustomDomainMainOrigin, "/")
	return base + suffix
}

func paymentReturnURLForTopUp(topUp *model.TopUp, suffix string) string {
	if !common.CustomDomainEnabled {
		return paymentReturnPath(suffix)
	}
	if topUp == nil || strings.TrimSpace(topUp.OriginHost) == "" {
		return fixedPaymentReturnPath(suffix)
	}
	resolver, err := service.NewRuntimeCustomDomainResolver()
	if err != nil {
		return fixedPaymentReturnPath(suffix)
	}
	context, err := resolver.ResolveHost(topUp.OriginHost)
	if err != nil || (context.Kind != service.CustomDomainKindMain && context.Kind != service.CustomDomainKindCustom) {
		return fixedPaymentReturnPath(suffix)
	}
	return "https://" + context.Host + suffix
}

func topUpOriginHostFromContext(c *gin.Context) string {
	context, found := middleware.GetCustomDomainContext(c)
	if !found {
		return ""
	}
	if context.Kind == service.CustomDomainKindCustom ||
		(context.Kind == service.CustomDomainKindMain && !context.IsCallbackHost) {
		return context.Host
	}
	return ""
}
