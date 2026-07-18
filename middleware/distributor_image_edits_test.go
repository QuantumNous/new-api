package middleware

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"

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
		})
	}
}
