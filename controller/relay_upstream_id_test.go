package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestResetUpstreamIdsForAttempt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set(common.UpstreamRequestIdKey, "req_attempt_a")
	c.Set(common.UpstreamResponseIdKey, "resp_attempt_a")

	resetUpstreamIdsForAttempt(c)

	_, hasRequestId := c.Get(common.UpstreamRequestIdKey)
	_, hasResponseId := c.Get(common.UpstreamResponseIdKey)
	require.False(t, hasRequestId)
	require.False(t, hasResponseId)
}
