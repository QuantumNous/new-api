package oauth

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// callbackRedirectURI rebuilds the redirect_uri the frontend sent in the
// authorize request (window.location.origin + path). The token exchange must
// send the exact same value, so derive it from the callback request instead of
// ServerAddress, or multi-domain deployments fail with invalid_grant.
func callbackRedirectURI(c *gin.Context, path string) string {
	if c == nil || c.Request == nil || c.Request.Host == "" {
		return system_setting.ServerAddress + path
	}
	scheme := "https"
	if proto := c.Request.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = strings.ToLower(strings.TrimSpace(strings.Split(proto, ",")[0]))
	} else if c.Request.TLS == nil {
		scheme = "http"
	}
	return fmt.Sprintf("%s://%s%s", scheme, c.Request.Host, path)
}
