package middleware

import (
	"net/url"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	allowedOrigins := parseAllowedOrigins("CORS_ALLOWED_ORIGINS")
	if len(allowedOrigins) == 0 {
		// Reuse the explicitly trusted HTTPS frontends when secure session cookies
		// are configured. With neither setting present, cross-origin access is
		// denied; normal same-origin requests do not require CORS headers.
		allowedOrigins = parseAllowedOrigins("SESSION_COOKIE_TRUSTED_URL")
	}
	if len(allowedOrigins) == 0 {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	config := cors.DefaultConfig()
	config.AllowOrigins = allowedOrigins
	config.AllowCredentials = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{
		"Accept",
		"Authorization",
		"Content-Type",
		"New-Api-Key",
		"New-Api-User",
		"X-Request-Id",
		"X-Trace-Id",
		"X-Thread-Id",
		"AH-Trace-Id",
		"AH-Thread-Id",
	}
	config.ExposeHeaders = []string{
		"X-Oneapi-Request-Id",
		"X-Request-Id",
		"X-Trace-Id",
		"X-Thread-Id",
		"AH-Trace-Id",
		"AH-Thread-Id",
	}
	return cors.New(config)
}

func parseAllowedOrigins(name string) []string {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return nil
	}
	seen := make(map[string]struct{})
	values := make([]string, 0)
	for _, item := range strings.Split(raw, ",") {
		value, ok := normalizeAllowedOrigin(item)
		if !ok {
			common.SysError("ignoring invalid " + name + " origin entry")
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		values = append(values, value)
	}
	return values
}

func normalizeAllowedOrigin(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" || strings.Contains(value, "*") {
		return "", false
	}
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", false
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Path != "" && parsed.Path != "/") {
		return "", false
	}
	return parsed.Scheme + "://" + parsed.Host, true
}

func Version() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
