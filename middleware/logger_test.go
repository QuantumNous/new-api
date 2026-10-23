package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetUpLoggerMasksQueryCredentials(t *testing.T) {
	previousMode, previousWriter := gin.Mode(), gin.DefaultWriter
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() {
		gin.SetMode(previousMode)
		gin.DefaultWriter = previousWriter
	})

	for _, tc := range []struct{ target, loggedPath string }{
		{"/v1/models?%6bey=first&key=second&API-Key=third&session_token=fourth&alt=sse",
			"/v1/models?API-Key=%2A%2A%2Amasked%2A%2A%2A&alt=sse&key=%2A%2A%2Amasked%2A%2A%2A&session_token=%2A%2A%2Amasked%2A%2A%2A"},
		{"/v1/models%23test%25?key=#secret&alt=#sse",
			"/v1/models%23test%25?alt=%23sse&key=%2A%2A%2Amasked%2A%2A%2A"},
		{"//v1%2Fmodels?key=secret", "//v1%2Fmodels?key=%2A%2A%2Amasked%2A%2A%2A"},
		{"/v1/models?key=bad%ZZ&%ZZ=bad&token=bad;other=true&alt=sse", "/v1/models?alt=sse"},
		{"/v1/models?key=bad%ZZ", "/v1/models?"},
		{"/v1/models?alt=sse&api-version=2024-02-01", "/v1/models?alt=sse&api-version=2024-02-01"},
		{"/v1/models", "/v1/models"},
		{"/%61pi/oauth/test?code=secret&state=secret", "/api/oauth/test"},
	} {
		t.Run(tc.target, func(t *testing.T) {
			var output bytes.Buffer
			gin.DefaultWriter = &output
			router := gin.New()
			SetUpLogger(router)
			request := httptest.NewRequest(http.MethodGet, tc.target, nil)
			originalURL := *request.URL
			router.NoRoute(func(c *gin.Context) {
				assert.Equal(t, originalURL, *c.Request.URL)
				assert.Equal(t, tc.target, c.Request.RequestURI)
				c.Status(http.StatusUnauthorized)
			})
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			require.Equal(t, http.StatusUnauthorized, response.Code)
			_, loggedPath, found := strings.Cut(strings.TrimSuffix(output.String(), "\n"), "GET ")
			require.True(t, found)
			assert.Equal(t, tc.loggedPath, loggedPath)
			assert.Equal(t, originalURL, *request.URL)
			assert.Equal(t, tc.target, request.RequestURI)
		})
	}
}
