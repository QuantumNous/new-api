package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	newapii18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAbortWithRelayMessageUsesClaudeEnvelope(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", nil)
	c.Set(common.RequestIdKey, "req_gateway")

	abortWithRelayMessage(c, http.StatusTooManyRequests, "slow down")

	require.Equal(t, http.StatusTooManyRequests, recorder.Code)
	require.JSONEq(t, `{
		"type":"error",
		"error":{"type":"rate_limit_error","message":"slow down"},
		"request_id":"req_gateway"
	}`, recorder.Body.String())
	require.True(t, c.IsAborted())
}

func TestAbortWithRelayMessageKeepsOpenAIEnvelope(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "req_gateway")

	abortWithRelayMessage(c, http.StatusServiceUnavailable, "no channel", types.ErrorCodeModelNotFound)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.JSONEq(t, `{
		"error":{
			"type":"new_api_error",
			"code":"model_not_found",
			"message":"no channel (request id: req_gateway)"
		}
	}`, recorder.Body.String())
	require.True(t, c.IsAborted())
}

func TestDistributeUsesClaudeRequestTooLargeEnvelope(t *testing.T) {
	require.NoError(t, newapii18n.Init())

	oldMaxRequestBodyMB := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() {
		constant.MaxRequestBodyMB = oldMaxRequestBodyMB
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/messages",
		strings.NewReader(`{"model":"claude-test","padding":"`+strings.Repeat("x", 1<<20)+`"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(common.RequestIdKey, "req_too_large")

	Distribute()(c)

	require.Equal(t, http.StatusRequestEntityTooLarge, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"type":"request_too_large"`)
	require.Contains(t, recorder.Body.String(), `"request_id":"req_too_large"`)
	require.True(t, c.IsAborted())
}
