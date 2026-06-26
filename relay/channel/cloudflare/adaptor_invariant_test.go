package cloudflare

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"your-module-path/relay/channel/cloudflare"
	"your-module-path/relay/common"
	"your-module-path/relay/dto"
)

func TestConvertAudioRequest_MemoryBoundary(t *testing.T) {
	payloads := []struct {
		name    string
		content string
	}{
		{"valid_small", "small audio data"},
		{"boundary_medium", string(make([]byte, 10*1024*1024))}, // 10MB
		{"exploit_large", string(make([]byte, 100*1024*1024))},  // 100MB
	}

	for _, tc := range payloads {
		t.Run(tc.name, func(t *testing.T) {
			// Setup gin context with multipart form
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)
			part, err := writer.CreateFormFile("file", "audio.mp3")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := io.WriteString(part, tc.content); err != nil {
				t.Fatal(err)
			}
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

			// Security property: function must either succeed with bounded memory usage
			// or fail gracefully without exhausting memory
			if err != nil {
				// Acceptable outcome: function rejected input
				return
			}

			// If function succeeded, verify we can read result without memory exhaustion
			result, err := io.ReadAll(reader)
			if err != nil {
				t.Errorf("failed to read result: %v", err)
			}

			// Security invariant: result size must be proportional to input
			if len(result) != len(tc.content) {
				t.Errorf("result size mismatch: got %d, want %d", len(result), len(tc.content))
			}
		})
	}
}