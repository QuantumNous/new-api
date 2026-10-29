package router

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var authSessionRateLimitIPSequence atomic.Uint32

type authSessionRateLimitFixture struct {
	engine      *gin.Engine
	redisServer *miniredis.Miniredis
	redisClient *redis.Client
	cookie      *http.Cookie
	ip          string
}

func newAuthSessionRateLimitFixture(t *testing.T, useRedis bool) *authSessionRateLimitFixture {
	t.Helper()
	// The in-memory limiter outlives each fixture, including repeated test runs.
	ip := fmt.Sprintf("2001:db8::%x", authSessionRateLimitIPSequence.Add(1))
	previousDB, previousRDB, previousRedis := model.DB, common.RDB, common.RedisEnabled
	previousDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousCriticalEnable, previousCriticalNum, previousCriticalDuration := common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration
	previousSessionEnable, previousSessionNum, previousSessionDuration := common.AuthSessionRateLimitEnable, common.AuthSessionRateLimitNum, common.AuthSessionRateLimitDuration
	previousAPIEnable, previousAPINum, previousAPIDuration := common.GlobalApiRateLimitEnable, common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration
	previousSecure, previousOrigins := common.SessionCookieSecure, common.SessionCookieTrustedURLs
	previousSecret := common.SessionSecret
	previousPasswordLogin, previousTurnstile := common.PasswordLoginEnabled, common.TurnstileCheckEnabled
	previousActiveLimit, previousIssuanceLimit, previousIssuanceWindow := common.UserSessionActiveLimit, common.UserSessionIssuanceLimit, common.UserSessionIssuanceWindowSeconds
	t.Cleanup(func() {
		model.DB, common.RDB, common.RedisEnabled = previousDB, previousRDB, previousRedis
		common.SetDatabaseTypes(previousDatabaseType, previousLogDatabaseType)
		common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration = previousCriticalEnable, previousCriticalNum, previousCriticalDuration
		common.AuthSessionRateLimitEnable, common.AuthSessionRateLimitNum, common.AuthSessionRateLimitDuration = previousSessionEnable, previousSessionNum, previousSessionDuration
		common.GlobalApiRateLimitEnable, common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration = previousAPIEnable, previousAPINum, previousAPIDuration
		common.SessionCookieSecure, common.SessionCookieTrustedURLs = previousSecure, previousOrigins
		common.SessionSecret = previousSecret
		common.PasswordLoginEnabled, common.TurnstileCheckEnabled = previousPasswordLogin, previousTurnstile
		common.UserSessionActiveLimit, common.UserSessionIssuanceLimit, common.UserSessionIssuanceWindowSeconds = previousActiveLimit, previousIssuanceLimit, previousIssuanceWindow
	})
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration = true, 2, 1200
	common.AuthSessionRateLimitEnable, common.AuthSessionRateLimitNum, common.AuthSessionRateLimitDuration = true, 4, 60
	common.GlobalApiRateLimitEnable = false
	common.SessionCookieSecure, common.SessionCookieTrustedURLs = true, nil
	common.SessionSecret = "auth-session-rate-limit-test-secret"
	common.PasswordLoginEnabled, common.TurnstileCheckEnabled = true, false
	common.UserSessionActiveLimit, common.UserSessionIssuanceLimit, common.UserSessionIssuanceWindowSeconds = 50, 100, 86400

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}))
	model.DB, common.RedisEnabled = db, useRedis
	fixture := &authSessionRateLimitFixture{ip: ip}
	if useRedis {
		fixture.redisServer = miniredis.RunT(t)
		fixture.redisClient = redis.NewClient(&redis.Options{Addr: fixture.redisServer.Addr()})
		t.Cleanup(func() { _ = fixture.redisClient.Close() })
		common.RDB = fixture.redisClient
		require.NoError(t, common.RDB.Ping(context.Background()).Err())
	}
	user := model.User{Username: "session-rate-limit-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	require.NoError(t, db.Create(&user).Error)
	bundle, err := service.CreateLoginSession(user.Id, "password", ip, "test-agent")
	require.NoError(t, err)
	fixture.cookie = &http.Cookie{Name: service.RefreshCookieName, Value: bundle.RefreshToken}
	fixture.engine = newAuthSessionRateLimitEngine(t)
	return fixture
}

