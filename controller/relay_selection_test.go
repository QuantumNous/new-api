package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldAdvanceAfterGovernorSelectionRejected(t *testing.T) {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	apiErr := types.NewErrorWithStatusCode(
		errors.New("all candidate channels are cooling or saturated"),
		types.ErrorCodeGovernorSelectionRejected,
		http.StatusTooManyRequests,
	)

	require.True(t, shouldAdvanceAfterGovernorSelectionRejected(ctx, apiErr, 1))
	require.False(t, shouldAdvanceAfterGovernorSelectionRejected(ctx, apiErr, 0))
}

func TestShouldAdvanceAfterGovernorSelectionRejected_RespectsAffinitySkipRetry(t *testing.T) {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Set("channel_affinity_skip_retry_on_failure", true)
	apiErr := types.NewErrorWithStatusCode(
		errors.New("all candidate channels are cooling or saturated"),
		types.ErrorCodeGovernorSelectionRejected,
		http.StatusTooManyRequests,
	)

	require.False(t, shouldAdvanceAfterGovernorSelectionRejected(ctx, apiErr, 1))
}
