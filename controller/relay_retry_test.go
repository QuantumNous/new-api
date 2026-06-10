package controller

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldRetryUpstreamQuotaError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)

	err := types.NewOpenAIError(
		errors.New("Insufficient credits for Image generation"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)

	require.True(t, shouldRetry(ctx, err, 1))
}

func TestShouldRetryDoesNotRetryOrdinaryBadRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)

	err := types.NewOpenAIError(
		errors.New("invalid image size"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)

	require.False(t, shouldRetry(ctx, err, 1))
}

func TestShouldRetryUpstreamRelayedQuotaErrorCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)

	// 上游 OpenAI 风格错误体透传：errorCode 为上游 code，而非 bad_response_status_code
	err := types.WithOpenAIError(types.OpenAIError{
		Message: "当前模型暂时不可用，请稍后重试或联系管理员。",
		Type:    "new_api_error",
		Code:    "insufficient_user_quota",
	}, http.StatusForbidden)

	require.True(t, isRetryableUpstreamQuotaError(err))
}

func TestShouldRetryTaskRelayUpstreamQuotaError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)

	taskErr := &dto.TaskError{
		Message:    "Insufficient credits for video generation",
		StatusCode: http.StatusBadRequest,
	}

	require.True(t, shouldRetryTaskRelay(ctx, 1, taskErr, 1))
}

func TestShouldRetryTaskRelayOrdinaryBadRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)

	taskErr := &dto.TaskError{
		Message:    "invalid aspect ratio",
		StatusCode: http.StatusBadRequest,
	}

	require.False(t, shouldRetryTaskRelay(ctx, 1, taskErr, 1))
}

func TestShouldRetryDoesNotRetryLocalUserQuotaError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)

	err := types.NewErrorWithStatusCode(
		errors.New("用户额度不足, 剩余额度: 0"),
		types.ErrorCodeInsufficientUserQuota,
		http.StatusForbidden,
		types.ErrOptionWithSkipRetry(),
	)

	require.False(t, shouldRetry(ctx, err, 1))
}
