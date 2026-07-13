package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldSuppressFinalFailureNotificationForClientDisconnectReasons(t *testing.T) {
	gin.SetMode(gin.TestMode)

	testCases := []struct {
		name   string
		reason string
	}{
		{name: "client canceled", reason: "client_canceled"},
		{name: "client disconnected", reason: "client_disconnected"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			ctx.Request = req
			ctx.Set("retry_decision", map[string]interface{}{"reason": tc.reason})

			err := types.NewErrorWithStatusCode(context.Canceled, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
			require.True(t, shouldSuppressFinalFailureNotification(ctx, "claude-sonnet-5", err))
		})
	}
}

func TestShouldSuppressFinalFailureNotificationForCanceledRequestContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	reqCtx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(reqCtx)
	ctx.Request = req

	err := types.NewErrorWithStatusCode(context.Canceled, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	require.True(t, shouldSuppressFinalFailureNotification(ctx, "claude-sonnet-5", err))
}

func TestShouldSuppressFinalFailureNotificationKeepsRealFailures(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("retry_decision", map[string]interface{}{"reason": "retry_times_exhausted"})

	err := types.NewErrorWithStatusCode(context.DeadlineExceeded, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	require.False(t, shouldSuppressFinalFailureNotification(ctx, "claude-sonnet-5", err))
}
