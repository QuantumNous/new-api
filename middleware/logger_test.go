package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSetUpLoggerRedactsQueryCredentialsWithoutChangingRequest verifies log masking and request preservation.
func TestSetUpLoggerRedactsQueryCredentialsWithoutChangingRequest(t *testing.T) {
	previousMode, previousWriter := gin.Mode(), gin.DefaultWriter
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() {
		gin.SetMode(previousMode)
		gin.DefaultWriter = previousWriter
	})

	for _, tc := range []struct {
		name       string
		method     string
		target     string
		status     int
		loggedPath string
		secrets    []string
	}{
		{
			name: "Gemini success", method: http.MethodPost, status: http.StatusOK,
			target:     "/v1beta/models/gemini-test:generateContent?key=gemini-secret&alt=sse",
			loggedPath: "/v1beta/models/gemini-test:generateContent?alt=sse&key=%2A%2A%2Amasked%2A%2A%2A",
			secrets:    []string{"gemini-secret"},
		},
		{
			name: "rejected request with repeated and encoded keys", method: http.MethodPost, status: http.StatusUnauthorized,
			target:     "/v1beta/models/gemini-test:generateContent?%6bey=first-secret&key=second-secret&alt=sse",
			loggedPath: "/v1beta/models/gemini-test:generateContent?alt=sse&key=%2A%2A%2Amasked%2A%2A%2A",
			secrets:    []string{"first-secret", "second-secret"},
		},
		{
			name: "model directory", method: http.MethodGet, status: http.StatusOK,
			target:     "/v1/models?key=directory-secret",
			loggedPath: "/v1/models?key=%2A%2A%2Amasked%2A%2A%2A",
			secrets:    []string{"directory-secret"},
		},
		{
			name: "escaped path is not parsed as a fragment", method: http.MethodPost, status: http.StatusUnauthorized,
			target:     "/v1beta/models/gemini%23test:generateContent?key=fragment-secret",
			loggedPath: "/v1beta/models/gemini%23test:generateContent?key=%2A%2A%2Amasked%2A%2A%2A",
			secrets:    []string{"fragment-secret"},
		},
		{
			name: "escaped percent does not bypass redaction", method: http.MethodPost, status: http.StatusUnauthorized,
			target:     "/v1beta/models/gemini%25test:generateContent?key=percent-secret",
			loggedPath: "/v1beta/models/gemini%25test:generateContent?key=%2A%2A%2Amasked%2A%2A%2A",
			secrets:    []string{"percent-secret"},
		},
		{
			name: "literal hash in credential stays in the query", method: http.MethodGet, status: http.StatusUnauthorized,
			target:     "/v1/models?key=#hash-secret",
			loggedPath: "/v1/models?key=%2A%2A%2Amasked%2A%2A%2A",
			secrets:    []string{"hash-secret"},
		},
		{
			name: "literal hash before credential stays in the query", method: http.MethodGet, status: http.StatusUnauthorized,
			target:     "/v1/models?alt=#sse&key=after-hash-secret",
			loggedPath: "/v1/models?alt=%23sse&key=%2A%2A%2Amasked%2A%2A%2A",
			secrets:    []string{"after-hash-secret"},
		},
		{
			name: "malformed credential value omits the logged query", method: http.MethodGet, status: http.StatusUnauthorized,
			target:     "/v1/models?key=malformed-secret%ZZ&alt=sse",
			loggedPath: "/v1/models",
			secrets:    []string{"malformed-secret"},
		},
		{
			name: "malformed query key omits the logged query", method: http.MethodGet, status: http.StatusUnauthorized,
			target:     "/v1/models?%ZZ=malformed-key-secret",
			loggedPath: "/v1/models",
			secrets:    []string{"malformed-key-secret"},
		},
		{
			name: "invalid semicolon omits the logged query", method: http.MethodGet, status: http.StatusUnauthorized,
			target:     "/v1/models?key=semicolon-secret;ignored=true",
			loggedPath: "/v1/models",
			secrets:    []string{"semicolon-secret"},
		},
		{
			name: "ordinary query unchanged", method: http.MethodGet, status: http.StatusOK,
			target:     "/v1/models?alt=sse&api-version=2024-02-01",
			loggedPath: "/v1/models?alt=sse&api-version=2024-02-01",
		},
		{
			name: "OAuth query still omitted", method: http.MethodGet, status: http.StatusOK,
			target:     "/api/oauth/test?code=oauth-code&state=oauth-state",
			loggedPath: "/api/oauth/test",
			secrets:    []string{"oauth-code", "oauth-state"},
		},
		{
			name: "encoded OAuth path still omitted", method: http.MethodGet, status: http.StatusOK,
			target:     "/%61pi/oauth/test?code=encoded-oauth-code&state=encoded-oauth-state",
			loggedPath: "/api/oauth/test",
			secrets:    []string{"encoded-oauth-code", "encoded-oauth-state"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var output bytes.Buffer
			gin.DefaultWriter = &output
			router := gin.New()
			SetUpLogger(router)
			request := httptest.NewRequest(tc.method, tc.target, nil)
			originalQuery := request.URL.RawQuery
			handled := false
			router.Use(RouteTag("relay"))
			router.NoRoute(func(c *gin.Context) {
				handled = true
				assert.Equal(t, originalQuery, c.Request.URL.RawQuery, "credentials must remain available to authentication")
				assert.Equal(t, tc.target, c.Request.RequestURI)
				c.Set(common.RequestIdKey, "request-id-test")
				c.Status(tc.status)
			})
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			require.True(t, handled)
			assert.Equal(t, tc.status, response.Code)
			line := strings.TrimSpace(output.String())
			assert.Contains(t, line, "| relay | request-id-test |")
			assert.True(t, strings.HasSuffix(line, tc.method+" "+tc.loggedPath), line)
			for _, secret := range tc.secrets {
				assert.NotContains(t, line, secret)
			}
		})
	}
}
