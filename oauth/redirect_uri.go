package oauth

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func BuildOAuthRedirectURI(c *gin.Context, provider string) string {
	base := ""
	if c != nil && c.Request != nil {
		proto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
		host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
		if host == "" {
			host = strings.TrimSpace(c.Request.Host)
		}
		if proto == "" {
			if c.Request.TLS != nil {
				proto = "https"
			} else {
				proto = "http"
			}
		}
		if host != "" {
			base = proto + "://" + host
		}
	}
	if base == "" {
		base = system_setting.ServerAddress
	}
	base = strings.TrimRight(base, "/")
	return fmt.Sprintf("%s/oauth/%s", base, provider)
}
