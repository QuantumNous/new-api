package helper

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestGetAndValidOpenAIImageRequestMultipartStream verifies reusable image edit parsing.
func TestGetAndValidOpenAIImageRequestMultipartStream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("prompt", "edit this image"))
	require.NoError(t, writer.WriteField("stream", "true"))
	require.NoError(t, writer.WriteField("n", "1"))
	part, err := writer.CreateFormFile("image", "input.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("fake image"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	originalBody := body.String()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
	require.NoError(t, err)
	require.True(t, req.Stream)
	require.True(t, req.IsStream(c))

	bodyAfterValidation, err := io.ReadAll(c.Request.Body)
	require.NoError(t, err)
	require.Equal(t, originalBody, string(bodyAfterValidation))

	form, err := common.ParseMultipartFormReusable(c)
	require.NoError(t, err)
	require.Equal(t, "true", url.Values(form.Value).Get("stream"))
	require.Len(t, form.File["image"], 1)
}

// TestGetAndValidOpenAIImageRequestMultipartStreamInvalidValue verifies stream validation.
func TestGetAndValidOpenAIImageRequestMultipartStreamInvalidValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("stream", "notabool"))
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	_, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid stream value")
}
