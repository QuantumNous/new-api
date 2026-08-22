package middleware

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestGetTurnstileTokenPrefersHeaderAndKeepsQueryCompatibility(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name   string
		header string
		query  string
		want   string
	}{
		{name: "header", header: " header-token ", query: "query-token", want: "header-token"},
		{name: "query fallback", query: " query-token ", want: "query-token"},
		{name: "oversized token", header: string(make([]byte, turnstileTokenMaxLength+1)), want: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			request := httptest.NewRequest(http.MethodPost, "/?turnstile="+url.QueryEscape(test.query), nil)
			request.Header.Set("X-Turnstile-Token", test.header)
			context.Request = request
			assert.Equal(t, test.want, getTurnstileToken(context))
		})
	}
}
