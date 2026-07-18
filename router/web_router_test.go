package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServeWaffoDomainVerification(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.GET("/.well-known/waffo-challenge.txt", serveWaffoDomainVerification)

	request := httptest.NewRequest(http.MethodGet, "/.well-known/waffo-challenge.txt", nil)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "text/plain; charset=utf-8", recorder.Header().Get("Content-Type"))
	assert.Equal(t, waffoDomainVerificationToken, recorder.Body.String())
	assert.NotContains(t, recorder.Body.String(), "\n")
}
