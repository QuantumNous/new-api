package router

import (
	"embed"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

//go:embed testdata/web/dist all:testdata/web/landing/out
var webRouterTestFS embed.FS

func TestSetWebRouterUsesLandingNotFoundPage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalRateLimitEnabled := common.GlobalWebRateLimitEnable
	common.GlobalWebRateLimitEnable = false
	t.Cleanup(func() {
		common.GlobalWebRateLimitEnable = originalRateLimitEnabled
	})

	frontendRoot, err := fs.Sub(webRouterTestFS, "testdata/web/dist")
	require.NoError(t, err)
	landingRoot, err := fs.Sub(webRouterTestFS, "testdata/web/landing/out")
	require.NoError(t, err)

	assets := WebAssets{
		BuildFS:             frontendRoot,
		IndexPage:           []byte("dashboard-index"),
		LandingBuildFS:      landingRoot,
		LandingIndexPage:    []byte("landing-index"),
		LandingNotFoundPage: []byte("landing-not-found"),
	}

	tests := []struct {
		name         string
		method       string
		path         string
		status       int
		contentType  string
		body         string
		bodyContains string
	}{
		{
			name:        "dashboard sign-in route",
			path:        "/sign-in",
			status:      http.StatusOK,
			contentType: "text/html; charset=utf-8",
			body:        "dashboard-index",
		},
		{
			name:        "dashboard route with parameter",
			path:        "/dashboard/overview",
			status:      http.StatusOK,
			contentType: "text/html; charset=utf-8",
			body:        "dashboard-index",
		},
		{
			name:        "legacy dashboard route",
			path:        "/console/token",
			status:      http.StatusOK,
			contentType: "text/html; charset=utf-8",
			body:        "dashboard-index",
		},
		{
			name:        "unknown document",
			path:        "/docs/missing",
			status:      http.StatusNotFound,
			contentType: "text/html; charset=utf-8",
			body:        "landing-not-found",
		},
		{
			name:        "unknown nested dashboard route",
			path:        "/dashboard/overview/missing",
			status:      http.StatusNotFound,
			contentType: "text/html; charset=utf-8",
			body:        "landing-not-found",
		},
		{
			name:        "unknown web route",
			path:        "/missing",
			status:      http.StatusNotFound,
			contentType: "text/html; charset=utf-8",
			body:        "landing-not-found",
		},
		{
			name:         "unknown API route remains JSON",
			path:         "/api/missing",
			status:       http.StatusNotFound,
			contentType:  "application/json; charset=utf-8",
			bodyContains: `"type":"invalid_request_error"`,
		},
		{
			name:         "unknown v1beta API route remains JSON",
			path:         "/v1beta/missing",
			status:       http.StatusNotFound,
			contentType:  "application/json; charset=utf-8",
			bodyContains: `"type":"invalid_request_error"`,
		},
		{
			name:        "landing supports HEAD",
			method:      http.MethodHead,
			path:        "/",
			status:      http.StatusOK,
			contentType: "text/html; charset=utf-8",
		},
		{
			name:        "docs supports HEAD",
			method:      http.MethodHead,
			path:        "/docs",
			status:      http.StatusOK,
			contentType: "text/html; charset=utf-8",
		},
		{
			name:        "Next static asset is embedded",
			path:        "/_next/static/app.js",
			status:      http.StatusOK,
			contentType: "text/javascript; charset=utf-8",
			body:        "next fixture\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			engine := gin.New()
			SetWebRouter(engine, assets)
			method := tt.method
			if method == "" {
				method = http.MethodGet
			}
			request := httptest.NewRequest(method, tt.path, nil)
			response := httptest.NewRecorder()

			engine.ServeHTTP(response, request)

			assert.Equal(t, tt.status, response.Code)
			assert.Equal(t, tt.contentType, response.Header().Get("Content-Type"))
			if tt.body != "" {
				require.Equal(t, tt.body, response.Body.String())
			}
			if tt.bodyContains != "" {
				assert.Contains(t, response.Body.String(), tt.bodyContains)
			}
		})
	}
}
