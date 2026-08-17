package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSetConsoleSessionHintCookieWritesSharedDomainCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalDomain := common.CookieSessionDomain
	originalSecure := common.SessionCookieSecure
	t.Cleanup(func() {
		common.CookieSessionDomain = originalDomain
		common.SessionCookieSecure = originalSecure
	})

	common.CookieSessionDomain = ".flatkey.ai"
	common.SessionCookieSecure = true

	router := gin.New()
	router.GET("/hint", func(c *gin.Context) {
		setConsoleSessionHintCookie(c, true)
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/hint", nil))

	require.Equal(t, http.StatusNoContent, recorder.Code)
	require.True(t, cookieHeaderContains(recorder.Header().Values("Set-Cookie"), "flatkey_console_session_hint=1"))
	require.True(t, cookieHeaderContains(recorder.Header().Values("Set-Cookie"), "Domain=flatkey.ai"))
	require.True(t, cookieHeaderContains(recorder.Header().Values("Set-Cookie"), "Max-Age=2592000"))
	require.True(t, cookieHeaderContains(recorder.Header().Values("Set-Cookie"), "Secure"))
}

func TestSetConsoleSessionHintCookieClearsSharedDomainCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalDomain := common.CookieSessionDomain
	t.Cleanup(func() {
		common.CookieSessionDomain = originalDomain
	})

	common.CookieSessionDomain = ".flatkey.ai"

	router := gin.New()
	router.GET("/hint", func(c *gin.Context) {
		setConsoleSessionHintCookie(c, false)
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/hint", nil))

	require.Equal(t, http.StatusNoContent, recorder.Code)
	require.True(t, cookieHeaderContains(recorder.Header().Values("Set-Cookie"), "flatkey_console_session_hint=;"))
	require.True(t, cookieHeaderContains(recorder.Header().Values("Set-Cookie"), "Domain=flatkey.ai"))
	require.True(t, cookieHeaderContains(recorder.Header().Values("Set-Cookie"), "Max-Age=0"))
}

func cookieHeaderContains(headers []string, needle string) bool {
	for _, header := range headers {
		if strings.Contains(header, needle) {
			return true
		}
	}
	return false
}
