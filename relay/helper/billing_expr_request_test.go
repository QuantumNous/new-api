package helper

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestResolveIncomingBillingExprRequestInput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("Content-Type", "application/json")

	body := []byte(`{"service_tier":"fast"}`)
	ctx.Request.Body = io.NopCloser(bytes.NewReader(body))
	ctx.Set(common.KeyRequestBody, body)

	info := &relaycommon.RelayInfo{
		RequestHeaders: map[string]string{"Content-Type": "application/json"},
	}

	input, err := ResolveIncomingBillingExprRequestInput(ctx, info)
	require.NoError(t, err)
	require.Equal(t, body, input.Body)
	require.Equal(t, "application/json", input.Headers["Content-Type"])
}

func TestResolveIncomingBillingExprRequestInputUsesValidatedImageFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	ctx.Request.Header.Set("Content-Type", "application/json")

	body := []byte(`{"model":"gpt-image-2","prompt":"test","n":0,"size":"1024x1024","custom":"kept"}`)
	ctx.Request.Body = io.NopCloser(bytes.NewReader(body))
	ctx.Set(common.KeyRequestBody, body)
	n := uint(1)
	info := &relaycommon.RelayInfo{
		Request: &dto.ImageRequest{
			Model:  "gpt-image-2",
			Prompt: "test",
			N:      &n,
			Size:   "1024x1024",
		},
	}

	input, err := ResolveIncomingBillingExprRequestInput(ctx, info)
	require.NoError(t, err)
	require.Equal(t, float64(1), gjson.GetBytes(input.Body, "n").Float())
	require.Equal(t, "1K", gjson.GetBytes(input.Body, "resolution").String())
	require.Equal(t, "kept", gjson.GetBytes(input.Body, "custom").String())
}

func TestResolveIncomingBillingExprRequestInputRejectsNullImageBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	ctx.Request.Header.Set("Content-Type", "application/json")

	body := []byte(`null`)
	ctx.Request.Body = io.NopCloser(bytes.NewReader(body))
	ctx.Set(common.KeyRequestBody, body)
	info := &relaycommon.RelayInfo{Request: &dto.ImageRequest{Model: "gpt-image-2", Prompt: "test"}}

	_, err := ResolveIncomingBillingExprRequestInput(ctx, info)
	require.EqualError(t, err, "image billing request body must be a JSON object")
}

func TestBuildBillingExprRequestInputFromRequest(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:  "gemini-3.1-pro-preview",
		Stream: lo.ToPtr(true),
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hi",
			},
		},
		MaxTokens: lo.ToPtr(uint(3000)),
	}

	input, err := BuildBillingExprRequestInputFromRequest(request, map[string]string{
		"Content-Type": "application/json",
		"X-Test":       "1",
	})
	require.NoError(t, err)
	require.Equal(t, "application/json", input.Headers["Content-Type"])
	require.Equal(t, "1", input.Headers["X-Test"])
	require.True(t, gjson.GetBytes(input.Body, "stream").Bool())
	require.Equal(t, "user", gjson.GetBytes(input.Body, "messages.0.role").String())
	require.Equal(t, float64(3000), gjson.GetBytes(input.Body, "max_tokens").Float())
}

func TestBuildBillingExprRequestInputFromImageRequestPreservesExtraFields(t *testing.T) {
	n := uint(1)
	request := &dto.ImageRequest{
		Model:  "gpt-image-2",
		Prompt: "test",
		N:      &n,
		Size:   "1024x1024",
		Extra:  map[string]json.RawMessage{"custom": json.RawMessage(`"kept"`)},
	}

	input, err := BuildBillingExprRequestInputFromRequest(request, nil)
	require.NoError(t, err)
	require.Equal(t, "kept", gjson.GetBytes(input.Body, "custom").String())
	require.Equal(t, float64(1), gjson.GetBytes(input.Body, "n").Float())
	require.Equal(t, "1K", gjson.GetBytes(input.Body, "resolution").String())
}
