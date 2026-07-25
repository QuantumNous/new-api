package helper

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSummarizeRelayTraceBodyRedactsCredentialsAndBinaryData(t *testing.T) {
	result := summarizeRelayTraceBody(
		[]byte(`{"prompt":"draw a red apple","api_key":"secret","image":"data:image/png;base64,hidden"}`),
		79,
		1024,
		"application/json",
		false,
	)

	body, ok := result["body"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "draw a red apple", body["prompt"])
	assert.Equal(t, "[redacted]", body["api_key"])
	assert.Equal(t, "[redacted]", body["image"])
}

func TestSummarizeRelayTraceBodyOmitsBinaryAndLargeBodies(t *testing.T) {
	binary := summarizeRelayTraceBody([]byte("image-bytes"), 11, 1024, "image/png", false)
	assert.Equal(t, "[binary body omitted]", binary["body"])

	large := summarizeRelayTraceBody([]byte("preview"), 1024, 7, "application/json", false)
	assert.Equal(t, true, large["truncated"])
	assert.Equal(t, "[body preview truncated]", large["body"])
}

func TestSummarizeRelayTraceBodyKeepsFullBodyWhenEnabled(t *testing.T) {
	jsonBody := summarizeRelayTraceBody(
		[]byte(`{"api_key":"secret","prompt":"apple"}`),
		37,
		1024,
		"application/json",
		true,
	)
	assert.Equal(t, `{"api_key":"secret","prompt":"apple"}`, jsonBody["body"])

	binaryBody := summarizeRelayTraceBody([]byte("image-bytes"), 11, 1024, "image/png", true)
	assert.Equal(t, "base64", binaryBody["body_encoding"])
	assert.Equal(t, "aW1hZ2UtYnl0ZXM=", binaryBody["body"])
}

func TestRelayTraceCapturesUpstreamAndDownstreamBodies(t *testing.T) {
	oldEnabled := constant.RelayTraceLogEnabled
	oldLimit := constant.RelayTraceLogMaxBodyKB
	constant.RelayTraceLogEnabled = true
	constant.RelayTraceLogMaxBodyKB = 4
	t.Cleanup(func() {
		constant.RelayTraceLogEnabled = oldEnabled
		constant.RelayTraceLogMaxBodyKB = oldLimit
	})

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(`{"prompt":"apple"}`))
	StartRelayTrace(c, "openai_image")

	upstreamReq := httptest.NewRequest(http.MethodPost, "https://upstream.example/v1/images?key=secret", bytes.NewBufferString(`{"prompt":"apple","api_key":"secret"}`))
	upstreamReq.Header.Set("Content-Type", "application/json")
	upstreamReq.Header.Set("Authorization", "Bearer upstream-secret")
	CaptureUpstreamRequest(c, upstreamReq, &relaycommon.RelayInfo{
		OriginModelName: "gpt-image-1",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "provider-image"},
	})
	_, err := io.ReadAll(upstreamReq.Body)
	require.NoError(t, err)

	upstreamResp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewBufferString(`{"error":"provider unavailable"}`)),
	}
	CaptureUpstreamResponse(c, upstreamResp)
	_, err = io.ReadAll(upstreamResp.Body)
	require.NoError(t, err)
	c.JSON(http.StatusBadGateway, gin.H{"error": "provider unavailable"})

	trace := getRelayTrace(c)
	require.NotNil(t, trace)
	attempts := trace.snapshotAttempts()
	require.Len(t, attempts, 1)
	attempt := attempts[0].(map[string]any)
	assert.Equal(t, "https://upstream.example/v1/images?key=%5Bredacted%5D", attempt["url"])
	assert.Equal(t, "[redacted]", attempt["headers"].(map[string]any)["Authorization"])
	assert.Equal(t, "[redacted]", sanitizeRelayTraceHeaders(http.Header{"X-Goog-Api-Key": []string{"provider-secret"}})["X-Goog-Api-Key"])
	requestBody := attempt["request_body"].(map[string]any)["body"].(map[string]any)
	assert.Equal(t, "[redacted]", requestBody["api_key"])
	response := attempt["response"].(map[string]any)
	assert.Equal(t, http.StatusBadGateway, response["status"])
	assert.Equal(t, "provider unavailable", response["body"].(map[string]any)["body"].(map[string]any)["error"])
}

func TestShouldLogRelayTraceInFailureOnlyMode(t *testing.T) {
	oldFailureOnly := constant.RelayTraceLogFailureOnly
	constant.RelayTraceLogFailureOnly = true
	t.Cleanup(func() {
		constant.RelayTraceLogFailureOnly = oldFailureOnly
	})

	assert.False(t, shouldLogRelayTrace(http.StatusOK, nil))
	assert.True(t, shouldLogRelayTrace(http.StatusBadRequest, nil))
	assert.True(t, shouldLogRelayTrace(http.StatusOK, assert.AnError))
}
