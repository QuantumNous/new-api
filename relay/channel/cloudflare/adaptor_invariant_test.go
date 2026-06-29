package cloudflare

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertAudioRequest_MemoryBoundary(t *testing.T) {
	payloads := []struct {
		name        string
		contentSize int
		expectError bool
	}{
		// Small file well under the 25 MB limit — must succeed with full content
		{"valid_small", len("small audio data"), false},
		// 10 MB file under the limit — must succeed with full content
		{"boundary_medium", 10 * 1024 * 1024, false},
		// 100 MB file over the 25 MB limit — must be rejected with an error
		{"exploit_large", 100 * 1024 * 1024, true},
	}

	for _, tc := range payloads {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			content := make([]byte, tc.contentSize)

			// Setup gin context with multipart form
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)
			part, err := writer.CreateFormFile("file", "audio.mp3")
			require.NoError(t, err)

			_, err = part.Write(content)
			require.NoError(t, err)
			writer.Close()

			req := httptest.NewRequest("POST", "/", body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			// Initialize adaptor and call production function
			adaptor := &Adaptor{}
			info := &relaycommon.RelayInfo{}
			audioReq := dto.AudioRequest{}

			reader, err := adaptor.ConvertAudioRequest(c, info, audioReq)

			if tc.expectError {
				// Security invariant: oversized uploads must be rejected, not silently accepted
				assert.Error(t, err, "upload exceeding %d MB must be rejected", maxAudioFileSize/(1024*1024))
				assert.Nil(t, reader)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, reader)

			// Verify full content was preserved for valid uploads
			result, err := io.ReadAll(reader)
			require.NoError(t, err)
			assert.Equal(t, tc.contentSize, len(result), "result size must equal input size for uploads within the limit")
		})
	}
}
