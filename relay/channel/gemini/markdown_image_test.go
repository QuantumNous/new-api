package gemini

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testPNGBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func TestNormalizeGeminiMarkdownImagesPreservesResponseFields(t *testing.T) {
	t.Parallel()

	payload := []byte(`{
		"candidates":[{
			"content":{"role":"model","parts":[{"text":"![image](data:image/png;base64,` + testPNGBase64 + `)"}]},
			"finishReason":"STOP",
			"groundingMetadata":{"custom":"preserved"}
		}],
		"usageMetadata":{"promptTokenCount":7,"totalTokenCount":1407},
		"modelVersion":"gemini-test",
		"responseId":"response-test",
		"vendorExtension":{"enabled":true}
	}`)

	normalized, changed, err := normalizeGeminiMarkdownImages(payload)
	require.NoError(t, err)
	require.True(t, changed)

	var got map[string]any
	require.NoError(t, common.Unmarshal(normalized, &got))
	assert.Equal(t, "gemini-test", got["modelVersion"])
	assert.Equal(t, "response-test", got["responseId"])
	assert.Equal(t, true, got["vendorExtension"].(map[string]any)["enabled"])

	candidate := got["candidates"].([]any)[0].(map[string]any)
	assert.Equal(t, "preserved", candidate["groundingMetadata"].(map[string]any)["custom"])
	parts := candidate["content"].(map[string]any)["parts"].([]any)
	require.Len(t, parts, 1)
	part := parts[0].(map[string]any)
	assert.NotContains(t, part, "text")
	assert.Equal(t, map[string]any{
		"mimeType": "image/png",
		"data":     testPNGBase64,
	}, part["inlineData"])
}

func TestNormalizeGeminiMarkdownImagesSplitsTextAndMultipleImages(t *testing.T) {
	t.Parallel()

	payload := []byte(`{"candidates":[{"content":{"parts":[{"text":"before ![first](data:image/png;base64,` + testPNGBase64 + `) middle ![second](data:image/jpeg;base64,/9j/2Q==) after"}]}}]}`)
	normalized, changed, err := normalizeGeminiMarkdownImages(payload)
	require.NoError(t, err)
	require.True(t, changed)

	var response dto.GeminiChatResponse
	require.NoError(t, common.Unmarshal(normalized, &response))
	parts := response.Candidates[0].Content.Parts
	require.Len(t, parts, 5)
	assert.Equal(t, "before ", parts[0].Text)
	assert.Equal(t, "image/png", parts[1].InlineData.MimeType)
	assert.Equal(t, " middle ", parts[2].Text)
	assert.Equal(t, "image/jpeg", parts[3].InlineData.MimeType)
	assert.Equal(t, " after", parts[4].Text)
}

func TestNormalizeGeminiMarkdownImagesLeavesInvalidDataUnchanged(t *testing.T) {
	t.Parallel()

	payload := []byte(`{"candidates":[{"content":{"parts":[{"text":"![image](data:image/png;base64,not-valid-***)"},{"text":"![link](https://example.com/image.png)"}]}}]}`)
	normalized, changed, err := normalizeGeminiMarkdownImages(payload)
	require.NoError(t, err)
	assert.False(t, changed)
	assert.Equal(t, payload, normalized)
}

func TestGeminiTextGenerationHandlerReturnsOfficialInlineData(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-test:generateContent", nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-test",
		},
	}
	payload := []byte(`{"candidates":[{"content":{"role":"model","parts":[{"text":"![image](data:image/png;base64,` + testPNGBase64 + `)"}]},"finishReason":"STOP","index":0}],"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":1400,"totalTokenCount":1407},"responseId":"keep-me"}`)
	resp := &http.Response{Body: io.NopCloser(bytes.NewReader(payload))}

	usage, newAPIError := GeminiTextGenerationHandler(c, info, resp)
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 1400, usage.CompletionTokens)

	var got map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &got))
	assert.Equal(t, "keep-me", got["responseId"])
	parts := got["candidates"].([]any)[0].(map[string]any)["content"].(map[string]any)["parts"].([]any)
	part := parts[0].(map[string]any)
	assert.NotContains(t, part, "text")
	assert.Equal(t, "image/png", part["inlineData"].(map[string]any)["mimeType"])
	assert.Equal(t, testPNGBase64, part["inlineData"].(map[string]any)["data"])
}

func TestGeminiStreamHandlerNormalizesChunkBeforeCallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-test:streamGenerateContent", nil)

	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() {
		constant.StreamingTimeout = oldStreamingTimeout
	})

	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-test",
		},
	}
	chunk := `{"candidates":[{"content":{"role":"model","parts":[{"text":"![image](data:image/png;base64,` + testPNGBase64 + `)"}]}}],"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":1400,"totalTokenCount":1407}}`
	resp := &http.Response{Body: io.NopCloser(bytes.NewBufferString("data: " + chunk + "\n\ndata: [DONE]\n\n"))}

	callbackCount := 0
	usage, newAPIError := geminiStreamHandler(c, info, resp, func(data string, response *dto.GeminiChatResponse) bool {
		callbackCount++
		require.NotContains(t, data, "![image]")
		require.Len(t, response.Candidates[0].Content.Parts, 1)
		assert.Equal(t, "image/png", response.Candidates[0].Content.Parts[0].InlineData.MimeType)
		assert.Equal(t, testPNGBase64, response.Candidates[0].Content.Parts[0].InlineData.Data)
		return true
	})
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 1, callbackCount)
	assert.Equal(t, 1400, usage.CompletionTokens)
}
