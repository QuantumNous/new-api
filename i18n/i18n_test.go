package i18n

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetLangFromContextPrefersUserSettingBeforeSharedLocaleCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/self", nil)
	ctx.Request.AddCookie(&http.Cookie{Name: LanguagePreferenceCookieName, Value: "ja"})
	common.SetContextKey(ctx, constant.ContextKeyUserSetting, dto.UserSetting{Language: LangEn})

	require.Equal(t, LangEn, GetLangFromContext(ctx))
}

func TestGetLangFromContextFallsThroughInvalidUserSettingToSharedLocaleCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/self", nil)
	ctx.Request.AddCookie(&http.Cookie{Name: LanguagePreferenceCookieName, Value: "ja"})
	common.SetContextKey(ctx, constant.ContextKeyUserSetting, dto.UserSetting{Language: "xx"})

	require.Equal(t, LangJa, GetLangFromContext(ctx))
}
