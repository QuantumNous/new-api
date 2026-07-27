package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSeedanceRequestConvertSubmit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(SeedanceRequestConvert())
	router.POST("/seedance/api/v3/contents/generations/tasks", func(c *gin.Context) {
		require.True(t, c.GetBool(common.KeySeedanceOfficialAPI))
		require.Equal(t, "/v1/video/generations", c.Request.URL.Path)
		require.Equal(t, relayconstant.RelayModeVideoSubmit, c.GetInt("relay_mode"))
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodPost, "/seedance/api/v3/contents/generations/tasks", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestSeedanceRequestConvertFetchByID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(SeedanceRequestConvert())
	router.GET("/seedance/api/v3/contents/generations/tasks/:task_id", func(c *gin.Context) {
		require.True(t, c.GetBool(common.KeySeedanceOfficialAPI))
		require.Equal(t, "/seedance/api/v3/contents/generations/tasks/task_public", c.Request.URL.Path)
		require.Equal(t, "task_public", c.Param("task_id"))
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/seedance/api/v3/contents/generations/tasks/task_public", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestSeedanceRequestConvertFetchList(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(SeedanceRequestConvert())
	router.GET("/seedance/api/v3/contents/generations/tasks", func(c *gin.Context) {
		require.True(t, c.GetBool(common.KeySeedanceOfficialAPI))
		require.Equal(t, "/seedance/api/v3/contents/generations/tasks", c.Request.URL.Path)
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/seedance/api/v3/contents/generations/tasks", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusNoContent, recorder.Code)
}
