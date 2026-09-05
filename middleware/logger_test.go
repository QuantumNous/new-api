package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestSetUpLoggerRedactsCustomDomainCallbackSecretsWithoutMutatingRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousWriter := gin.DefaultWriter
	var output bytes.Buffer
	gin.DefaultWriter = &output
	t.Cleanup(func() { gin.DefaultWriter = previousWriter })

	router := gin.New()
	SetUpLogger(router)
	for _, path := range []string{
		"/api/stripe/return",
		"/api/user/epay/return",
		"/api/reset_password/return",
		"/user/reset",
	} {
		routePath := path
		router.GET(routePath, func(c *gin.Context) {
			assert.Equal(t, "order-secret", c.Query("trade_no"))
			assert.Equal(t, "signature-secret", c.Query("sign"))
			assert.Equal(t, "reset-token-secret", c.Query("token"))
			c.Status(http.StatusNoContent)
		})
	}

	query := "trade_no=order-secret&out_trade_no=merchant-secret&sign=signature-secret&email=person%40example.com&token=reset-token-secret&context=context-secret&keep=visible"
	for _, path := range []string{
		"/api/stripe/return",
		"/api/user/epay/return",
		"/api/reset_password/return",
		"/user/reset",
	} {
		request := httptest.NewRequest(http.MethodGet, path+"?"+query, nil)
		router.ServeHTTP(httptest.NewRecorder(), request)
	}

	logged := output.String()
	for _, secret := range []string{"order-secret", "merchant-secret", "signature-secret", "person%40example.com", "reset-token-secret", "context-secret"} {
		assert.NotContains(t, logged, secret)
	}
	assert.Contains(t, logged, "keep=visible")
	assert.Contains(t, logged, strings.ToUpper("%5Bredacted%5D"))
}
