package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRecallEmailPreviewRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	found := false
	for _, route := range engine.Routes() {
		if route.Path == "/api/recall-campaigns/email-preview" && route.Method == http.MethodPost {
			found = true
			break
		}
	}
	require.True(t, found)
}

func TestRecallEmailPreviewRouteRequiresAdminAuth(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-email-preview-auth"))))
	SetApiRouter(engine)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/recall-campaigns/email-preview", nil)
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestRecallEmailQuotaStatusRouteAndGenerationRouteAreRegisteredWithAdminAuth(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-email-generation-auth"))))
	SetApiRouter(engine)

	wantRoutes := map[string]string{
		"/api/recall-campaigns/email-quota":                     http.MethodGet,
		"/api/recall-campaigns/:id/email-translations/generate": http.MethodPost,
	}
	for path, method := range wantRoutes {
		found := false
		for _, route := range engine.Routes() {
			if route.Path == path && route.Method == method {
				found = true
				break
			}
		}
		require.True(t, found, "missing route %s %s", method, path)

		target := strings.Replace(path, ":id", "1", 1)
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(method, target, nil))
		require.Equal(t, http.StatusUnauthorized, recorder.Code)
	}

	quotaIndex := -1
	idIndex := -1
	for index, route := range engine.Routes() {
		if route.Method != http.MethodGet {
			continue
		}
		switch route.Path {
		case "/api/recall-campaigns/email-quota":
			quotaIndex = index
		case "/api/recall-campaigns/:id":
			idIndex = index
		}
	}
	require.NotEqual(t, -1, quotaIndex)
	require.NotEqual(t, -1, idIndex)
	require.Less(t, quotaIndex, idIndex)
}

func TestRecallEmailQuotaUpdateRouteIsRegisteredWithAdminAuth(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-email-quota-update-auth"))))
	SetApiRouter(engine)

	found := false
	for _, route := range engine.Routes() {
		if route.Path == "/api/recall-campaigns/email-quota" && route.Method == http.MethodPut {
			found = true
			break
		}
	}
	require.True(t, found)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/recall-campaigns/email-quota", strings.NewReader(`{"limit":250}`))
	engine.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestRecallSMTPRoutesAreRegisteredBeforeIDRouteWithAdminAuth(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-smtp-auth"))))
	SetApiRouter(engine)

	indices := map[string]int{
		"smtp_get": -1,
		"smtp_put": -1,
		"id_get":   -1,
		"id_put":   -1,
	}
	oldEmailSenderRegistered := false
	for index, route := range engine.Routes() {
		switch {
		case route.Path == "/api/recall-campaigns/smtp" && route.Method == http.MethodGet:
			indices["smtp_get"] = index
		case route.Path == "/api/recall-campaigns/smtp" && route.Method == http.MethodPut:
			indices["smtp_put"] = index
		case route.Path == "/api/recall-campaigns/email-sender":
			oldEmailSenderRegistered = true
		case route.Path == "/api/recall-campaigns/:id" && route.Method == http.MethodGet:
			indices["id_get"] = index
		case route.Path == "/api/recall-campaigns/:id" && route.Method == http.MethodPut:
			indices["id_put"] = index
		}
	}
	require.False(t, oldEmailSenderRegistered)
	require.NotEqual(t, -1, indices["smtp_get"])
	require.NotEqual(t, -1, indices["smtp_put"])
	require.NotEqual(t, -1, indices["id_get"])
	require.NotEqual(t, -1, indices["id_put"])
	require.Less(t, indices["smtp_get"], indices["id_get"])
	require.Less(t, indices["smtp_put"], indices["id_put"])

	for _, method := range []string{http.MethodGet, http.MethodPut} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(method, "/api/recall-campaigns/smtp", strings.NewReader(`{"email_from":"Campaigns@Example.com"}`))
		engine.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusUnauthorized, recorder.Code)
	}
}

