package controller

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReplayAsyncImageGenerationPreservesMultipartEditBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, path := range []string{"/v1/images/edits", "/v1/edits"} {
		t.Run(path, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			require.NoError(t, writer.WriteField("model", "gpt-image-1"))
			require.NoError(t, writer.WriteField("prompt", "restyle this image"))
			require.NoError(t, writer.WriteField("async", "true"))
			part, err := writer.CreateFormFile("image", "source.png")
			require.NoError(t, err)
			_, err = part.Write([]byte("image-payload"))
			require.NoError(t, err)
			require.NoError(t, writer.Close())

			engine := gin.New()
			engine.Use(middleware.BodyStorageCleanup())
			engine.POST(path, ReplayAsyncImageGeneration, func(c *gin.Context) {
				assert.Nil(t, c.Request.MultipartForm)
				form, parseErr := common.ParseMultipartFormReusable(c)
				require.NoError(t, parseErr)
				assert.Equal(t, "true", form.Value["async"][0])
				files := form.File["image"]
				require.Len(t, files, 1)
				file, openErr := files[0].Open()
				require.NoError(t, openErr)
				defer file.Close()
				payload, readErr := io.ReadAll(file)
				require.NoError(t, readErr)
				assert.Equal(t, []byte("image-payload"), payload)
				c.Status(http.StatusNoContent)
			})

			request := httptest.NewRequest(http.MethodPost, path, &body)
			request.Header.Set("Content-Type", writer.FormDataContentType())
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)
			assert.Equal(t, http.StatusNoContent, recorder.Code)
		})
	}
}

func TestAsyncImageEditIdentityRequestIncludesAllIdempotencyFields(t *testing.T) {
	request := asyncImageEditIdentityRequest(map[string][]string{
		"model":              {"gpt-image-2-image-to-image"},
		"prompt":             {"restyle"},
		"n":                  {"2"},
		"size":               {"1024x1024"},
		"quality":            {"high"},
		"response_format":    {"url"},
		"output_format":      {"png"},
		"output_compression": {"80"},
		"partial_images":     {"1"},
		"background":         {"transparent"},
		"input_fidelity":     {"high"},
		"stream":             {"false"},
	})

	require.NotNil(t, request.N)
	assert.Equal(t, uint(2), *request.N)
	assert.Equal(t, "1024x1024", request.Size)
	assert.Equal(t, "high", request.Quality)
	assert.Equal(t, "url", request.ResponseFormat)
	assert.JSONEq(t, `"png"`, string(request.OutputFormat))
	assert.JSONEq(t, `80`, string(request.OutputCompression))
	assert.JSONEq(t, `1`, string(request.PartialImages))
	assert.JSONEq(t, `"transparent"`, string(request.Background))
	assert.JSONEq(t, `"high"`, string(request.InputFidelity))
	require.NotNil(t, request.Stream)
	assert.False(t, *request.Stream)
}
