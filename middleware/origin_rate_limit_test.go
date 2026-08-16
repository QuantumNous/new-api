package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/origin"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelRequestRateLimitDefersOriginQuotaAuthorityToPlatform(t *testing.T) {
	previousEnabled := setting.ModelRequestRateLimitEnabled
	previousRedisEnabled := common.RedisEnabled
	previousTotalLimit := setting.ModelRequestRateLimitCount
	previousSuccessLimit := setting.ModelRequestRateLimitSuccessCount
	setting.ModelRequestRateLimitEnabled = true
	common.RedisEnabled = false
	setting.ModelRequestRateLimitCount = 0
	setting.ModelRequestRateLimitSuccessCount = 1
	t.Cleanup(func() {
		setting.ModelRequestRateLimitEnabled = previousEnabled
		common.RedisEnabled = previousRedisEnabled
		setting.ModelRequestRateLimitCount = previousTotalLimit
		setting.ModelRequestRateLimitSuccessCount = previousSuccessLimit
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST(
		"/v1/responses",
		func(c *gin.Context) {
			require.True(t, origin.SetCredential(c, "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd"))
			c.Set("id", 987654)
			c.Next()
		},
		ModelRequestRateLimit(),
		func(c *gin.Context) { c.Status(http.StatusNoContent) },
	)
	for range 2 {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/v1/responses", nil))
		assert.Equal(t, http.StatusNoContent, recorder.Code)
	}
}
