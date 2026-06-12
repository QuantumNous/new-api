package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestIsReadOnlyAdminAllowed(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name    string
		method  string
		path    string
		allowed bool
	}{
		{name: "allows ordinary get", method: http.MethodGet, path: "/api/user/self", allowed: true},
		{name: "allows admin list get", method: http.MethodGet, path: "/api/user/?p=0", allowed: true},
		{name: "allows head", method: http.MethodHead, path: "/api/user/self", allowed: true},
		{name: "allows options", method: http.MethodOptions, path: "/api/user/self", allowed: true},
		{name: "blocks post", method: http.MethodPost, path: "/api/user/", allowed: false},
		{name: "blocks put", method: http.MethodPut, path: "/api/user/", allowed: false},
		{name: "blocks delete", method: http.MethodDelete, path: "/api/user/1", allowed: false},
		{name: "blocks status test get", method: http.MethodGet, path: "/api/status/test", allowed: false},
		{name: "blocks channel test get", method: http.MethodGet, path: "/api/channel/test/1", allowed: false},
		{name: "blocks fetch models get", method: http.MethodGet, path: "/api/channel/fetch_models/1", allowed: false},
		{name: "blocks update balance get", method: http.MethodGet, path: "/api/channel/update_balance/1", allowed: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(tt.method, tt.path, nil)

			if got := isReadOnlyAdminAllowed(c); got != tt.allowed {
				t.Fatalf("isReadOnlyAdminAllowed() = %v, want %v", got, tt.allowed)
			}
		})
	}
}
