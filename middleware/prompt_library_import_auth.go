package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const PromptLibraryImportTokenEnv = "PROMPT_LIBRARY_IMPORT_TOKEN"

func PromptLibraryImportAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		want := strings.TrimSpace(common.GetEnvOrDefaultString(PromptLibraryImportTokenEnv, ""))
		if want == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "prompt library import token not configured"})
			c.Abort()
			return
		}
		got := promptLibraryImportBearer(c.GetHeader("Authorization"))
		if got == "" || subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func promptLibraryImportBearer(header string) string {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}
