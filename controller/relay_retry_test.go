package controller

import (
	"errors"
	"net/http"
	"testing"

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
