package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newI18nRequestContext(method, target string) *gin.Context {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, nil)
	return ctx
}

func TestDetectLanguageUsesSharedLocaleCookieBeforeAcceptLanguage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := newI18nRequestContext(http.MethodGet, "/api/status")
	ctx.Request.AddCookie(&http.Cookie{Name: "fk_locale", Value: "ja"})
	ctx.Request.Header.Set("Accept-Language", "en")

	require.Equal(t, i18n.LangJa, detectLanguage(ctx))
}
