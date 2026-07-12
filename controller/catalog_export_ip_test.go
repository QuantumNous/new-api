package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// 覆盖 catalog-export IP 白名单语义：
//   - 默认白名单只放行 Roma 生产/测试机;
//   - X-Real-IP 优先(nginx 覆写,不可伪造),XFF 不参与判定;
//   - CATALOG_EXPORT_ALLOWED_IPS 可覆盖;"*" 关闭限制。
func TestCatalogExportIPAllowed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	newCtx := func(realIP string, xff string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodGet, "/api/internal/catalog-export", nil)
		if realIP != "" {
			c.Request.Header.Set("X-Real-IP", realIP)
		}
		if xff != "" {
			c.Request.Header.Set("X-Forwarded-For", xff)
		}
		return c
	}

	// 默认白名单：两台 Roma 机器放行
	require.True(t, catalogExportIPAllowed(newCtx("81.70.201.229", "")))
	require.True(t, catalogExportIPAllowed(newCtx("43.157.212.20", "")))

	// 其它 IP 拒绝
	require.False(t, catalogExportIPAllowed(newCtx("1.2.3.4", "")))

	// 伪造 XFF 但 X-Real-IP 是真实来源 → 以 X-Real-IP 为准,拒绝
	require.False(t, catalogExportIPAllowed(newCtx("1.2.3.4", "81.70.201.229")))

	// env 覆盖白名单
	t.Setenv("CATALOG_EXPORT_ALLOWED_IPS", "9.9.9.9")
	require.True(t, catalogExportIPAllowed(newCtx("9.9.9.9", "")))
	require.False(t, catalogExportIPAllowed(newCtx("81.70.201.229", "")))

	// "*" 关闭 IP 限制
	t.Setenv("CATALOG_EXPORT_ALLOWED_IPS", "*")
	require.True(t, catalogExportIPAllowed(newCtx("1.2.3.4", "")))

	// 空白名单值 → 回落默认(TrimSpace 后为空串不是 "*")——按实现语义:空串 split 得 [""],全拒
	t.Setenv("CATALOG_EXPORT_ALLOWED_IPS", "")
	require.True(t, catalogExportIPAllowed(newCtx("81.70.201.229", "")), "空 env 应回落默认白名单")
}
