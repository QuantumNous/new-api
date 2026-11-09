package middleware

import (
	"crypto/subtle"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// SessionCookieOriginGuard protects cookie-authenticated refresh/logout
// endpoints from cross-site requests. It always validates the browser Origin,
// falling back to a single Referer, independently of whether the refresh cookie
// is marked Secure: a plain-HTTP deployment is still reachable by CSRF. It never
// adds CORS response headers and must not be installed on relay routes.
func SessionCookieOriginGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin, ok := requestBrowserOrigin(c.Request)
		if !ok || !isAllowedSessionOrigin(c.Request, origin) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"code":    "AUTH_ORIGIN_FORBIDDEN",
				"message": "request origin is not allowed",
			})
			return
		}
		c.Next()
	}
}

func requestBrowserOrigin(request *http.Request) (string, bool) {
	originValues := request.Header.Values("Origin")
	if len(originValues) > 1 {
		return "", false
	}
	if len(originValues) == 1 {
		if strings.Contains(originValues[0], ",") {
			return "", false
		}
		origin, err := common.NormalizeOrigin(originValues[0])
		return origin, err == nil
	}
	refererValues := request.Header.Values("Referer")
	if len(refererValues) != 1 {
		return "", false
	}
	referer, err := url.Parse(strings.TrimSpace(refererValues[0]))
	if err != nil || referer.Scheme == "" || referer.Host == "" || referer.User != nil {
		return "", false
	}
	origin, err := common.NormalizeOrigin(referer.Scheme + "://" + referer.Host)
	return origin, err == nil
}

func isAllowedSessionOrigin(request *http.Request, origin string) bool {
	if requestOrigin, ok := requestExternalOrigin(request); ok &&
		subtle.ConstantTimeCompare([]byte(origin), []byte(requestOrigin)) == 1 {
		return true
	}
	for _, trustedOrigin := range common.SessionCookieTrustedURLs {
		if subtle.ConstantTimeCompare([]byte(origin), []byte(trustedOrigin)) == 1 {
			return true
		}
	}
	return false
}

// requestExternalOrigin reconstructs the origin the browser actually addressed.
//
// A TLS-terminating reverse proxy delivers plain HTTP to the backend, so
// request.TLS is nil and request.Host is the internal hop even though the
// browser sent an https Origin. When the immediate peer is a trusted proxy
// (TRUSTED_PROXIES), the proxy's X-Forwarded-Proto and X-Forwarded-Host are
// authoritative and are used instead. An untrusted direct client cannot set
// these headers to bypass the CSRF check because the trust gate rejects them.
func requestExternalOrigin(request *http.Request) (string, bool) {
	scheme := "http"
	if request.TLS != nil {
		scheme = "https"
	}
	host := request.Host
	if common.IsTrustedProxyIP(request.RemoteAddr) {
		if forwardedProto := firstForwardedValue(request.Header.Get("X-Forwarded-Proto")); forwardedProto != "" {
			scheme = forwardedProto
		}
		if forwardedHost := firstForwardedValue(request.Header.Get("X-Forwarded-Host")); forwardedHost != "" {
			host = forwardedHost
		}
	}
	origin, err := common.NormalizeOrigin(scheme + "://" + host)
	if err != nil {
		return "", false
	}
	return origin, true
}

// firstForwardedValue returns the first, canonicalized value of a comma-joined
// forwarded header, so a chained proxy list cannot smuggle extra origins.
func firstForwardedValue(raw string) string {
	if raw == "" {
		return ""
	}
	value, _, _ := strings.Cut(raw, ",")
	return strings.ToLower(strings.TrimSpace(value))
}
