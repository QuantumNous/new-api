package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestHandleWebFallbackRejectsMissingStaticAssets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/static/js/async/stale.js", nil)

	handleWebFallback(context, []byte("<html>current app</html>"))

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	assert.Empty(t, recorder.Body.String())
}

func TestHandleWebFallbackServesIndexForClientRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/system-settings/site/system-info", nil)

	handleWebFallback(context, []byte("<html>current app</html>"))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "no-cache", recorder.Header().Get("Cache-Control"))
	assert.Equal(t, "text/html; charset=utf-8", recorder.Header().Get("Content-Type"))
	assert.Equal(t, "<html>current app</html>", recorder.Body.String())
}
