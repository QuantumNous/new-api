package helper

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/require"

	"github.com/gin-gonic/gin"
)

func TestGetAndValidOpenAIImageRequestAllowsGPTImage2SixImages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"gpt-image2",
		"prompt":"make a campaign image",
		"size":"3:2",
		"image_urls":[
			"https://example.com/1.png",
			"https://example.com/2.png",
			"https://example.com/3.png",
			"https://example.com/4.png",
			"https://example.com/5.png",
			"https://example.com/6.png"
		]
	}`
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/images/generations", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	req, err := GetAndValidOpenAIImageRequest(ctx, relayconstant.RelayModeImagesGenerations)

	require.NoError(t, err)
	require.Equal(t, "gpt-image2", req.Model)
	require.Equal(t, "3:2", req.Size)
	require.Equal(t, "3:2", req.AspectRatio)
}

func TestGetAndValidOpenAIImageRequestRejectsGPTImage2InvalidSize(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"gpt-image2",
		"prompt":"make a campaign image",
		"size":"1024x1024"
	}`
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/images/generations", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	_, err := GetAndValidOpenAIImageRequest(ctx, relayconstant.RelayModeImagesGenerations)

	require.Error(t, err)
	require.Contains(t, err.Error(), "size must be one of")
}

func TestGetAndValidOpenAIImageRequestRejectsGPTImage2TooManyJSONImages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"gpt-image2",
		"prompt":"make a campaign image",
		"aspect_ratio":"16:9",
		"image_urls":[
			"https://example.com/1.png",
			"https://example.com/2.png",
			"https://example.com/3.png",
			"https://example.com/4.png",
			"https://example.com/5.png",
			"https://example.com/6.png",
			"https://example.com/7.png"
		]
	}`
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/images/generations", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	_, err := GetAndValidOpenAIImageRequest(ctx, relayconstant.RelayModeImagesGenerations)

	require.Error(t, err)
	require.Contains(t, err.Error(), "at most 6 uploaded images")
}

func TestGetAndValidOpenAIImageRequestRejectsGPTImage2TooManyMultipartImages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image2"))
	require.NoError(t, writer.WriteField("prompt", "make a campaign image"))
	require.NoError(t, writer.WriteField("size", "1:1"))
	for i := 0; i < 7; i++ {
		part, err := writer.CreateFormFile("image[]", fmt.Sprintf("image-%d.png", i))
		require.NoError(t, err)
		_, err = part.Write([]byte("fake image"))
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/images/edits", &body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())

	_, err := GetAndValidOpenAIImageRequest(ctx, relayconstant.RelayModeImagesEdits)

	require.Error(t, err)
	require.Contains(t, err.Error(), "at most 6 uploaded images")
}
