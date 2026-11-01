package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestPartnerServerRoutesIgnoreEngineCORS(t *testing.T) {
	previousRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedis })
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetPartnerServerRouter(engine)
	// Mirrors SetRouter: the relay router adds engine-wide CORS afterwards.
	engine.Use(middleware.CORS())
	engine.GET("/v1/models", func(c *gin.Context) { c.Status(http.StatusOK) })

	preflight := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodOptions, path, nil)
		req.Header.Set("Origin", "https://evil.example")
		req.Header.Set("Access-Control-Request-Method", "POST")
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		return rec
	}
	partner := preflight("/api/partner/v1/accounts/x/credential")
	assert.Equal(t, http.StatusForbidden, partner.Code)
	assert.Empty(t, partner.Header().Get("Access-Control-Allow-Origin"))

	relay := preflight("/v1/models")
	assert.NotEqual(t, http.StatusForbidden, relay.Code, "routes registered after CORS keep answering preflight")
	assert.Equal(t, "*", relay.Header().Get("Access-Control-Allow-Origin"))
}
