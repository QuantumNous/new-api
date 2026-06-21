package helper

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestParseImageGenerationsMultipart(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	require.NoError(t, writer.WriteField("model", "gpt-image-2"))
	require.NoError(t, writer.WriteField("prompt", "熊拿宝剑"))
	require.NoError(t, writer.WriteField("size", "1:1"))
	require.NoError(t, writer.WriteField("resolution", "1k"))
	part, err := writer.CreateFormFile("images", "ref.png")
	require.NoError(t, err)
	_, err = part.Write([]byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/images/generations/async", body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	req, err := ParseImageGenerationsMultipart(c)
	require.NoError(t, err)
	require.Equal(t, "gpt-image-2", req.Model)
	require.Equal(t, "熊拿宝剑", req.Prompt)
	require.Equal(t, "1:1", req.Size)
	require.Equal(t, "1k", req.Resolution)
	require.Len(t, req.ImageUrls, 1)
	require.True(t, len(req.ImageUrls[0]) > 0)
}

func TestImageDataURIsFromMultipartForm_empty(t *testing.T) {
	urls, err := imageDataURIsFromMultipart(nil)
	require.NoError(t, err)
	require.Nil(t, urls)
}

func TestImageDataURIsFromMultipartForm_rejectsOversize(t *testing.T) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("images", "big.png")
	require.NoError(t, err)
	_, err = io.CopyN(part, bytes.NewReader(make([]byte, maxPlaygroundImagePartBytes+1)), maxPlaygroundImagePartBytes+1)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	r := httptest.NewRequest("POST", "/", body)
	r.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, r.ParseMultipartForm(maxPlaygroundImagePartBytes+1024))

	_, err = imageDataURIsFromMultipart(r.MultipartForm)
	require.Error(t, err)
}
