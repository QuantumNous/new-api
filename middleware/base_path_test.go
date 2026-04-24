package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestStripAppBasePathForRelayStylePaths(t *testing.T) {
	original := common.AppBasePath
	common.AppBasePath = "/app"
	t.Cleanup(func() {
		common.AppBasePath = original
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	group := engine.Group(common.AppBasePath)
	group.Use(StripAppBasePath())

	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "openai relay", path: "/app/v1/chat/completions?stream=true", want: "/v1/chat/completions"},
		{name: "playground relay", path: "/app/pg/chat/completions", want: "/pg/chat/completions"},
		{name: "gemini relay", path: "/app/v1beta/models/gemini-pro:generateContent", want: "/v1beta/models/gemini-pro:generateContent"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			group.Any(tt.want, func(c *gin.Context) {
				if got := c.Request.URL.Path; got != tt.want {
					t.Fatalf("URL.Path = %q, want %q", got, tt.want)
				}
				if got := c.GetString(OriginalRequestPathKey); got != requestPathOnly(tt.path) {
					t.Fatalf("original path = %q, want %q", got, requestPathOnly(tt.path))
				}
				if tt.name == "openai relay" && c.Request.RequestURI != "/v1/chat/completions?stream=true" {
					t.Fatalf("RequestURI = %q, want stripped URI with query", c.Request.RequestURI)
				}
				c.Status(http.StatusNoContent)
			})

			req := httptest.NewRequest(http.MethodPost, tt.path, nil)
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, req)
			if recorder.Code != http.StatusNoContent {
				t.Fatalf("%s status = %d, want %d", tt.path, recorder.Code, http.StatusNoContent)
			}
		})
	}
}

func requestPathOnly(target string) string {
	for i, ch := range target {
		if ch == '?' {
			return target[:i]
		}
	}
	return target
}