func TestRecallEmailTranslationGenerationRouteUsesCriticalRateLimit(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	previousRedisEnabled := common.RedisEnabled
	previousGlobalEnabled := common.GlobalApiRateLimitEnable
	previousCriticalEnabled := common.CriticalRateLimitEnable
	previousCriticalLimit := common.CriticalRateLimitNum
	common.RedisEnabled = false
	common.GlobalApiRateLimitEnable = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.GlobalApiRateLimitEnable = previousGlobalEnabled
		common.CriticalRateLimitEnable = previousCriticalEnabled
		common.CriticalRateLimitNum = previousCriticalLimit
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-email-generation-rate-limit"))))
	SetApiRouter(engine)
	engine.GET("/login-admin", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", 99)
		session.Set("username", "recall-admin")
		session.Set("role", common.RoleAdminUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})

	loginRecorder := httptest.NewRecorder()
	engine.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/login-admin", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)

	requestGeneration := func() *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "/api/recall-campaigns/1/email-translations/generate", strings.NewReader("not-json"))
		request.RemoteAddr = "192.0.2.88:1234"
		request.Header.Set("New-Api-User", "99")
		for _, sessionCookie := range loginRecorder.Result().Cookies() {
			request.AddCookie(sessionCookie)
		}
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, request)
		return recorder
	}

	require.NotEqual(t, http.StatusTooManyRequests, requestGeneration().Code)
	require.Equal(t, http.StatusTooManyRequests, requestGeneration().Code)
}

func TestRecallEmailOpenPixelBypassesGlobalAPIRateLimit(t *testing.T) {
	previousRedisEnabled := common.RedisEnabled
	previousGlobalEnabled := common.GlobalApiRateLimitEnable
	previousGlobalLimit := common.GlobalApiRateLimitNum
	previousGlobalDuration := common.GlobalApiRateLimitDuration
	common.RedisEnabled = false
	common.GlobalApiRateLimitEnable = true
	common.GlobalApiRateLimitNum = 1
	common.GlobalApiRateLimitDuration = 60
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.GlobalApiRateLimitEnable = previousGlobalEnabled
		common.GlobalApiRateLimitNum = previousGlobalLimit
		common.GlobalApiRateLimitDuration = previousGlobalDuration
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	requestPixel := func() *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodGet, "/api/recall/open.gif?token=invalid", nil)
		request.RemoteAddr = "203.0.113.42:2525"
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, request)
		return recorder
	}
	requirePixel := func(recorder *httptest.ResponseRecorder, expectedBody []byte) []byte {
		t.Helper()
		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, "image/gif", recorder.Header().Get("Content-Type"))
		require.Equal(t, "no-store, no-cache, must-revalidate, max-age=0", recorder.Header().Get("Cache-Control"))
		require.NotEmpty(t, recorder.Body.Bytes())
		if expectedBody != nil {
			require.Equal(t, expectedBody, recorder.Body.Bytes())
		}
		return append([]byte(nil), recorder.Body.Bytes()...)
	}

	body := requirePixel(requestPixel(), nil)
	requirePixel(requestPixel(), body)
}

func TestRecallAudienceUsersRouteIsRegisteredBeforeIDRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	audienceIndex := -1
	idIndex := -1
	for index, route := range engine.Routes() {
		if route.Method != http.MethodGet {
			continue
		}
		switch route.Path {
		case "/api/recall-campaigns/audience-users":
			audienceIndex = index
		case "/api/recall-campaigns/:id":
			idIndex = index
		}
	}

	require.NotEqual(t, -1, audienceIndex)
	require.NotEqual(t, -1, idIndex)
	require.Less(t, audienceIndex, idIndex)
}

func TestRecallAudienceUsersRouteRequiresAdminAuthForNormalUser(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-audience-users-auth"))))
	SetApiRouter(engine)
	engine.GET("/login-common", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", 88)
		session.Set("username", "common-user")
		session.Set("role", common.RoleCommonUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "plg")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})

	loginRecorder := httptest.NewRecorder()
	engine.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/login-common", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)

	request := httptest.NewRequest(http.MethodGet, "/api/recall-campaigns/audience-users?keyword=ada", nil)
	request.Header.Set("New-Api-User", "88")
	for _, cookie := range loginRecorder.Result().Cookies() {
		request.AddCookie(cookie)
	}
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
}

func TestRecallOffersRouteIsRegisteredAndRequiresUserAuth(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-offers-auth"))))
	SetApiRouter(engine)

	registered := false
	for _, route := range engine.Routes() {
		if route.Method == http.MethodGet && route.Path == "/api/user/recall/offers" {
			registered = true
			break
		}
	}
	require.True(t, registered)

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/user/recall/offers", nil))
	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}
