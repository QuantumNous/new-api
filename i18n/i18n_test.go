package i18n

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
)

func TestGetLangFromContextAPIRoutesDefaultEnglish(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []string{"relay", "old_api"}

	for _, routeTag := range tests {
		t.Run(routeTag, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("GET", "/v1/chat/completions", nil)
			c.Request.Header.Set("Accept-Language", "zh-CN,zh;q=0.9")
			c.Set(string(constant.ContextKeyRouteTag), routeTag)

			if got := GetLangFromContext(c); got != LangEn {
				t.Fatalf("expected API route to default to %q, got %q", LangEn, got)
			}
		})
	}
}

func TestGetLangFromContextAPIRoutesUseExplicitUserLanguage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/v1/chat/completions", nil)
	c.Request.Header.Set("Accept-Language", "en")
	c.Set(string(constant.ContextKeyRouteTag), "relay")
	common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{Language: LangZhCN})

	if got := GetLangFromContext(c); got != LangZhCN {
		t.Fatalf("expected explicit user language %q, got %q", LangZhCN, got)
	}
}

func TestGetLangFromContextWebRoutesUseAcceptLanguage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/api/user/login", nil)
	c.Request.Header.Set("Accept-Language", "zh-CN,zh;q=0.9")

	if got := GetLangFromContext(c); got != LangZhCN {
		t.Fatalf("expected web route to use Accept-Language %q, got %q", LangZhCN, got)
	}
}
