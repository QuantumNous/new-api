package palm

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPalmStreamHandlerPreservesErrorStatus verifies HTTP 200 business errors
// become 502 while genuine upstream failures retain their retry status.
func TestPalmStreamHandlerPreservesErrorStatus(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		wantStatus int
	}{
		{name: "business error in HTTP 200", statusCode: http.StatusOK, wantStatus: http.StatusBadGateway},
		{name: "upstream rate limit", statusCode: http.StatusTooManyRequests, wantStatus: http.StatusTooManyRequests},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			resp := &http.Response{
				StatusCode: tt.statusCode,
				Body: io.NopCloser(strings.NewReader(
					`{"error":{"code":8,"message":"upstream busy","status":"RESOURCE_EXHAUSTED"}}`,
				)),
			}

			apiErr, responseText := palmStreamHandler(c, resp)

			require.NotNil(t, apiErr)
			assert.Equal(t, tt.wantStatus, apiErr.StatusCode)
			assert.Equal(t, "upstream busy", apiErr.Error())
			assert.Empty(t, responseText)
		})
	}
}
