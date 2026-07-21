package middleware

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetModelRequestReadsBothMultipartImageEditAliases(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, path := range []string{"/v1/images/edits", "/v1/edits"} {
		t.Run(path, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			require.NoError(t, writer.WriteField("model", "gpt-image-1"))
			require.NoError(t, writer.WriteField("prompt", "restyle"))
			require.NoError(t, writer.WriteField("n", "2"))
			require.NoError(t, writer.WriteField("async", "true"))
			require.NoError(t, writer.WriteField("output_format", "png"))
			part, err := writer.CreateFormFile("image", "source.png")
			require.NoError(t, err)
			_, err = part.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'})
			require.NoError(t, err)
			require.NoError(t, writer.Close())

			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, path, &body)
			c.Request.Header.Set("Content-Type", writer.FormDataContentType())
			defer common.CleanupBodyStorage(c)

			modelRequest, shouldSelect, err := getModelRequest(c)
			require.NoError(t, err)
			require.NotNil(t, modelRequest)
			assert.True(t, shouldSelect)
			assert.Equal(t, "gpt-image-1", modelRequest.Model)

			requirement, err := getImageSelectionRequirement(c, modelRequest.Model)
			require.NoError(t, err)
			require.NotNil(t, requirement)
			assert.Equal(t, uint(2), requirement.N)
			assert.Equal(t, "png", requirement.OutputFormat)
			validated, exists := common.GetContextKeyType[*dto.ImageRequest](c, constant.ContextKeyValidatedImageRequest)
			require.True(t, exists)
			require.NotNil(t, validated)
			require.NotNil(t, validated.Async)
			assert.True(t, *validated.Async)
		})
	}
}

func TestImageSelectionReusesValidatedJSONDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(`{"model":"dall-e-3","prompt":"draw"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	defer common.CleanupBodyStorage(c)

	modelRequest, shouldSelect, err := getModelRequest(c)
	require.NoError(t, err)
	assert.True(t, shouldSelect)
	requirement, err := getImageSelectionRequirement(c, modelRequest.Model)
	require.NoError(t, err)
	require.NotNil(t, requirement)
	assert.Equal(t, "1024x1024", requirement.Size)
	assert.Equal(t, "standard", requirement.Quality)
	assert.Equal(t, uint(1), requirement.N)

	validated, exists := common.GetContextKeyType[*dto.ImageRequest](c, constant.ContextKeyValidatedImageRequest)
	require.True(t, exists)
	require.NotNil(t, validated)
	assert.Equal(t, "1024x1024", validated.Size)
	assert.Equal(t, "standard", validated.Quality)
	require.NotNil(t, validated.N)
	assert.Equal(t, uint(1), *validated.N)
}

func TestUnifiedImageSelectionUsesEditOperationForReferenceInput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(`{
		"model":"gpt-image-2",
		"input":{"prompt":"restyle","image_input":["https://example.com/source.png"]}
	}`))
	c.Request.Header.Set("Content-Type", "application/json")
	defer common.CleanupBodyStorage(c)

	modelRequest, shouldSelect, err := getModelRequest(c)
	require.NoError(t, err)
	assert.True(t, shouldSelect)
	requirement, err := getImageSelectionRequirement(c, modelRequest.Model)
	require.NoError(t, err)
	require.NotNil(t, requirement)
	assert.Equal(t, dto.ImageOperationEdit, requirement.Operation)
}
