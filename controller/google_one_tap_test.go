package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/idtoken"
)

func TestGoogleOneTapSuccessStartsFreshSameOriginNavigation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/oauth/google/one-tap?return_to=%2Fdashboard",
		nil,
	)

	respondGoogleOneTapSuccess(context, gin.H{"id": 42, "username": "one-tap-user"})

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Empty(t, recorder.Header().Get("Location"))
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	require.Contains(t, recorder.Body.String(), "localStorage.setItem('user'")
	require.Contains(t, recorder.Body.String(), "localStorage.setItem('uid'")
	require.Contains(t, recorder.Body.String(), "eyJpZCI6NDIsInVzZXJuYW1lIjoib25lLXRhcC11c2VyIn0=")
	require.Contains(t, recorder.Body.String(), "L2Rhc2hib2FyZA==")
}

func TestGoogleOneTapAlreadyLoggedInPreservesStoredUser(t *testing.T) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/oauth/google/one-tap?return_to=%2Fdashboard",
		nil,
	)

	respondGoogleOneTapAlreadyLoggedIn(context)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	require.NotContains(t, recorder.Body.String(), "localStorage.setItem('user'")
	require.NotContains(t, recorder.Body.String(), "localStorage.setItem('uid'")
	require.NotContains(t, recorder.Body.String(), "already_logged_in")
	require.Contains(t, recorder.Body.String(), "location.replace")
	require.Contains(t, recorder.Body.String(), "L2Rhc2hib2FyZA==")
}

func TestStartGoogleOAuthRedirectsToGoogleAndStoresState(t *testing.T) {
	gin.SetMode(gin.TestMode)
	settings := system_setting.GetGoogleSettings()
	originalGoogle := *settings
	originalConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		*settings = originalGoogle
		system_setting.GetAppConsoleSettings().Origin = originalConsoleOrigin
	})
	settings.Enabled = true
	settings.ClientId = "google-client-id"
	system_setting.GetAppConsoleSettings().Origin = "https://console.flatkey.ai/"

	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("google-oauth-start-test"))))
	router.GET("/api/oauth/google/start", StartGoogleOAuth)
	router.GET("/check", func(c *gin.Context) {
		session := sessions.Default(c)
		require.Nil(t, session.Get("username"))
		require.Equal(t, c.Query("state"), session.Get("oauth_state"))
		require.Equal(t, "aff-code", session.Get("aff"))
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet,
		"/api/oauth/google/start?lng=zh&aff=aff-code",
		nil,
	)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusSeeOther, recorder.Code)
	location := recorder.Header().Get("Location")
	parsed, err := url.Parse(location)
	require.NoError(t, err)
	require.Equal(t, "https", parsed.Scheme)
	require.Equal(t, "accounts.google.com", parsed.Host)
	require.Equal(t, "/o/oauth2/v2/auth", parsed.Path)
	require.Equal(t, "google-client-id", parsed.Query().Get("client_id"))
	require.Equal(t, "https://console.flatkey.ai/oauth/google", parsed.Query().Get("redirect_uri"))
	require.Equal(t, "code", parsed.Query().Get("response_type"))
	require.Equal(t, "openid email profile", parsed.Query().Get("scope"))
	require.NotEmpty(t, parsed.Query().Get("state"))

	checkRecorder := httptest.NewRecorder()
	checkRequest := httptest.NewRequest(http.MethodGet, "/check?state="+url.QueryEscape(parsed.Query().Get("state")), nil)
	for _, responseCookie := range recorder.Result().Cookies() {
		checkRequest.AddCookie(responseCookie)
	}
	router.ServeHTTP(checkRecorder, checkRequest)
	require.Equal(t, http.StatusNoContent, checkRecorder.Code)
}

func TestStartGoogleOAuthFallsBackToSignInWhenGoogleDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	settings := system_setting.GetGoogleSettings()
	originalGoogle := *settings
	t.Cleanup(func() { *settings = originalGoogle })
	settings.Enabled = false
	settings.ClientId = "google-client-id"

	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("google-oauth-start-disabled-test"))))
	router.GET("/api/oauth/google/start", StartGoogleOAuth)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet,
		"/api/oauth/google/start?lng=ja&redirect=%2Fkeys&provider=google",
		nil,
	)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusSeeOther, recorder.Code)
	location := recorder.Header().Get("Location")
	require.Contains(t, location, "/sign-in?")
	require.Contains(t, location, "lng=ja")
	require.Contains(t, location, "redirect=%2Fkeys")
	require.NotContains(t, location, "provider=google")
}

