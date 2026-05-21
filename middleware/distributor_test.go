package middleware

import (
	"bytes"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	_ = i18n.Init()
}

func TestExtractModelRequestFromJSONBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := `{"model":"gpt-4.1","group":"vip","messages":[{"role":"user","content":"hello"}]}`
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	modelRequest, ok, err := extractModelRequestFromJSONBody(ctx)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, &ModelRequest{
		Model: "gpt-4.1",
		Group: "vip",
	}, modelRequest)

	var decoded map[string]any
	require.NoError(t, common.UnmarshalBodyReusable(ctx, &decoded))
	require.Equal(t, "gpt-4.1", decoded["model"])
	require.Equal(t, "vip", decoded["group"])
}

func TestGetModelFromRequestFallsBackForTypeMismatch(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := `{"model":123,"group":"vip"}`
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	modelRequest, err := getModelFromRequest(ctx)
	require.Nil(t, modelRequest)
	require.Error(t, err)
}

func TestExtractModelRequestFromJSONBodySkipsNonJSONObject(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`[]`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	modelRequest, ok, err := extractModelRequestFromJSONBody(ctx)
	require.NoError(t, err)
	require.Nil(t, modelRequest)
	require.False(t, ok)
}
