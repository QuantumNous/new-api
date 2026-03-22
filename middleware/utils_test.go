package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAbortWithOpenAiMessageWritesBootstrapStreamError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"gpt-5","stream":true}`))
	ctx.Request.Header.Set("Content-Type", gin.MIMEJSON)
	common.SetContextKey(ctx, constant.ContextKeyResponsesBootstrapRecoveryState, &service.ResponsesBootstrapRecoveryState{
		Enabled:     true,
		HeadersSent: true,
	})
	ctx.Set(common.RequestIdKey, "req-test")

	abortWithOpenAiMessage(ctx, http.StatusServiceUnavailable, "upstream temporarily unavailable")

	require.True(t, ctx.IsAborted())
	require.Contains(t, recorder.Header().Get("Content-Type"), "text/event-stream")
	require.Contains(t, recorder.Body.String(), "event: error")
	require.Contains(t, recorder.Body.String(), "upstream temporarily unavailable")
	require.Contains(t, recorder.Body.String(), "req-test")
}
