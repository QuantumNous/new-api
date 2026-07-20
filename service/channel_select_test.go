package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRetryParamPrepareAvailabilityFallbackRestartsAutoGroupSearch(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	common.SetContextKey(c, constant.ContextKeyAutoGroupIndex, 4)
	common.SetContextKey(c, constant.ContextKeyAutoGroupRetryIndex, 3)

	retryParam := &RetryParam{
		Ctx:        c,
		TokenGroup: "auto",
		Retry:      common.GetPointer(0),
	}
	retryParam.PrepareAvailabilityFallback(2)

	assert.Equal(t, 2, retryParam.GetRetry())
	groupIndex, _ := common.GetContextKey(c, constant.ContextKeyAutoGroupIndex)
	groupRetryIndex, _ := common.GetContextKey(c, constant.ContextKeyAutoGroupRetryIndex)
	assert.Equal(t, 0, groupIndex)
	assert.Equal(t, 0, groupRetryIndex)

	// The relay loop's post statement must not increment before the fallback
	// selection gets one attempt at the configured terminal priority.
	retryParam.IncreaseRetry()
	assert.Equal(t, 2, retryParam.GetRetry())
}
