package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlaygroundGroupMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())

	tests := []struct {
		name               string
		path               string
		initialUsingGroup  string
		expectedStatus     int
		expectedUsingGroup string
		expectedRawQuery   string
	}{
		{
			name:               "ignores non-pg path",
			path:               "/v1/images/generations?pg_group=vip",
			initialUsingGroup:  "default",
			expectedStatus:     http.StatusOK,
			expectedUsingGroup: "default",
			expectedRawQuery:   "pg_group=vip",
		},
		{
			name:               "no pg_group parameter leaves context untouched",
			path:               "/pg/images/generations",
			initialUsingGroup:  "default",
			expectedStatus:     http.StatusOK,
			expectedUsingGroup: "default",
			expectedRawQuery:   "",
		},
		{
			name:               "valid group sets context and removes param",
			path:               "/pg/images/generations?pg_group=default&other=1",
			initialUsingGroup:  "default",
			expectedStatus:     http.StatusOK,
			expectedUsingGroup: "default",
			expectedRawQuery:   "other=1",
		},
		{
			name:               "group access denied aborts with 403",
			path:               "/pg/images/generations?pg_group=unauthorized_group",
			initialUsingGroup:  "default",
			expectedStatus:     http.StatusForbidden,
			expectedUsingGroup: "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, r := gin.CreateTestContext(w)

			r.Use(func(ctx *gin.Context) {
				if tt.initialUsingGroup != "" {
					common.SetContextKey(ctx, constant.ContextKeyUsingGroup, tt.initialUsingGroup)
				}
				ctx.Next()
			})
			r.Use(PlaygroundGroup())
			r.Any("/*any", func(ctx *gin.Context) {
				ctx.Status(http.StatusOK)
			})

			req, _ := http.NewRequest(http.MethodPost, tt.path, nil)
			c.Request = req
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.expectedStatus == http.StatusOK {
				if tt.expectedRawQuery != "" {
					assert.Equal(t, tt.expectedRawQuery, req.URL.RawQuery)
				} else if tt.path == "/pg/images/generations" {
					assert.Empty(t, req.URL.RawQuery)
				}
			}
		})
	}
}
