package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The empty/blacklisted response errors returned by the relay handlers must
// drive the existing channel retry loop.
func TestShouldRetryEmptyAndBlacklistedResponseErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	emptyErr := types.NewOpenAIError(
		assert.AnError, types.ErrorCodeEmptyResponse, http.StatusBadGateway)
	blacklistedErr := types.NewOpenAIError(
		assert.AnError, types.ErrorCodeBlacklistedResponse, http.StatusBadGateway)

	require.True(t, shouldRetry(c, emptyErr, 1), "empty response errors must retry on another channel")
	require.True(t, shouldRetry(c, blacklistedErr, 1), "blacklisted response errors must retry on another channel")

	assert.False(t, shouldRetry(c, emptyErr, 0), "no retries left")

	c.Set("specific_channel_id", 1)
	assert.False(t, shouldRetry(c, emptyErr, 1), "pinned channel must not retry")
}
