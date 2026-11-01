package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const partnerTenantContextKey = "partner_tenant"

func PartnerTenantBearer() gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, name := range []string{"access_token", "api_key", "secret"} {
			if c.Request.URL.Query().Has(name) {
				writePartnerIntegrationError(c, http.StatusBadRequest, "invalid_request", "partner credentials must be sent in the Authorization header", "")
				return
			}
		}
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if header == "" {
			writePartnerIntegrationError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication required", `Bearer realm="partner"`)
			return
		}
		parts := strings.Fields(header)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
			writePartnerIntegrationError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication failed", `Bearer realm="partner", error="invalid_token"`)
			return
		}
		tenant, err := model.FindPartnerTenantBySecret(parts[1])
		if err != nil || tenant.Status != model.PartnerTenantStatusEnabled {
			writePartnerIntegrationError(c, http.StatusUnauthorized, "invalid_partner_secret", "partner authentication failed", `Bearer realm="partner", error="invalid_token"`)
			return
		}
		if !partnerOAuthRateTake(c, "PT-TENANT", strconv.FormatInt(tenant.Id, 10), 1200, 60, partnerOAuthRateStyleIntegration) {
			return
		}
		common.SetContextKey(c, partnerTenantContextKey, tenant)
		c.Next()
	}
}

func PartnerTenantFromContext(c *gin.Context) *model.PartnerTenant {
	value, ok := common.GetContextKey(c, partnerTenantContextKey)
	if !ok {
		return nil
	}
	tenant, _ := value.(*model.PartnerTenant)
	return tenant
}
