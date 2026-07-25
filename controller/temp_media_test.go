package controller

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type tempMediaAPIResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		ObjectKey   string `json:"object_key"`
		SignedURL   string `json:"signed_url"`
		ExpiresAt   int64  `json:"expires_at"`
		ExpiresIn   int64  `json:"expires_in"`
		ContentType string `json:"content_type"`
		Size        int64  `json:"size"`
	} `json:"data"`
}

func TestUploadTempMediaImageControllerUploadsMultipartFile(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	t.Setenv("TEMP_MEDIA_MAX_IMAGE_BYTES", "1048576")

	originalUpload := uploadTempMediaImage
	t.Cleanup(func() {
		uploadTempMediaImage = originalUpload
	})

	uploadTempMediaImage = func(_ context.Context, request service.TempMediaUploadRequest) (*service.TempMediaUploadResult, error) {
		require.Equal(t, 123, request.UserID)
		require.Equal(t, "cat.png", request.Filename)
		require.Equal(t, "image/png", request.ContentType)
		require.Equal(t, int64(7), request.Size)
		payload, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		require.Equal(t, "payload", string(payload))
		return &service.TempMediaUploadResult{
			ObjectKey:   "temp-media/123/20260725/key.png",
			SignedURL:   "https://storage.example/signed",
			ExpiresAt:   1784990000,
			ExpiresIn:   43200,
			ContentType: "image/png",
			Size:        7,
		}, nil
	}

	ctx, recorder := newTempMediaMultipartContext(t, "file", "cat.png", "image/png", []byte("payload"))
	ctx.Set("id", 123)
	UploadTempMediaImage(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response tempMediaAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Empty(t, response.Message)
	require.Equal(t, "temp-media/123/20260725/key.png", response.Data.ObjectKey)
	require.Equal(t, "https://storage.example/signed", response.Data.SignedURL)
	require.Equal(t, int64(43200), response.Data.ExpiresIn)
}

func TestUploadTempMediaImageControllerRequiresFile(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	ctx, recorder := newTempMediaMultipartContext(t, "other", "cat.png", "image/png", []byte("payload"))
	ctx.Set("id", 123)
	UploadTempMediaImage(ctx)

	var response tempMediaAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	require.Equal(t, "Image file is required", response.Message)
}

func TestUploadTempMediaImageControllerMapsOversizedMultipartBody(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	t.Setenv("TEMP_MEDIA_MAX_IMAGE_BYTES", "1")

	ctx, recorder := newTempMediaMultipartContext(t, "file", "cat.png", "image/png", []byte("payload"))
	ctx.Set("id", 123)
	UploadTempMediaImage(ctx)

	var response tempMediaAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	require.Equal(t, "Image file is too large", response.Message)
}

func TestUploadTempMediaImageControllerMapsUnsupportedType(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalUpload := uploadTempMediaImage
	t.Cleanup(func() {
		uploadTempMediaImage = originalUpload
	})
	uploadTempMediaImage = func(context.Context, service.TempMediaUploadRequest) (*service.TempMediaUploadResult, error) {
		return nil, service.ErrTempMediaUnsupportedImage
	}

	ctx, recorder := newTempMediaMultipartContext(t, "file", "cat.gif", "image/gif", []byte("payload"))
	ctx.Set("id", 123)
	UploadTempMediaImage(ctx)

	var response tempMediaAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	require.Equal(t, "Unsupported image type", response.Message)
}

func TestUploadTempMediaImageControllerMapsStorageFailure(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalUpload := uploadTempMediaImage
	t.Cleanup(func() {
		uploadTempMediaImage = originalUpload
	})
	uploadTempMediaImage = func(context.Context, service.TempMediaUploadRequest) (*service.TempMediaUploadResult, error) {
		return nil, errors.New("storage failed")
	}

	ctx, recorder := newTempMediaMultipartContext(t, "file", "cat.png", "image/png", []byte("payload"))
	ctx.Set("id", 123)
	UploadTempMediaImage(ctx)

	var response tempMediaAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	require.Equal(t, "Failed to upload image", response.Message)
}

func newTempMediaMultipartContext(t *testing.T, field string, filename string, contentType string, payload []byte) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	partHeader := make(textproto.MIMEHeader)
	partHeader.Set("Content-Disposition", `form-data; name="`+field+`"; filename="`+filename+`"`)
	partHeader.Set("Content-Type", contentType)
	part, err := writer.CreatePart(partHeader)
	require.NoError(t, err)
	_, err = part.Write(payload)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/temp-media/images", &body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request.Header.Set("Accept-Language", "en")
	return ctx, recorder
}
