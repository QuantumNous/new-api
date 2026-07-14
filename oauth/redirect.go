package oauth

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func callbackRedirectURI(c *gin.Context, callbackPath string) string {
	origin := requestPublicOrigin(c)
	if origin == "" {
		origin = strings.TrimRight(system_setting.ServerAddress, "/")
	}
	return origin + callbackPath
}

func requestPublicOrigin(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}

	req := c.Request
	host := firstForwardedValue(req.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = strings.TrimSpace(req.Host)
	}
	if host == "" {
		return ""
	}

	proto := firstForwardedValue(req.Header.Get("X-Forwarded-Proto"))
	if proto == "" {
		proto = forwardedProto(req.Header.Get("Forwarded"))
	}
	if proto == "" {
		if req.TLS != nil {
			proto = "https"
		} else if req.URL != nil && req.URL.Scheme != "" {
			proto = req.URL.Scheme
		} else {
			proto = "http"
		}
	}

	return strings.TrimSpace(proto) + "://" + host
}

func firstForwardedValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if idx := strings.Index(value, ","); idx >= 0 {
		value = value[:idx]
	}
	return strings.TrimSpace(value)
}

func forwardedProto(value string) string {
	value = firstForwardedValue(value)
	if value == "" {
		return ""
	}
	for _, part := range strings.Split(value, ";") {
		part = strings.TrimSpace(part)
		key, rawValue, ok := strings.Cut(part, "=")
		if !ok || !strings.EqualFold(strings.TrimSpace(key), "proto") {
			continue
		}
		return strings.Trim(strings.TrimSpace(rawValue), `"`)
	}
	return ""
}
