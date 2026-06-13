package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldRetryReturnsFalseWhenClientRequestDone(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	reqCtx, cancel := context.WithCancel(req.Context())
	cancel()
	ctx.Request = req.WithContext(reqCtx)

	err := types.NewErrorWithStatusCode(
		fmt.Errorf("upstream error"),
		types.ErrorCodeBadResponse,
		http.StatusInternalServerError,
	)

	require.False(t, shouldRetry(ctx, err, 1))
}

func TestShouldRetryTaskRelayReturnsFalseWhenClientRequestDone(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	reqCtx, cancel := context.WithCancel(req.Context())
	cancel()
	ctx.Request = req.WithContext(reqCtx)

	taskErr := &dto.TaskError{
		Code:       "upstream_error",
		Message:    "upstream error",
		StatusCode: http.StatusInternalServerError,
	}

	require.False(t, shouldRetryTaskRelay(ctx, 1, taskErr, 1))
}
