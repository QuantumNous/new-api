package dto

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestGeminiChatRequest_IsStream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name     string
		path     string
		query    string
		expected bool
	}{
		{
			name:     "streamGenerateContent without alt=sse",
			path:     "/v1beta/models/gemini-2.0-flash:streamGenerateContent",
			query:    "key=sk-xxx",
			expected: true,
		},
		{
			name:     "streamGenerateContent with alt=sse",
			path:     "/v1beta/models/gemini-2.0-flash:streamGenerateContent",
			query:    "alt=sse&key=sk-xxx",
			expected: true,
		},
		{
			name:     "generateContent without alt=sse",
			path:     "/v1beta/models/gemini-2.0-flash:generateContent",
			query:    "key=sk-xxx",
			expected: false,
		},
		{
			name:     "generateContent with alt=sse",
			path:     "/v1beta/models/gemini-2.0-flash:generateContent",
			query:    "alt=sse",
			expected: true,
		},
		{
			name:     "GenerateContent capitalized",
			path:     "/v1beta/models/gemini-2.0-flash:GenerateContent",
			query:    "key=sk-xxx",
			expected: false,
		},
		{
			name:     "embedding path",
			path:     "/v1beta/models/gemini-2.0-flash:embedContent",
			query:    "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			url := tt.path
			if tt.query != "" {
				url += "?" + tt.query
			}
			c.Request, _ = http.NewRequest("POST", url, nil)

			req := &GeminiChatRequest{}
			assert.Equal(t, tt.expected, req.IsStream(c))
		})
	}
}
