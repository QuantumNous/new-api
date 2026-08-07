package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestVideoProxyAuthAllowsPublicTaskCapabilityURL(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/v1/videos/:task_id/content", VideoProxyAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet,
		"/v1/videos/task_0123456789abcdefghijklmnopqrstuv/content", nil)
	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestVideoProxyAuthStillProtectsLegacyTaskIDs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/v1/videos/:task_id/content", VideoProxyAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/videos/upstream-task-id/content", nil)
	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}
