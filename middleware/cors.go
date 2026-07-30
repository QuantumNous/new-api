package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// trustedCredentialedOrigins are the browser origins allowed to make
// credentialed (session-cookie) requests — currently only the JINN Excel
// taskpane. Cookie-authed endpoints (/api/user/login/*, /api/token/*,
// /api/user/self) require a specific echoed Origin because browsers reject
// Access-Control-Allow-Origin: * whenever credentials are sent. Add the Phase 4
// production taskpane origin here once it is chosen.
var trustedCredentialedOrigins = map[string]bool{
	"https://localhost:3000":            true,
	"https://localhost:3001":            true,
	"https://account.jinnhq.com":        true, // JINN account portal (also the payment return-URL allowlist)
	"https://account.jinn.ccwu.cc:8444": true, // legacy portal origin, kept until the old domain is retired
}

// TrustedBrowserOrigin reports whether origin is one of the JINN-owned web
// origins. Payment processors reuse it to validate client-supplied return URLs.
func TrustedBrowserOrigin(origin string) bool {
	return trustedCredentialedOrigins[origin]
}

// CORS keeps new-api's prior open, non-credentialed access for arbitrary
// browser origins (bearer-token relay clients) while additionally enabling
// credentialed access for the trusted JINN taskpane origins so its cookie-based
// login flow works. Same-origin clients (the admin dashboard served by new-api
// itself) bypass CORS entirely and are unaffected.
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			if trustedCredentialedOrigins[origin] {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
				c.Header("Vary", "Origin")
			} else {
				c.Header("Access-Control-Allow-Origin", "*")
			}
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")

			reqHeaders := c.Request.Header.Get("Access-Control-Request-Headers")
			if reqHeaders == "" {
				reqHeaders = "Authorization, Content-Type, Accept, New-Api-User"
			}
			c.Header("Access-Control-Allow-Headers", reqHeaders)
			c.Header("Access-Control-Max-Age", "43200")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func PoweredBy() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
