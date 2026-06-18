package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestAutoGroupForRequestPath(t *testing.T) {
	tests := []struct {
		name            string
		usingGroup      string
		requestPath     string
		expectedGroup   string
		expectedChanged bool
	}{
		{
			name:            "routes chat completions",
			usingGroup:      "auto",
			requestPath:     "/v1/chat/completions",
			expectedGroup:   "codex-completions",
			expectedChanged: true,
		},
		{
			name:          "keeps responses auto",
			usingGroup:    "auto",
			requestPath:   "/v1/responses",
			expectedGroup: "auto",
		},
		{
			name:          "keeps explicit group",
			usingGroup:    "codex",
			requestPath:   "/v1/chat/completions",
			expectedGroup: "codex",
		},
		{
			name:          "ignores embedded chat completions fragment",
			usingGroup:    "auto",
			requestPath:   "/proxy/v1/chat/completions",
			expectedGroup: "auto",
		},
		{
			name:          "ignores similar chat completions prefix",
			usingGroup:    "auto",
			requestPath:   "/v1/chat/completions-extra",
			expectedGroup: "auto",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := autoGroupForRequestPath(tt.usingGroup, tt.requestPath)

			assert.Equal(t, tt.expectedGroup, got)
			assert.Equal(t, tt.expectedChanged, changed)
		})
	}
}

func TestRouteAutoGroupForRequestPathUpdatesRetryTokenGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "auto")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "auto")

	routedGroup := routeAutoGroupForRequestPath(c, "auto")

	assert.Equal(t, "codex-completions", routedGroup)
	assert.Equal(t, "codex-completions", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
	assert.Equal(t, "codex-completions", common.GetContextKeyString(c, constant.ContextKeyTokenGroup))
}

func TestRouteAutoGroupForRequestPathKeepsResponsesRetryAuto(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "auto")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "auto")

	routedGroup := routeAutoGroupForRequestPath(c, "auto")

	assert.Equal(t, "auto", routedGroup)
	assert.Equal(t, "auto", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
	assert.Equal(t, "auto", common.GetContextKeyString(c, constant.ContextKeyTokenGroup))
	assert.Equal(t, []string{"codex", "codex-pro"}, common.GetContextKeyStringSlice(c, constant.ContextKeyRouteAutoGroups))
}
