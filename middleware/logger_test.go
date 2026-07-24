package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSanitizeAccessLogPathRedactsInvitationCode(t *testing.T) {
	path := sanitizeAccessLogPath("/api/oauth/state?provider=linuxdo&invitation_code=INV-PLAINTEXT&invite=LEGACY-PLAINTEXT&aff=AFF")

	assert.NotContains(t, path, "INV-PLAINTEXT")
	assert.NotContains(t, path, "LEGACY-PLAINTEXT")
	assert.Contains(t, path, "invitation_code=%5BREDACTED%5D")
	assert.Contains(t, path, "invite=%5BREDACTED%5D")
	assert.Contains(t, path, "provider=linuxdo")
	assert.Contains(t, path, "aff=AFF")
}

func TestSanitizeAccessLogPathRedactsInvitationKeysCaseInsensitively(t *testing.T) {
	path := sanitizeAccessLogPath("/register?Invite=LEGACY&Invitation_Code=CURRENT")

	assert.NotContains(t, path, "LEGACY")
	assert.NotContains(t, path, "CURRENT")
	assert.Contains(t, path, "Invite=%5BREDACTED%5D")
	assert.Contains(t, path, "Invitation_Code=%5BREDACTED%5D")
}

func TestSanitizeAccessLogPathDoesNotEchoMalformedQuery(t *testing.T) {
	path := sanitizeAccessLogPath("/api/oauth/state?invitation_code=INV-PLAINTEXT%ZZ")

	assert.Equal(t, "/api/oauth/state?[query-redacted]", path)
	assert.NotContains(t, path, "INV-PLAINTEXT")
}

func TestAccessLoggerNeverWritesPlaintextInvitationCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldWriter := gin.DefaultWriter
	var logs bytes.Buffer
	gin.DefaultWriter = &logs
	t.Cleanup(func() {
		gin.DefaultWriter = oldWriter
	})

	router := gin.New()
	SetUpLogger(router)
	router.GET("/api/oauth/state", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(
		http.MethodGet,
		"/api/oauth/state?provider=linuxdo&invitation_code=INV-PLAINTEXT",
		nil,
	)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusNoContent, response.Code)
	assert.NotContains(t, logs.String(), "INV-PLAINTEXT")
	assert.Contains(t, logs.String(), "invitation_code=%5BREDACTED%5D")
}
