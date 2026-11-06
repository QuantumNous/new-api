package middleware

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// parseAllowedOrigins reads CORS_ALLOWED_ORIGINS as a comma-separated list of
// exact origins (scheme://host[:port]). A single "*" opts back into the legacy
// wildcard behaviour.
func parseAllowedOrigins(raw string) (origins []string, allowAll bool) {
	for _, part := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(part)
		if origin == "" {
			continue
		}
		if origin == "*" {
			allowAll = true
			continue
		}
		origins = append(origins, strings.TrimSuffix(origin, "/"))
	}
	return origins, allowAll
}

// CORS allows cross-origin browser requests only from origins an administrator
// explicitly listed in CORS_ALLOWED_ORIGINS. The console is served from the same
// origin as the API, so an empty list keeps the gateway same-origin only, which
// is the safe default: a wildcard origin combined with credentialed requests is
// rejected by browsers and would expose session cookies to any website anyway.
func CORS() gin.HandlerFunc {
	allowedOrigins, allowAll := parseAllowedOrigins(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if allowAll {
		log.Print(common.LogText("WARNING: CORS_ALLOWED_ORIGINS contains '*', so any website may call the API. Credentials are disabled for this mode; list explicit origins instead if you need cookie-based sessions."))
	}
	if !allowAll && len(allowedOrigins) == 0 {
		log.Print(common.LogText("CORS_ALLOWED_ORIGINS is unset; cross-origin browser requests are refused and only same-origin console requests are served. Set it to a comma-separated list of trusted origins to allow others."))
	}

	config := cors.Config{
		AllowAllOrigins:  allowAll,
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Accept", "Authorization", "Content-Type", "X-Requested-With", "X-New-Api-Version"},
		AllowCredentials: !allowAll && len(allowedOrigins) > 0,
		MaxAge:           12 * time.Hour,
	}
	return cors.New(config)
}

func Version() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
