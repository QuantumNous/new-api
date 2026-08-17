package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestIOCopyBytesGracefullyPreservesOriginRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	common.SetContextKey(context, constant.ContextKeyOriginIntegration, true)
	context.Header("X-Request-Id", "origin-request-id")

	response := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"application/json"},
			"X-Request-Id": []string{"provider-request-id"},
		},
	}
	IOCopyBytesGracefully(context, response, []byte(`{"status":"completed"}`))

	assert.Equal(t, "origin-request-id", recorder.Header().Get("X-Request-Id"))
	assert.Equal(t, "provider-request-id", context.GetString(common.UpstreamRequestIdKey))
}
