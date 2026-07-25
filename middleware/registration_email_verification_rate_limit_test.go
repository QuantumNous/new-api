package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRegistrationEmailVerificationStatusRateLimitUsesSeparateBucket(t *testing.T) {
	previousRedisEnabled := common.RedisEnabled
	previousCriticalEnabled := common.CriticalRateLimitEnable
	previousCriticalLimit := common.CriticalRateLimitNum
	common.RedisEnabled = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.CriticalRateLimitEnable = previousCriticalEnabled
		common.CriticalRateLimitNum = previousCriticalLimit
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.POST("/status", RegistrationEmailVerificationStatusRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	engine.POST("/critical", CriticalRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	statusRequest := httptest.NewRequest(http.MethodPost, "/status", nil)
	statusRequest.RemoteAddr = "192.0.2.10:1234"
	statusResponse := httptest.NewRecorder()
	engine.ServeHTTP(statusResponse, statusRequest)
	require.Equal(t, http.StatusNoContent, statusResponse.Code)

	criticalRequest := httptest.NewRequest(http.MethodPost, "/critical", nil)
	criticalRequest.RemoteAddr = "192.0.2.10:1234"
	criticalResponse := httptest.NewRecorder()
	engine.ServeHTTP(criticalResponse, criticalRequest)
	require.Equal(t, http.StatusNoContent, criticalResponse.Code)
}

func TestCliDeviceAuthorizationPollRateLimitUsesSeparateBucket(t *testing.T) {
	previousRedisEnabled := common.RedisEnabled
	previousCriticalEnabled := common.CriticalRateLimitEnable
	previousCriticalLimit := common.CriticalRateLimitNum
	common.RedisEnabled = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.CriticalRateLimitEnable = previousCriticalEnabled
		common.CriticalRateLimitNum = previousCriticalLimit
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.POST("/critical", CriticalRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	engine.POST("/cli-poll", CliDeviceAuthorizationPollRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	criticalRequest := httptest.NewRequest(http.MethodPost, "/critical", nil)
	criticalRequest.RemoteAddr = "192.0.2.11:1234"
	criticalResponse := httptest.NewRecorder()
	engine.ServeHTTP(criticalResponse, criticalRequest)
	require.Equal(t, http.StatusNoContent, criticalResponse.Code)

	for i := 0; i < 2; i++ {
		pollRequest := httptest.NewRequest(http.MethodPost, "/cli-poll", nil)
		pollRequest.RemoteAddr = "192.0.2.11:1235"
		pollResponse := httptest.NewRecorder()
		engine.ServeHTTP(pollResponse, pollRequest)
		require.Equal(t, http.StatusNoContent, pollResponse.Code)
	}
}

func TestSubscriptionPaymentRateLimitUsesUserBucketSeparateFromCritical(t *testing.T) {
	previousRedisEnabled := common.RedisEnabled
	previousCriticalEnabled := common.CriticalRateLimitEnable
	previousCriticalLimit := common.CriticalRateLimitNum
	previousSubscriptionPaymentEnabled := common.SubscriptionPaymentRateLimitEnable
	previousSubscriptionPaymentLimit := common.SubscriptionPaymentRateLimitNum
	previousSubscriptionPaymentDuration := common.SubscriptionPaymentRateLimitDuration
	common.RedisEnabled = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	common.SubscriptionPaymentRateLimitEnable = true
	common.SubscriptionPaymentRateLimitNum = 1
	common.SubscriptionPaymentRateLimitDuration = 60
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.CriticalRateLimitEnable = previousCriticalEnabled
		common.CriticalRateLimitNum = previousCriticalLimit
		common.SubscriptionPaymentRateLimitEnable = previousSubscriptionPaymentEnabled
		common.SubscriptionPaymentRateLimitNum = previousSubscriptionPaymentLimit
		common.SubscriptionPaymentRateLimitDuration = previousSubscriptionPaymentDuration
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.POST("/critical", CriticalRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	engine.POST("/subscription-payment", func(c *gin.Context) {
		c.Set("id", 42)
	}, SubscriptionPaymentRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	engine.POST("/subscription-payment-other-user", func(c *gin.Context) {
		c.Set("id", 43)
	}, SubscriptionPaymentRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	criticalRequest := httptest.NewRequest(http.MethodPost, "/critical", nil)
	criticalRequest.RemoteAddr = "192.0.2.20:1234"
	criticalResponse := httptest.NewRecorder()
	engine.ServeHTTP(criticalResponse, criticalRequest)
	require.Equal(t, http.StatusNoContent, criticalResponse.Code)

	paymentRequest := httptest.NewRequest(http.MethodPost, "/subscription-payment", nil)
	paymentRequest.RemoteAddr = "192.0.2.20:1235"
	paymentResponse := httptest.NewRecorder()
	engine.ServeHTTP(paymentResponse, paymentRequest)
	require.Equal(t, http.StatusNoContent, paymentResponse.Code)

	blockedSameUserRequest := httptest.NewRequest(http.MethodPost, "/subscription-payment", nil)
	blockedSameUserRequest.RemoteAddr = "192.0.2.20:1236"
	blockedSameUserResponse := httptest.NewRecorder()
	engine.ServeHTTP(blockedSameUserResponse, blockedSameUserRequest)
	require.Equal(t, http.StatusTooManyRequests, blockedSameUserResponse.Code)

	otherUserRequest := httptest.NewRequest(http.MethodPost, "/subscription-payment-other-user", nil)
	otherUserRequest.RemoteAddr = "192.0.2.20:1237"
	otherUserResponse := httptest.NewRecorder()
	engine.ServeHTTP(otherUserResponse, otherUserRequest)
	require.Equal(t, http.StatusNoContent, otherUserResponse.Code)
}