func newAuthSessionRateLimitEngine(t *testing.T) *gin.Engine {
	t.Helper()
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetApiRouter(engine)
	return engine
}

func (f *authSessionRateLimitFixture) request(path string, cookie *http.Cookie) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "https://console.example"+path, strings.NewReader(`{}`))
	request.RemoteAddr = net.JoinHostPort(f.ip, "12345")
	request.Header.Set("Origin", "https://console.example")
	request.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		request.AddCookie(cookie)
	}
	response := httptest.NewRecorder()
	f.engine.ServeHTTP(response, request)
	return response
}

func (f *authSessionRateLimitFixture) refresh(t *testing.T) {
	t.Helper()
	response := f.request("/api/user/auth/refresh", f.cookie)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var body struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken string `json:"access_token"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	require.True(t, body.Success)
	require.NotEmpty(t, body.Data.AccessToken)
	for _, cookie := range response.Result().Cookies() {
		if cookie.Name == service.RefreshCookieName {
			require.NotEmpty(t, cookie.Value)
			assert.NotEqual(t, f.cookie.Value, cookie.Value)
			f.cookie = cookie
			return
		}
	}
	t.Fatal("successful refresh did not rotate its cookie")
}

func TestAuthSessionRateLimitSeparatesRefreshLogoutAndLogin(t *testing.T) {
	for _, useRedis := range []bool{false, true} {
		name := "memory"
		if useRedis {
			name = "redis"
		}
		t.Run(name, func(t *testing.T) {
			fixture := newAuthSessionRateLimitFixture(t, useRedis)
			// Routine refreshes exceed the login limit without spending it.
			for range 3 {
				fixture.refresh(t)
			}
			for range 2 {
				response := fixture.request("/api/user/login", nil)
				require.Equal(t, http.StatusOK, response.Code)
				assert.Contains(t, response.Body.String(), `"message_key":"Invalid parameters"`)
			}
			response := fixture.request("/api/user/login", nil)
			assert.Equal(t, http.StatusTooManyRequests, response.Code)
			assert.Equal(t, "1200", response.Header().Get("Retry-After"))
			// Exhausted login protection must still allow refresh and logout.
			fixture.refresh(t)
			response = fixture.request("/api/user/auth/refresh", fixture.cookie)
			assert.Equal(t, http.StatusTooManyRequests, response.Code)
			assert.Equal(t, "60", response.Header().Get("Retry-After"))
			assert.Empty(t, response.Header().Values("Set-Cookie"))
			// Even exhausted refresh allowance must not prevent logout.
			response = fixture.request("/api/user/auth/logout", fixture.cookie)
			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), `"success":true`)
			for range 3 {
				assert.Equal(t, http.StatusOK, fixture.request("/api/user/auth/logout", nil).Code)
			}
			response = fixture.request("/api/user/auth/logout", nil)
			assert.Equal(t, http.StatusTooManyRequests, response.Code)
			assert.Equal(t, "60", response.Header().Get("Retry-After"))
		})
	}
}

func TestAuthSessionRateLimitCountsUntrustedCookiesByIP(t *testing.T) {
	for _, useRedis := range []bool{false, true} {
		name := "memory"
		if useRedis {
			name = "redis"
		}
		t.Run(name, func(t *testing.T) {
			fixture := newAuthSessionRateLimitFixture(t, useRedis)
			for _, value := range []string{"", "malformed", "11111111-1111-4111-8111-111111111111.invalid", "22222222-2222-4222-8222-222222222222.invalid"} {
				response := fixture.request("/api/user/auth/refresh", &http.Cookie{Name: service.RefreshCookieName, Value: value})
				assert.Equal(t, http.StatusUnauthorized, response.Code)
			}
			response := fixture.request("/api/user/auth/refresh", fixture.cookie)
			assert.Equal(t, http.StatusTooManyRequests, response.Code)
			assert.Empty(t, response.Header().Values("Set-Cookie"))
			response = fixture.request("/api/user/login", nil)
			assert.Equal(t, http.StatusOK, response.Code)
			assert.Contains(t, response.Body.String(), `"message_key":"Invalid parameters"`)
			fixture.ip = fmt.Sprintf("2001:db8::%x", authSessionRateLimitIPSequence.Add(1))
			fixture.refresh(t)
		})
	}
}

func TestAuthSessionRateLimitRedisSharesAllowanceAndExpires(t *testing.T) {
	fixture := newAuthSessionRateLimitFixture(t, true)
	for range 2 {
		fixture.refresh(t)
	}
	fixture.engine = newAuthSessionRateLimitEngine(t)
	for range 2 {
		fixture.refresh(t)
	}
	response := fixture.request("/api/user/auth/refresh", fixture.cookie)
	assert.Equal(t, http.StatusTooManyRequests, response.Code)
	assert.Equal(t, "60", response.Header().Get("Retry-After"))
	fixture.redisServer.FastForward(60 * time.Second)
	fixture.refresh(t)
}

func TestAuthSessionRateLimitRedisFailurePreservesRefreshCookie(t *testing.T) {
	fixture := newAuthSessionRateLimitFixture(t, true)
	require.NoError(t, fixture.redisClient.Close())
	for _, path := range []string{"/api/user/auth/refresh", "/api/user/auth/logout"} {
		response := fixture.request(path, fixture.cookie)
		assert.Equal(t, http.StatusInternalServerError, response.Code)
		assert.Empty(t, response.Header().Values("Set-Cookie"))
	}
	// A rejected request must not consume or revoke the presented session.
	client := redis.NewClient(&redis.Options{Addr: fixture.redisServer.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	common.RDB = client
	fixture.refresh(t)
}

func TestAuthSessionRateLimitSwitchesAreIndependent(t *testing.T) {
	t.Run("session limit disabled leaves login protection enabled", func(t *testing.T) {
		fixture := newAuthSessionRateLimitFixture(t, false)
		common.AuthSessionRateLimitEnable = false
		fixture.engine = newAuthSessionRateLimitEngine(t)
		for range 5 {
			fixture.refresh(t)
		}
		for range 2 {
			assert.Equal(t, http.StatusOK, fixture.request("/api/user/login", nil).Code)
		}
		assert.Equal(t, http.StatusTooManyRequests, fixture.request("/api/user/login", nil).Code)
	})
	t.Run("critical limit disabled leaves session protection enabled", func(t *testing.T) {
		fixture := newAuthSessionRateLimitFixture(t, false)
		common.CriticalRateLimitEnable = false
		fixture.engine = newAuthSessionRateLimitEngine(t)
		for range 3 {
			assert.Equal(t, http.StatusOK, fixture.request("/api/user/login", nil).Code)
		}
		for range 4 {
			fixture.refresh(t)
		}
		assert.Equal(t, http.StatusTooManyRequests, fixture.request("/api/user/auth/refresh", fixture.cookie).Code)
	})
}

func TestAuthSessionRateLimitPreservesGlobalLimitAndOriginGuard(t *testing.T) {
	t.Run("global API limit still bounds session traffic", func(t *testing.T) {
		fixture := newAuthSessionRateLimitFixture(t, false)
		common.GlobalApiRateLimitEnable, common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration = true, 2, 31
		fixture.engine = newAuthSessionRateLimitEngine(t)
		fixture.refresh(t)
		assert.Equal(t, http.StatusOK, fixture.request("/api/user/auth/logout", nil).Code)
		response := fixture.request("/api/user/auth/refresh", fixture.cookie)
		assert.Equal(t, http.StatusTooManyRequests, response.Code)
		assert.Equal(t, "31", response.Header().Get("Retry-After"))
		assert.Empty(t, response.Header().Values("Set-Cookie"))
	})
	t.Run("rejected origin cannot consume session allowance", func(t *testing.T) {
		fixture := newAuthSessionRateLimitFixture(t, false)
		for _, path := range []string{"/api/user/auth/refresh", "/api/user/auth/logout"} {
			request := httptest.NewRequest(http.MethodPost, "https://console.example"+path, nil)
			request.RemoteAddr = net.JoinHostPort(fixture.ip, "12345")
			request.Header.Set("Origin", "https://untrusted.example")
			request.AddCookie(fixture.cookie)
			response := httptest.NewRecorder()
			fixture.engine.ServeHTTP(response, request)
			assert.Equal(t, http.StatusForbidden, response.Code)
			assert.Contains(t, response.Body.String(), `"code":"AUTH_ORIGIN_FORBIDDEN"`)
			assert.Empty(t, response.Header().Values("Set-Cookie"))
		}
		for range 4 {
			fixture.refresh(t)
		}
	})
}
