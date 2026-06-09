package openai

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestConvertImageEditRequestKeepsValidMultipartStreamFields verifies multipart replay.
func TestConvertImageEditRequestKeepsValidMultipartStreamFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("prompt", "edit this image"))
	require.NoError(t, writer.WriteField("stream", "true"))
	require.NoError(t, writer.WriteField("partial_images", "3"))
	part, err := writer.CreateFormFile("image", "input.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("fake image"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, c.Request.ParseMultipartForm(32<<20))

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
	}
	request := dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "edit this image",
		Stream: true,
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	convertedBody, ok := converted.(*bytes.Buffer)
	require.True(t, ok)

	contentType := c.Request.Header.Get("Content-Type")
	replayedRequest := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(convertedBody.Bytes()))
	replayedRequest.Header.Set("Content-Type", contentType)
	require.NoError(t, replayedRequest.ParseMultipartForm(32<<20))

	require.Equal(t, "gpt-image-1", replayedRequest.PostForm.Get("model"))
	require.Equal(t, "edit this image", replayedRequest.PostForm.Get("prompt"))
	require.Equal(t, "true", replayedRequest.PostForm.Get("stream"))
	require.Equal(t, "3", replayedRequest.PostForm.Get("partial_images"))
	require.Len(t, replayedRequest.MultipartForm.File["image"], 1)

	file, err := replayedRequest.MultipartForm.File["image"][0].Open()
	require.NoError(t, err)
	defer file.Close()
	fileBytes, err := io.ReadAll(file)
	require.NoError(t, err)
	require.Equal(t, []byte("fake image"), fileBytes)
}

// TestConvertImageEditRequestParsesReusableMultipartWhenFormIsMissing verifies fallback parsing.
func TestConvertImageEditRequestParsesReusableMultipartWhenFormIsMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("prompt", "edit without pre-parsed form"))
	require.NoError(t, writer.WriteField("stream", "true"))
	part, err := writer.CreateFormFile("image", "input.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("fake image"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	c.Request.Body = io.NopCloser(storage)
	c.Request.MultipartForm = nil
	c.Request.PostForm = nil

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
	}
	request := dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "edit without pre-parsed form",
		Stream: true,
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	convertedBody, ok := converted.(*bytes.Buffer)
	require.True(t, ok)
	replayedRequest := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(convertedBody.Bytes()))
	replayedRequest.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	require.NoError(t, replayedRequest.ParseMultipartForm(32<<20))
	require.Equal(t, "edit without pre-parsed form", replayedRequest.PostForm.Get("prompt"))
	require.Equal(t, "true", replayedRequest.PostForm.Get("stream"))
	require.Len(t, replayedRequest.MultipartForm.File["image"], 1)
}
