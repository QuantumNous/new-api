package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSensitiveRequestPathRedactsCallbackToken(t *testing.T) {
	require.Equal(t, "/v1/real-person-verifications/callback/:callback_token", templateSensitiveRequestPath("/v1/real-person-verifications/callback/secret-token"))
	require.Equal(t, "/v1/real-person-verifications/callback/", templateSensitiveRequestPath("/v1/real-person-verifications/callback/"))
	require.Equal(t, "/v1/assets/ast_123", templateSensitiveRequestPath("/v1/assets/ast_123"))
}

func TestAccessLoggerDoesNotWriteCallbackToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var output bytes.Buffer
	oldWriter := gin.DefaultWriter
	gin.DefaultWriter = &output
	t.Cleanup(func() { gin.DefaultWriter = oldWriter })

	engine := gin.New()
	SetUpLogger(engine)
	engine.GET("/v1/real-person-verifications/callback/:callback_token", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/real-person-verifications/callback/secret-callback-token", nil))
	require.Equal(t, http.StatusNoContent, recorder.Code)
	require.Contains(t, output.String(), "/v1/real-person-verifications/callback/:callback_token")
	require.NotContains(t, output.String(), "secret-callback-token")
}
