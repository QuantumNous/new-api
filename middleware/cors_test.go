package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCORSAllowsAuthorizationPreflight(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS())
	router.GET("/v1/models", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	request := httptest.NewRequest(http.MethodOptions, "/v1/models", nil)
	request.Header.Set("Origin", "https://dashboard.example.com")
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)
	request.Header.Set("Access-Control-Request-Headers", "authorization")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code)
	allowedHeaders := strings.ToLower(
		strings.Join(recorder.Header().Values("Access-Control-Allow-Headers"), ","),
	)
	assert.Contains(t, allowedHeaders, "authorization")
}

func TestCORSExposesRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS(), RequestId())
	router.GET("/v1/models", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	request := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	request.Header.Set("Origin", "https://dashboard.example.com")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.NotEmpty(t, recorder.Header().Get(common.RequestIdKey))
	exposedHeaders := strings.ToLower(
		strings.Join(recorder.Header().Values("Access-Control-Expose-Headers"), ","),
	)
	assert.Contains(t, exposedHeaders, strings.ToLower(common.RequestIdKey))
}
