package helper

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAndValidateGeminiRequestAcceptsCountTokensWrapper(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1beta/models/gemini-2.5-flash:countTokens",
		strings.NewReader(`{"generateContentRequest":{"contents":[{"parts":[{"text":"hello"}]}]}}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	request, err := GetAndValidateGeminiRequest(c)

	require.NoError(t, err)
	require.NotNil(t, request.GenerateContentRequest)
	require.Len(t, request.GenerateContentRequest.Contents, 1)
	assert.Equal(t, "hello", request.GenerateContentRequest.Contents[0].Parts[0].Text)
}

func TestGetAndValidateGeminiRequestStillRejectsEmptyGenerateContent(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1beta/models/gemini-2.5-flash:generateContent",
		strings.NewReader(`{"generateContentRequest":{"contents":[{"parts":[{"text":"hello"}]}]}}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	_, err := GetAndValidateGeminiRequest(c)

	require.Error(t, err)
	assert.Equal(t, "contents is required", err.Error())
}
