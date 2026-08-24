package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRunDataToolRejectsSessionWithoutAPIKeyContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.POST("/api/data-tools/run", func(c *gin.Context) {
		// Simulate a valid dashboard session. The absence of token_id must still
		// prevent execution before the request reaches billing or VOC.
		c.Set("id", 42)
		RunDataTool(c)
	})

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/data-tools/run",
		strings.NewReader(`{"id":"provider.tool","input":{}}`),
	)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Idempotency-Key", "session-only")
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	require.Equal(t, http.StatusUnauthorized, response.Code)
	require.JSONEq(t,
		`{"success":false,"message":"a Flatkey API key is required to run data tools"}`,
		response.Body.String(),
	)
}
