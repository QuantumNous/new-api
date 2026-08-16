package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/origin"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestDistributorDefersOriginRouteSelectionUntilAdmission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	restore := origin.ConfigureForTest(true, nil)
	t.Cleanup(restore)

	router := gin.New()
	router.POST("/v1/responses", TokenAuth(), Distribute(), func(c *gin.Context) {
		assert.Equal(t, "origin-codex", c.GetString("original_model"))
		assert.Zero(t, c.GetInt("channel_id"))
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"origin-codex","input":"hello"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+originAuthTestKey)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusNoContent, response.Code)
}
