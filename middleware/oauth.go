package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/service/hydra"
	"github.com/gin-gonic/gin"
)

// OAuthTokenAuth validates OAuth Bearer Token
func OAuthTokenAuth(hydraProvider hydra.Provider) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract Bearer Token
		token := extractBearerToken(c)
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "missing bearer token",
			})
			return
		}

		result, err := hydraProvider.IntrospectToken(c.Request.Context(), token, "")
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "token introspection failed",
			})
			return
		}

		// Check if token is active
		if !result.GetActive() {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "invalid or expired token",
			})
			return
		}

		// Extract user ID from subject
		subject := result.GetSub()
		userId, err := strconv.Atoi(subject)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "invalid subject in token",
			})
			return
		}

		// Set context values
		c.Set("id", userId)
		c.Set("auth_method", "oauth")
		c.Set("oauth_client_id", result.GetClientId())
		c.Set("oauth_scope", result.GetScope())

		c.Next()
	}
}

// extractBearerToken extracts Bearer token from Authorization header
func extractBearerToken(c *gin.Context) string {
	auth := c.GetHeader("Authorization")
	if token, found := strings.CutPrefix(auth, "Bearer "); found {
		return token
	}
	return ""
}

// RequireScope checks if the OAuth token has all required scopes
func RequireScope(requiredScopes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// No scopes required, pass through
		if len(requiredScopes) == 0 {
			c.Next()
			return
		}

		// Get scope from context (set by OAuthTokenAuth middleware)
		tokenScope := c.GetString("oauth_scope")
		if tokenScope == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "insufficient scope",
			})
			return
		}

		// Parse token scopes into a set
		scopeSet := make(map[string]bool)
		for s := range strings.SplitSeq(tokenScope, " ") {
			scopeSet[s] = true
		}

		// Check if all required scopes are present
		for _, required := range requiredScopes {
			if !scopeSet[required] {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"success": false,
					"error":   "insufficient scope: " + required + " required",
				})
				return
			}
		}

		c.Next()
	}
}
