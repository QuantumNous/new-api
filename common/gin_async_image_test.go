package common

import (
	"bytes"
	"encoding/base64"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAsyncImageEditMultipartAlwaysUsesDiskBodyStorage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	part, err := writer.CreateFormFile("image", "source.png")
	require.NoError(t, err)
	_, err = part.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'})
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	t.Cleanup(func() { CleanupBodyStorage(c) })

	storage, err := GetBodyStorage(c)
	require.NoError(t, err)
	assert.True(t, storage.IsDisk())

	form, err := ParseMultipartFormReusable(c)
	require.NoError(t, err)
	require.Len(t, form.File["image"], 1)
	file, err := form.File["image"][0].Open()
	require.NoError(t, err)
	defer file.Close()
	payload, err := io.ReadAll(file)
	require.NoError(t, err)
	assert.Equal(t, []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, payload)
	assert.Same(t, form, c.Request.MultipartForm)
}

func TestAsyncImageEditDataURIIsSpilledAsFilePart(t *testing.T) {
	gin.SetMode(gin.TestMode)
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x01}
	dataURI := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("prompt", "edit"))
	require.NoError(t, writer.WriteField("image", dataURI))
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	t.Cleanup(func() { CleanupBodyStorage(c) })

	form, err := ParseMultipartFormReusable(c)
	require.NoError(t, err)
	assert.Empty(t, form.Value["image"])
	require.Len(t, form.File["image"], 1)
	assert.True(t, IsAsyncImageDataURIFile(form.File["image"][0].Header))
	file, err := form.File["image"][0].Open()
	require.NoError(t, err)
	defer file.Close()
	payload, err := io.ReadAll(file)
	require.NoError(t, err)
	assert.Equal(t, dataURI, string(payload))
}
