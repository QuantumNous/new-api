package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestMemoryRateLimiterReturnsRetryAfter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	inMemoryRateLimiter.Init(0)
	mark := "retry-after:" + t.Name() + ":"
	router := gin.New()
	router.Use(func(c *gin.Context) {
		memoryRateLimiter(c, 1, 37, mark)
	})
	router.GET("/limited", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	first := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/limited", nil)
	request.RemoteAddr = "192.0.2.1:1234"
	router.ServeHTTP(first, request)
	assert.Equal(t, http.StatusNoContent, first.Code)

	limited := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "/limited", nil)
	request.RemoteAddr = "192.0.2.1:1234"
	router.ServeHTTP(limited, request)
	assert.Equal(t, http.StatusTooManyRequests, limited.Code)
	assert.Equal(t, "37", limited.Header().Get("Retry-After"))
}
