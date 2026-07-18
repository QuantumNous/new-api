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
	registerWaffoDomainVerificationRoutes(engine)

	for _, path := range []string{
		"/.well-known/waffo-challenge.txt",
		"/.well-known/waffo-verify.txt",
	} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)

			require.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, "text/plain; charset=utf-8", recorder.Header().Get("Content-Type"))
			assert.Equal(t, "760c72286c01046cfc453ce8c7324f2b", recorder.Body.String())
			assert.NotContains(t, recorder.Body.String(), "\n")
		})
	}
}
