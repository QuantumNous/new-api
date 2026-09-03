package controller

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// PasswordResetReturnDispatcher is intentionally served only from the fixed
// callback host. It validates a server-signed reset return context before
// moving the browser to the original peer-main or promotion-domain reset page.
func PasswordResetReturnDispatcher(c *gin.Context) {
	if !isCustomDomainCallbackRequest(c) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	email := model.NormalizeEmail(c.Query("email"))
	token := c.Query("token")
	returnContext := c.Query("context")
	if email == "" || token == "" || returnContext == "" {
		invalidPasswordResetReturnContext(c)
		return
	}

	targetHost, active, err := service.ResolvePasswordResetReturnContext(returnContext, email, token, time.Now())
	if err != nil {
		invalidPasswordResetReturnContext(c)
		return
	}
	targetOrigin := strings.TrimRight(common.CustomDomainMainOrigin, "/")
	if active {
		targetOrigin = "https://" + targetHost
	}
	query := url.Values{"email": {email}, "token": {token}}
	c.Header("Cache-Control", "no-store")
	c.Header("Referrer-Policy", "no-referrer")
	c.Redirect(http.StatusFound, targetOrigin+"/user/reset?"+query.Encode())
}

func invalidPasswordResetReturnContext(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Header("Referrer-Policy", "no-referrer")
	c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid password reset return context"})
}

func passwordResetEmailLink(c *gin.Context, email, token string) string {
	query := url.Values{"email": {email}, "token": {token}}
	if domainContext, found := middleware.GetCustomDomainContext(c); found &&
		(domainContext.Kind == service.CustomDomainKindCustom ||
			(domainContext.Kind == service.CustomDomainKindMain && !domainContext.IsCallbackHost)) {
		expiresAt := time.Now().Add(time.Duration(common.VerificationValidMinutes) * time.Minute)
		if returnContext, err := service.CreatePasswordResetReturnContext(domainContext.DomainID, domainContext.Host, email, token, expiresAt); err == nil {
			query.Set("context", returnContext)
			return strings.TrimRight(common.CustomDomainMainOrigin, "/") + "/api/reset_password/return?" + query.Encode()
		}
	}
	baseOrigin := system_setting.ServerAddress
	if common.CustomDomainEnabled {
		baseOrigin = common.CustomDomainMainOrigin
	}
	return strings.TrimRight(baseOrigin, "/") + "/user/reset?" + query.Encode()
}
