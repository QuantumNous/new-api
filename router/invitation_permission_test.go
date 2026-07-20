package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestInvitationManagementRoutesRequireRoot(t *testing.T) {
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldRedisEnabled := common.RedisEnabled
	oldMainDatabaseType, oldLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	oldGinMode := gin.Mode()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.InvitationCode{}))
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.RedisEnabled = oldRedisEnabled
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
		gin.SetMode(oldGinMode)
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("invitation-route-permission-test"))))
	engine.GET("/test/session/:role", func(c *gin.Context) {
		role, parseErr := strconv.Atoi(c.Param("role"))
		if parseErr != nil {
			c.Status(http.StatusBadRequest)
			return
		}
		session := sessions.Default(c)
		session.Set("username", "invitation-permission-user")
		session.Set("role", role)
		session.Set("id", role)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		if saveErr := session.Save(); saveErr != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusNoContent)
	})
	SetApiRouter(engine)

	requestInvitationCodes := func(t *testing.T, role int) *httptest.ResponseRecorder {
		t.Helper()
		loginRecorder := httptest.NewRecorder()
		loginRequest := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/test/session/%d", role), nil)
		engine.ServeHTTP(loginRecorder, loginRequest)
		require.Equal(t, http.StatusNoContent, loginRecorder.Code)

		request := httptest.NewRequest(http.MethodGet, "/api/invitation/", nil)
		request.Header.Set("New-Api-User", strconv.Itoa(role))
		for _, sessionCookie := range loginRecorder.Result().Cookies() {
			request.AddCookie(sessionCookie)
		}
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, request)
		return response
	}

	t.Run("admin is denied with the existing HTTP 200 contract", func(t *testing.T) {
		response := requestInvitationCodes(t, common.RoleAdminUser)
		var payload struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
		assert.Equal(t, http.StatusOK, response.Code)
		assert.False(t, payload.Success)
	})

	t.Run("root reaches the invitation handler", func(t *testing.T) {
		response := requestInvitationCodes(t, common.RoleRootUser)
		var payload struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
		assert.Equal(t, http.StatusOK, response.Code)
		assert.True(t, payload.Success)
	})
}
