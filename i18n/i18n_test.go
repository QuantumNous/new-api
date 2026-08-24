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

func TestTranslateUsernameOrPasswordErrorAcrossFullLocales(t *testing.T) {
	require.NoError(t, Init())

	cases := map[string]string{
		LangEn:   "Username or password is incorrect, or the account has been banned for policy violations",
		LangZhCN: "用户名或密码错误，或因违规行为被封禁",
		LangZhTW: "使用者名或密碼錯誤，或因違規行為被封禁",
		LangPt:   "Nome de usuário ou senha incorretos, ou a conta foi banida por violação de regras",
	}

	for lang, expected := range cases {
		t.Run(lang, func(t *testing.T) {
			require.Equal(t, expected, Translate(lang, MsgUserUsernameOrPasswordError))
		})
	}
}
