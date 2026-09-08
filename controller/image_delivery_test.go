package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImageDeliveryFailureRefundsWithoutRegenerating(t *testing.T) {
	_, _ = setupDrawingTests(t)
	oldRate, oldRetries := operation_setting.USDExchangeRate, common.RetryTimes
	operation_setting.USDExchangeRate, common.RetryTimes = 1, 2
	t.Cleanup(func() { operation_setting.USDExchangeRate, common.RetryTimes = oldRate, oldRetries })
	_, err := model.UpdateAgentProfile(81001, 1, 2, true, 0, false)
	require.NoError(t, err)
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"url":"http://127.0.0.1:1/unavailable"}]}`))
	}))
	defer upstream.Close()
	service.InitHttpClient()
	channel := model.Channel{Type: 1, Key: "fixture", Name: "image-delivery", BaseURL: &upstream.URL, Models: "gpt-image-2", Group: "default", Status: 1}
	require.NoError(t, channel.Insert())
	token := model.Token{UserId: 81001, Key: strings.Repeat("d", 48), Status: 1, RemainQuota: 1000000, ExpiredTime: -1, Group: "default"}
	require.NoError(t, model.DB.Create(&token).Error)
	r := gin.New()
	r.Use(middleware.BodyStorageCleanup())
	r.POST("/v1/images/generations", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) { Relay(c, types.RelayFormatOpenAIImage) })
	req := httptest.NewRequest("POST", "/v1/images/generations", strings.NewReader(`{"model":"gpt-image-2","prompt":"delivery failure test","n":1}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer sk-"+token.Key)
	response := httptest.NewRecorder()
	r.ServeHTTP(response, req)
	assert.Equal(t, http.StatusFailedDependency, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), "image_delivery_failed")
	assert.Equal(t, "false", response.Header().Get("x-should-retry"))
	assert.EqualValues(t, 1, calls.Load())
	require.Eventually(t, func() bool {
		user, userErr := model.GetUserById(81001, false)
		var saved model.Token
		tokenErr := model.DB.First(&saved, token.Id).Error
		return userErr == nil && tokenErr == nil && user.Quota == 10000000 && saved.RemainQuota == 1000000
	}, 2*time.Second, 10*time.Millisecond)
}
