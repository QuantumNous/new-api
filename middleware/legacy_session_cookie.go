package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
)

// sessionCookieName must match the name registered in main.go via
// sessions.Sessions("session", store).
const sessionCookieName = "session"

// PurgeLegacySessionCookie removes a stale host-only "session" cookie that lingers
// from before COOKIE_SESSION_DOMAIN was introduced.
//
// History: the session cookie used to be host-only (no Domain attribute → scoped to
// the exact host, e.g. console.flatkey.ai). Once COOKIE_SESSION_DOMAIN was set
// (.flatkey.ai, to share the session across subdomains), the server only ever writes
// the domain-scoped cookie and never overwrites the old host-only one. Browsers that
// logged in before the switch therefore hold TWO cookies named "session" and send
// both. gin-contrib/sessions reads only the first (RFC 6265: equal Path → older
// first → the stale host-only one), so values written to the domain-scoped cookie
// (e.g. the OAuth "oauth_state") are never read back → "state 参数为空或不匹配" and
// other silent session breakage. Incognito has no legacy cookie, so it works.
//
// Fix: when a request carries more than one "session" cookie, emit a host-only
// deletion (empty Domain, MaxAge<0). It can ONLY match the legacy host-only cookie —
// never the domain-scoped (.flatkey.ai) one — so the good session is preserved while
// the stale cookie is dropped. Self-healing: once purged, the request no longer
// carries a duplicate and the header stops being emitted.
//
// No-op when COOKIE_SESSION_DOMAIN is unset (cookies are still host-only, so there is
// nothing to disambiguate).
func PurgeLegacySessionCookie() gin.HandlerFunc {
	return func(c *gin.Context) {
		if common.CookieSessionDomain == "" {
			c.Next()
			return
		}
		count := 0
		for _, ck := range c.Request.Cookies() {
			if ck.Name == sessionCookieName {
				count++
			}
		}
		if count > 1 {
			http.SetCookie(c.Writer, &http.Cookie{
				Name:     sessionCookieName,
				Value:    "",
				Path:     "/",
				MaxAge:   -1,
				HttpOnly: true,
				Secure:   common.SessionCookieSecure,
				SameSite: http.SameSiteStrictMode,
			})
		}
		c.Next()
	}
}
