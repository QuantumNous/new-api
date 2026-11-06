package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCORSWithoutConfiguredOriginsIsSameOriginOnly(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	gin.SetMode(gin.TestMode)

	var handler gin.HandlerFunc
	require.NotPanics(t, func() {
		handler = CORS()
	})

	router := gin.New()
	router.Use(handler)
	router.GET("/api/status", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	router.OPTIONS("/api/status", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	request.Header.Set("Origin", "https://evil.example.com")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Empty(t, response.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, response.Header().Get("Access-Control-Allow-Credentials"))

	preflight := httptest.NewRequest(http.MethodOptions, "/api/status", nil)
	preflight.Header.Set("Origin", "https://evil.example.com")
	preflight.Header.Set("Access-Control-Request-Method", http.MethodGet)
	preflightResponse := httptest.NewRecorder()
	router.ServeHTTP(preflightResponse, preflight)

	assert.Equal(t, http.StatusForbidden, preflightResponse.Code)
	assert.Empty(t, preflightResponse.Header().Get("Access-Control-Allow-Origin"))

	sameOrigin := httptest.NewRequest(http.MethodGet, "https://panel.example.com/api/status", nil)
	sameOrigin.Header.Set("Origin", "https://panel.example.com")
	sameOriginResponse := httptest.NewRecorder()
	router.ServeHTTP(sameOriginResponse, sameOrigin)

	assert.Equal(t, http.StatusOK, sameOriginResponse.Code)
}

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://panel.example.com/")
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(CORS())
	router.GET("/api/status", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	request.Header.Set("Origin", "https://panel.example.com")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusOK, response.Code)
	assert.Equal(t, "https://panel.example.com", response.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", response.Header().Get("Access-Control-Allow-Credentials"))

	otherOriginRequest := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	otherOriginRequest.Header.Set("Origin", "https://evil.example.com")
	otherOriginResponse := httptest.NewRecorder()
	router.ServeHTTP(otherOriginResponse, otherOriginRequest)

	assert.Equal(t, http.StatusForbidden, otherOriginResponse.Code)
	assert.Empty(t, otherOriginResponse.Header().Get("Access-Control-Allow-Origin"))
}
