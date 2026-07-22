package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRespondTaskErrorPreservesLocalRateLimitMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	taskErr := &dto.TaskError{
		Code:       string(types.ErrorCodeChannelRateLimited),
		Message:    "channel #1 rate limit reached",
		StatusCode: http.StatusTooManyRequests,
		LocalError: true,
	}

	respondTaskError(ctx, taskErr)

	require.Equal(t, http.StatusTooManyRequests, recorder.Code)
	var response dto.TaskError
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, string(types.ErrorCodeChannelRateLimited), response.Code)
	require.Equal(t, "channel #1 rate limit reached", response.Message)
}

func TestRespondTaskErrorRewritesUpstreamRateLimitMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	taskErr := &dto.TaskError{
		Code:       "upstream_rate_limit",
		Message:    "provider response",
		StatusCode: http.StatusTooManyRequests,
	}

	respondTaskError(ctx, taskErr)

	require.Equal(t, http.StatusTooManyRequests, recorder.Code)
	var response dto.TaskError
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, "当前分组上游负载已饱和，请稍后再试", response.Message)
}
