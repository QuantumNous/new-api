package common

import (
	"bytes"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetRequestBodyMarksCacheControlCount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest("POST", "/v1/messages", bytes.NewBufferString(`{
		"messages":[
			{"role":"user","content":[{"type":"text","text":"a","cache_control":{"type":"ephemeral"}}]},
			{"role":"user","content":[{"type":"text","text":"b","cache_control":{"type":"ephemeral"}}]}
		]
	}`))

	storage, err := GetBodyStorage(ctx)

	require.NoError(t, err)
	defer storage.Close()
	require.True(t, GetContextKeyBool(ctx, constant.ContextKeyRequestHasCacheControl))
	require.Equal(t, 2, GetContextKeyInt(ctx, constant.ContextKeyRequestCacheControlCount))

	_, err = storage.Seek(0, io.SeekStart)
	require.NoError(t, err)
}
