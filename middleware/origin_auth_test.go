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

const originAuthTestKey = "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd"

func TestTokenAuthKeepsCompleteOriginKeyAndRemovesAuthorizationHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	restore := origin.ConfigureForTest(true, nil)
	t.Cleanup(restore)

	router := gin.New()
	var handledContext *gin.Context
	router.POST("/v1/responses", TokenAuth(), func(c *gin.Context) {
		handledContext = c
		key, ok := origin.Credential(c)
		require.True(t, ok)
		assert.Equal(t, originAuthTestKey, key)
		assert.Empty(t, c.Request.Header.Get("Authorization"))
		assert.Empty(t, c.GetString("token_key"))
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	request.Header.Set("Authorization", "Bearer "+originAuthTestKey)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusNoContent, response.Code)
	requestID := response.Header().Get("X-Request-Id")
	assert.NotEmpty(t, requestID)
	assert.Equal(t, requestID, response.Header().Get("X-Oneapi-Request-Id"))
	require.NotNil(t, handledContext)
	_, credentialRetained := origin.Credential(handledContext)
	assert.False(t, credentialRetained)
}

func TestTokenAuthRejectsMalformedOriginKeyWithoutDatabaseLookup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	restore := origin.ConfigureForTest(true, nil)
	t.Cleanup(restore)

	router := gin.New()
	router.POST("/v1/responses", TokenAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	request.Header.Set("Authorization", "Bearer sk-oa-")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.NotContains(t, response.Body.String(), "sk-oa-")
}

func TestTokenAuthRejectsOriginKeyContainingWhitespace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	restore := origin.ConfigureForTest(true, nil)
	t.Cleanup(restore)

	router := gin.New()
	router.POST("/v1/responses", TokenAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	request.Header.Set("Authorization", "Bearer sk-oa-malformed key")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.NotContains(t, response.Body.String(), "sk-oa-malformed")
}

func TestTokenAuthRejectsOriginKeyOutsideResponsesEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	restore := origin.ConfigureForTest(true, nil)
	t.Cleanup(restore)

	router := gin.New()
	router.POST("/v1/chat/completions", TokenAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	request.Header.Set("Authorization", "Bearer "+originAuthTestKey)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusForbidden, response.Code)
}
