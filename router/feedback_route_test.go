package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestFeedbackAdminRouteNotShadowed 复刻 api-router.go 中 adminRoute 的真实注册顺序
// （先 /:id，后 feedback 静态路由），验证 review 第①条 P1（"admin 路由被 /:id 吃掉、
// 不可达"）是否成立。gin 的 radix 路由：静态段优先于 :param，且匹配与注册顺序无关，
// 故 /feedback/admin/... 应正确命中各自 handler。
func TestFeedbackAdminRouteNotShadowed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/api/user")

	// 注册顺序刻意与线上一致：参数路由在前，静态 feedback 路由在后
	g.GET("/:id", func(c *gin.Context) { c.String(200, "user:"+c.Param("id")) })
	g.GET("/:id/2fa", func(c *gin.Context) { c.String(200, "2fa:"+c.Param("id")) })
	g.GET("/kyc/admin", func(c *gin.Context) { c.String(200, "kyc") })
	g.GET("/enterprise/admin", func(c *gin.Context) { c.String(200, "ent") })
	g.GET("/feedback/admin/topics", func(c *gin.Context) { c.String(200, "admin-topics") })
	g.GET("/feedback/admin/unread", func(c *gin.Context) { c.String(200, "admin-unread") })
	g.GET("/feedback/admin/images/:imageId", func(c *gin.Context) { c.String(200, "admin-img:"+c.Param("imageId")) })
	g.GET("/feedback/admin/topics/:id", func(c *gin.Context) { c.String(200, "admin-detail:"+c.Param("id")) })

	cases := map[string]string{
		"/api/user/feedback/admin/topics":   "admin-topics",
		"/api/user/feedback/admin/unread":   "admin-unread",
		"/api/user/feedback/admin/topics/5": "admin-detail:5",
		"/api/user/feedback/admin/images/9": "admin-img:9",
		"/api/user/123":                     "user:123", // 参数路由仍正常
	}
	for path, want := range cases {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK || w.Body.String() != want {
			t.Fatalf("GET %s => code=%d body=%q, want %q", path, w.Code, w.Body.String(), want)
		}
	}
}
