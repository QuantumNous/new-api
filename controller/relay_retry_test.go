package controller

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldRetryStopsAfterChannelSelectionFailure(t *testing.T) {
	ctx, _ := gin.CreateTestContext(nil)
	err := types.NewError(errors.New("no eligible channel"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	require.False(t, shouldRetry(ctx, err, 2))
}

func TestShouldRetrySwitchesChannelOnUpstreamQuotaExhaustion(t *testing.T) {
	ctx, _ := gin.CreateTestContext(nil)
	err := types.WithOpenAIError(types.OpenAIError{
		Message: "upstream account has insufficient balance",
		Code:    "insufficient_quota",
	}, http.StatusTooManyRequests)
	require.True(t, shouldRetry(ctx, err, 2))
}

func TestShouldRetryDoesNotSwitchForLocalUserQuota(t *testing.T) {
	ctx, _ := gin.CreateTestContext(nil)
	err := types.NewErrorWithStatusCode(
		errors.New("user quota insufficient"),
		types.ErrorCodeInsufficientUserQuota,
		http.StatusForbidden,
		types.ErrOptionWithSkipRetry(),
	)
	require.False(t, shouldRetry(ctx, err, 2))
}
