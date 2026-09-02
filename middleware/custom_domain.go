package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const customDomainContextKey = "custom_domain_context"

// CustomDomainContext resolves the request Host once before application routes.
// With the feature disabled it deliberately remains a no-op so the existing
// single-host deployment behavior is unchanged.
func CustomDomainContext() gin.HandlerFunc {
	if !common.CustomDomainEnabled {
		return func(c *gin.Context) { c.Next() }
	}
	resolver, err := service.NewCustomDomainResolver(common.CustomDomainSettings{
		Enabled:         common.CustomDomainEnabled,
		Suffix:          common.CustomDomainSuffix,
		MainOrigin:      common.CustomDomainMainOrigin,
		CacheTTLSeconds: common.CustomDomainCacheTTLSeconds,
		ReservedLabels:  common.CustomDomainReservedLabels,
	})
	if err != nil {
		common.SysError("custom domain configuration is invalid: " + err.Error())
		return func(c *gin.Context) { c.AbortWithStatus(http.StatusServiceUnavailable) }
	}
	return CustomDomainContextWithResolver(resolver, true)
}

func CustomDomainContextWithResolver(resolver *service.CustomDomainResolver, enabled bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !enabled {
			c.Next()
			return
		}
		context, err := resolver.ResolveHost(c.Request.Host)
		if err != nil {
			common.SysError("custom domain host lookup failed: " + err.Error())
			c.AbortWithStatus(http.StatusServiceUnavailable)
			return
		}
		if context.Kind == service.CustomDomainKindDisabled && isDisabledDomainHandoffPath(c.Request.Method, c.Request.URL.Path) {
			c.Set(customDomainContextKey, context)
			c.Next()
			return
		}
		if context.Kind != service.CustomDomainKindMain && context.Kind != service.CustomDomainKindCustom {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		if context.Kind == service.CustomDomainKindCustom &&
			(c.Request.URL.Path == "/api/user/passkey" || strings.HasPrefix(c.Request.URL.Path, "/api/user/passkey/")) {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		c.Set(customDomainContextKey, context)
		c.Next()
	}
}

func isDisabledDomainHandoffPath(method, path string) bool {
	return (method == http.MethodGet && path == "/oauth/handoff") ||
		(method == http.MethodPost && path == "/api/oauth/domain-handoff")
}

func GetCustomDomainContext(c *gin.Context) (service.CustomDomainContext, bool) {
	value, found := c.Get(customDomainContextKey)
	if !found {
		return service.CustomDomainContext{}, false
	}
	context, ok := value.(service.CustomDomainContext)
	return context, ok
}
