package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestAutoPricingReviewValidatesRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name string
		body string
	}{
		{name: "malformed json", body: `{`},
		{name: "empty models", body: `{"models":[],"action":"approve"}`},
		{name: "invalid action", body: `{"models":["probe-model"],"action":"apply"}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := gin.New()
			router.POST("/review", ReviewAutoPricing)
			request := httptest.NewRequest(http.MethodPost, "/review", strings.NewReader(test.body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, http.StatusBadRequest, response.Code)
			assert.Contains(t, response.Body.String(), `"success":false`)
		})
	}
}

func TestAutoPricingRoutesRequireRootAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("/api/auto_pricing")
	group.Use(middleware.RootAuth())
	group.GET("/status", GetAutoPricingStatus)
	group.GET("/pending", GetAutoPricingPending)
	group.POST("/sync", SyncAutoPricing)
	group.POST("/review", ReviewAutoPricing)

	for _, route := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/auto_pricing/status"},
		{http.MethodGet, "/api/auto_pricing/pending"},
		{http.MethodPost, "/api/auto_pricing/sync"},
		{http.MethodPost, "/api/auto_pricing/review"},
	} {
		request := httptest.NewRequest(route.method, route.path, nil)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		assert.Equal(t, http.StatusUnauthorized, response.Code, route.path)
	}
}
