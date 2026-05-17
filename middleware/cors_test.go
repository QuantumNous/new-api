package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func performCORSPreflight() *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS())
	router.GET("/ping", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodOptions, "/ping", nil)
	request.Header.Set("Origin", "https://app.example.com")
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)
	request.Header.Set("Access-Control-Request-Headers", "Authorization")
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestParseCORSAllowedOrigins(t *testing.T) {
	assert.Equal(t, []string{"https://app.example.com", "https://admin.example.com"}, parseCORSAllowedOrigins(" https://app.example.com, ,https://admin.example.com "))
	assert.Empty(t, parseCORSAllowedOrigins(" , "))
}

func TestCORSDefaultAllowsAllOriginsWithoutCredentials(t *testing.T) {
	t.Setenv("CORS_ALLOW_ALL_ORIGINS", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	t.Setenv("CORS_ALLOW_CREDENTIALS", "true")

	recorder := performCORSPreflight()

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Equal(t, "*", recorder.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, recorder.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSRestrictedModeAllowsConfiguredOriginsWithCredentials(t *testing.T) {
	t.Setenv("CORS_ALLOW_ALL_ORIGINS", "false")
	t.Setenv("CORS_ALLOWED_ORIGINS", " https://app.example.com,https://admin.example.com ")
	t.Setenv("CORS_ALLOW_CREDENTIALS", "true")

	recorder := performCORSPreflight()

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Equal(t, "https://app.example.com", recorder.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", recorder.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSRestrictedModeCanDisableCredentials(t *testing.T) {
	t.Setenv("CORS_ALLOW_ALL_ORIGINS", "false")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")
	t.Setenv("CORS_ALLOW_CREDENTIALS", "false")

	recorder := performCORSPreflight()

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Equal(t, "https://app.example.com", recorder.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, recorder.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSRestrictedModeWithoutAllowedOriginsRejectsCrossOrigin(t *testing.T) {
	t.Setenv("CORS_ALLOW_ALL_ORIGINS", "false")
	t.Setenv("CORS_ALLOWED_ORIGINS", " , ")

	assert.NotPanics(t, func() {
		recorder := performCORSPreflight()

		assert.Equal(t, http.StatusForbidden, recorder.Code)
		assert.Empty(t, recorder.Header().Get("Access-Control-Allow-Origin"))
	})
}
