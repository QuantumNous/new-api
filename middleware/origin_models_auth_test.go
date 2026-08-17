package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/origin"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenAuthAllowsOriginKeyForModelDiscoveryOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	restore := origin.ConfigureForTest(true, nil)
	t.Cleanup(restore)

	router := gin.New()
	router.GET("/v1/models", TokenAuth(), func(c *gin.Context) {
		key, ok := origin.Credential(c)
		require.True(t, ok)
		assert.Equal(t, originAuthTestKey, key)
		assert.Empty(t, c.Request.Header.Get("Authorization"))
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	request.Header.Set("Authorization", "Bearer "+originAuthTestKey)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusNoContent, response.Code)
	assert.NotEmpty(t, response.Header().Get("X-Request-Id"))
}

func TestTokenAuthRejectsAndScrubsOriginKeyFromAlternativeModelCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name   string
		path   string
		header string
		value  string
	}{
		{name: "anthropic header", path: "/v1/models", header: "x-api-key", value: originAuthTestKey},
		{name: "gemini header", path: "/v1/models", header: "x-goog-api-key", value: originAuthTestKey},
		{name: "query", path: "/v1/models?key=" + originAuthTestKey},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			restore := origin.ConfigureForTest(true, nil)
			defer restore()
			router := gin.New()
			router.GET("/v1/models", TokenAuth(), func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			if test.header != "" {
				request.Header.Set(test.header, test.value)
			}
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			assert.Equal(t, http.StatusUnauthorized, response.Code)
			assert.Empty(t, request.Header.Get(test.header))
			assert.NotContains(t, request.URL.RawQuery, "sk-oa-")
			assert.NotContains(t, response.Body.String(), "sk-oa-")
		})
	}
}
