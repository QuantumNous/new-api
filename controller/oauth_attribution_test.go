package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func performOAuthAdsAttributionRequest(t *testing.T, query string, sessionValue string) string {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("oauth-attribution-test"))))
	router.GET("/test", func(c *gin.Context) {
		session := sessions.Default(c)
		if sessionValue != "" {
			session.Set("ads_attribution", sessionValue)
			require.NoError(t, session.Save())
		}
		c.String(http.StatusOK, getOAuthAdsAttribution(c, session))
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/test"+query, nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	return recorder.Body.String()
}

func TestGetOAuthAdsAttributionPrefersCallbackQuery(t *testing.T) {
	queryPayload := `{"utm_source":"google","gclid":"query-gclid"}`
	sessionPayload := `{"utm_source":"google","gclid":"session-gclid"}`

	got := performOAuthAdsAttributionRequest(t, "?ads_attribution="+url.QueryEscape(queryPayload), sessionPayload)

	require.Contains(t, got, `"gclid":"query-gclid"`)
	require.NotContains(t, got, "session-gclid")
}

func TestGetOAuthAdsAttributionFallsBackToSession(t *testing.T) {
	sessionPayload := `{"utm_source":"google","gclid":"session-gclid"}`

	got := performOAuthAdsAttributionRequest(t, "", sessionPayload)

	require.Contains(t, got, `"gclid":"session-gclid"`)
}

func TestGetOAuthAdsAttributionRejectsInvalidPayload(t *testing.T) {
	got := performOAuthAdsAttributionRequest(t, "?ads_attribution="+url.QueryEscape("not-json"), "")

	require.Empty(t, got)
}
