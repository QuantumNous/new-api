package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
)

func TestDesktopConnectServesSPAShell(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	index := []byte(`<!doctype html><html><body><div id="root"></div></body></html>`)
	engine.GET("/desktop/connect", middleware.DisableCache(), func(c *gin.Context) {
		controller.ServeDesktopConnectSPA(c, index)
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/desktop/connect?auto=1", nil)
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "text/html")
	assert.Contains(t, rec.Body.String(), `id="root"`)
	assert.NotContains(t, rec.Body.String(), "data-yeschoy-connect")
	assert.NotContains(t, rec.Body.String(), "/connect.js")
}
