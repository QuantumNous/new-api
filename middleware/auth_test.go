package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTokenOrUserAuthTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	model.DB = db

	t.Cleanup(func() {
		model.DB = originalDB
		common.RedisEnabled = originalRedisEnabled
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func tokenOrUserAuthSessionCookies(t *testing.T, router *gin.Engine, userID int) []*http.Cookie {
	t.Helper()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/login", nil)
	router.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusNoContent, recorder.Code)
	return recorder.Result().Cookies()
}

func newTokenOrUserAuthTestRouter(t *testing.T, userID int, handler gin.HandlerFunc) *gin.Engine {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("token-or-user-auth-test"))))
	router.GET("/login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", userID)
		session.Set("username", "stale-user")
		session.Set("role", common.RoleCommonUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	router.GET("/protected", TokenOrUserAuth(), handler)
	return router
}

func TestTokenOrUserAuthRejectsDBDisabledSessionUser(t *testing.T) {
	db := setupTokenOrUserAuthTestDB(t)
	user := &model.User{
		Id:       101,
		Username: "disabled-user",
		Password: "not-used-in-test",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusDisabled,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)

	handlerCalled := false
	router := newTokenOrUserAuthTestRouter(t, user.Id, func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusNoContent)
	})
	cookies := tokenOrUserAuthSessionCookies(t, router, user.Id)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	for _, sessionCookie := range cookies {
		request.AddCookie(sessionCookie)
	}
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.False(t, handlerCalled)
}

func TestTokenOrUserAuthRefreshesSessionContextFromDB(t *testing.T) {
	db := setupTokenOrUserAuthTestDB(t)
	user := &model.User{
		Id:       102,
		Username: "fresh-user",
		Password: "not-used-in-test",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
		Group:    "premium",
	}
	require.NoError(t, db.Create(user).Error)

	router := newTokenOrUserAuthTestRouter(t, user.Id, func(c *gin.Context) {
		require.Equal(t, user.Username, c.GetString("username"))
		require.Equal(t, user.Role, c.GetInt("role"))
		require.Equal(t, user.Group, c.GetString("user_group"))
		c.Status(http.StatusNoContent)
	})
	cookies := tokenOrUserAuthSessionCookies(t, router, user.Id)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	for _, sessionCookie := range cookies {
		request.AddCookie(sessionCookie)
	}
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code)
}
