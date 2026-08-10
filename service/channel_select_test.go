package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

// TestDetectRegionFallbackToUserPreference 验证区域解析的优先级：
// X-Region 请求头 > 请求上下文区域 > 用户区域偏好 > 空。
func TestDetectRegionFallbackToUserPreference(t *testing.T) {
	// 仅设置用户区域偏好
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Set(string(constant.ContextKeyUserRegionPreference), "eu")
	if got := detectRegion(c); got != "eu" {
		t.Fatalf("expected user preference 'eu', got %q", got)
	}

	// 请求头优先于用户偏好
	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c2.Request.Header.Set(constant.HeaderRegion, "us")
	c2.Set(string(constant.ContextKeyUserRegionPreference), "eu")
	if got := detectRegion(c2); got != "us" {
		t.Fatalf("expected header 'us' to win, got %q", got)
	}

	// 请求上下文区域优先于用户偏好，但让位于请求头
	w3 := httptest.NewRecorder()
	c3, _ := gin.CreateTestContext(w3)
	c3.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c3.Set(string(constant.ContextKeyRequestRegion), "cn")
	c3.Set(string(constant.ContextKeyUserRegionPreference), "eu")
	if got := detectRegion(c3); got != "cn" {
		t.Fatalf("expected request-region 'cn' to win over preference, got %q", got)
	}

	// 全部为空时返回空，保持原有选渠道行为
	w4 := httptest.NewRecorder()
	c4, _ := gin.CreateTestContext(w4)
	c4.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	if got := detectRegion(c4); got != "" {
		t.Fatalf("expected empty region, got %q", got)
	}

	// 用户偏好被归一化（去空格、转小写、截断超长）
	w5 := httptest.NewRecorder()
	c5, _ := gin.CreateTestContext(w5)
	c5.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c5.Set(string(constant.ContextKeyUserRegionPreference), "  EU  ")
	if got := detectRegion(c5); got != "eu" {
		t.Fatalf("expected normalized 'eu', got %q", got)
	}
}
