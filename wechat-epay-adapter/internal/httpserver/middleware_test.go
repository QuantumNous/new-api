package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSecurityMiddlewareAddsHeadersAndRequestID(t *testing.T) {
	router := gin.New()
	require.NoError(t, applySecurityMiddleware(router, SecurityOptions{}))
	router.GET("/", func(context *gin.Context) { context.Status(http.StatusNoContent) })

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Regexp(t, requestIDPattern, recorder.Header().Get(RequestIDHeader))
	assert.Equal(t, "nosniff", recorder.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
}

func TestRequestBodyLimitRejectsOversizedBody(t *testing.T) {
	router := gin.New()
	require.NoError(t, applySecurityMiddleware(router, SecurityOptions{}))
	router.POST("/", func(context *gin.Context) {
		_, err := context.GetRawData()
		if err != nil {
			context.Status(http.StatusRequestEntityTooLarge)
			return
		}
		context.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	body := strings.Repeat("a", int(MaxRequestBodyBytes)+1)
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
	assert.Equal(t, http.StatusRequestEntityTooLarge, recorder.Code)
}

func TestMinimalErrorPageDoesNotExposeDetail(t *testing.T) {
	page := MinimalErrorPage(http.StatusBadRequest)
	assert.Contains(t, page, "Request unavailable")
	assert.NotContains(t, page, "secret")
	assert.NotContains(t, page, "stack")
}
