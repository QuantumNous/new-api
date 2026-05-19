package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestLimitChannelTypesStoresAllowedTypes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(LimitChannelTypes(constant.ChannelTypeAws))
	router.GET("/test", func(c *gin.Context) {
		require.True(t, service.IsChannelTypeAllowed(constant.ChannelTypeAws, service.GetAllowedChannelTypes(c)))
		require.False(t, service.IsChannelTypeAllowed(constant.ChannelTypeOpenAI, service.GetAllowedChannelTypes(c)))
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code)
}