func TestGoogleOneTapSuccessEscapesReturnPath(t *testing.T) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/oauth/google/one-tap?return_to=%2Fdashboard%3Fa%3D1%26next%3D%2522%253E%253Cscript%253E",
		nil,
	)

	respondGoogleOneTapSuccess(context, gin.H{
		"id":       42,
		"username": "</script><script>alert(1)</script>",
	})

	require.False(t, strings.Contains(recorder.Body.String(), "alert(1)"))
	require.Equal(t, 1, strings.Count(recorder.Body.String(), "<script>"))
	require.Contains(t, recorder.Body.String(), "&amp;")
}

func TestGoogleOAuthConsoleOriginUsesForwardedRequestOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	originalServerAddress := system_setting.ServerAddress
	t.Cleanup(func() {
		system_setting.GetAppConsoleSettings().Origin = originalConsoleOrigin
		system_setting.ServerAddress = originalServerAddress
	})
	system_setting.GetAppConsoleSettings().Origin = " "
	system_setting.ServerAddress = "https://router.flatkey.ai"

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/oauth/google/start", nil)
	context.Request.Header.Set("X-Forwarded-Proto", "https")
	context.Request.Header.Set("X-Forwarded-Host", "console.flatkey.ai")

	origin, err := googleOAuthConsoleOrigin(context)

	require.NoError(t, err)
	require.Equal(t, "https://console.flatkey.ai", origin)
}

func TestGoogleOneTapCSRFAcceptsAnyMatchingDuplicateCookie(t *testing.T) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/oauth/google/one-tap", nil)
	context.Request.AddCookie(&http.Cookie{Name: "g_csrf_token", Value: "stale"})
	context.Request.AddCookie(&http.Cookie{Name: "g_csrf_token", Value: "matching"})

	require.True(t, googleOneTapCSRFCookieMatches(context, "matching"))
	require.False(t, googleOneTapCSRFCookieMatches(context, "missing"))
	require.False(t, googleOneTapCSRFCookieMatches(context, ""))
}

func TestGoogleOneTapOAuthUser(t *testing.T) {
	payload := &idtoken.Payload{
		Subject: "google-subject",
		Claims: map[string]any{
			"email":          " user@example.com ",
			"email_verified": true,
			"name":           "Jane Doe",
		},
	}

	user, err := googleOneTapOAuthUser(payload)

	require.NoError(t, err)
	require.Equal(t, "google-subject", user.ProviderUserID)
	require.Equal(t, "google_user", user.Username)
	require.Equal(t, "user@example.com", user.Email)
	require.Equal(t, "Jane Doe", user.DisplayName)
	require.True(t, user.EmailVerified, "One Tap email_verified must surface as verified")
}

func TestGoogleOneTapOAuthUserAcceptsStringEmailVerified(t *testing.T) {
	payload := &idtoken.Payload{
		Claims: map[string]any{
			"sub":            "claim-subject",
			"email":          "user@example.com",
			"email_verified": "true",
		},
	}

	user, err := googleOneTapOAuthUser(payload)

	require.NoError(t, err)
	require.Equal(t, "claim-subject", user.ProviderUserID)
}

func TestGoogleOneTapOAuthUserRejectsInvalidPayload(t *testing.T) {
	tests := []struct {
		name    string
		payload *idtoken.Payload
	}{
		{name: "nil payload"},
		{
			name: "missing subject",
			payload: &idtoken.Payload{
				Claims: map[string]any{
					"email":          "user@example.com",
					"email_verified": true,
				},
			},
		},
		{
			name: "missing email",
			payload: &idtoken.Payload{
				Subject: "google-subject",
				Claims: map[string]any{
					"email_verified": true,
				},
			},
		},
		{
			name: "unverified email",
			payload: &idtoken.Payload{
				Subject: "google-subject",
				Claims: map[string]any{
					"email":          "user@example.com",
					"email_verified": false,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := googleOneTapOAuthUser(tt.payload)

			require.Error(t, err)
			var oauthErr *oauth.OAuthError
			require.ErrorAs(t, err, &oauthErr)
		})
	}
}
