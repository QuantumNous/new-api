package controller

import (
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func customDomainIDFromContext(c *gin.Context) int64 {
	context, found := middleware.GetCustomDomainContext(c)
	if !found || context.Kind != service.CustomDomainKindCustom {
		return 0
	}
	return context.DomainID
}

func resolveRequestRegistrationInviter(c *gin.Context, explicitAff string) (int, error) {
	return service.ResolveRegistrationInviter(explicitAff, customDomainIDFromContext(c))
}

func passkeyLoginEnabledForDomain(kind service.CustomDomainKind, enabled bool) bool {
	return enabled && kind != service.CustomDomainKindCustom
}
