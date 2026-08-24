package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestAppendSWXContext_AllKeys(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	common.SetContextKey(ctx, constant.ContextKeySWXUserId, "user_001")
	common.SetContextKey(ctx, constant.ContextKeySWXTraceId, "trace-abc")
	common.SetContextKey(ctx, constant.ContextKeySWXBizType, "text")
	common.SetContextKey(ctx, constant.ContextKeySWXRequestId, "req-1")

	other := make(map[string]interface{})
	appendSWXContext(ctx, other)

	assert.Equal(t, "user_001", other["swx_user_id"])
	assert.Equal(t, "trace-abc", other["swx_trace_id"])
	assert.Equal(t, "text", other["swx_biz_type"])
	assert.Equal(t, "req-1", other["swx_request_id"])
}

func TestAppendSWXContext_PartialKeys(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	// 仅设置 2 个 key
	common.SetContextKey(ctx, constant.ContextKeySWXUserId, "user_002")
	common.SetContextKey(ctx, constant.ContextKeySWXBizType, "image")

	other := make(map[string]interface{})
	appendSWXContext(ctx, other)

	assert.Equal(t, "user_002", other["swx_user_id"])
	assert.Equal(t, "image", other["swx_biz_type"])
	// 未设置的 key 不应写入空值
	_, hasTrace := other["swx_trace_id"]
	_, hasReq := other["swx_request_id"]
	assert.False(t, hasTrace, "swx_trace_id should not be written when empty")
	assert.False(t, hasReq, "swx_request_id should not be written when empty")
}

func TestAppendSWXContext_NilCtx(t *testing.T) {
	other := make(map[string]interface{})
	other["existing"] = "value"

	appendSWXContext(nil, other)

	// nil ctx 时 noop，不影响已有字段
	assert.Equal(t, "value", other["existing"])
	assert.Len(t, other, 1)
}

func TestAppendSWXContext_NilOther(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	common.SetContextKey(ctx, constant.ContextKeySWXUserId, "user_003")

	// nil map 不应 panic
	assert.NotPanics(t, func() {
		appendSWXContext(ctx, nil)
	})
}

func TestAppendSWXContext_NoKeysSet(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	other := make(map[string]interface{})
	appendSWXContext(ctx, other)

	// 没有任何 swx_* key 时，other 保持为空
	assert.Empty(t, other)
}
