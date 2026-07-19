package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPasskeyRegistrationRoutesRejectAnonymousRequestsWithoutCreatingUsers(t *testing.T) {
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldRedisEnabled := common.RedisEnabled
	oldMainDatabaseType, oldLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	passkeySettings := system_setting.GetPasskeySettings()
	oldPasskeySettings := *passkeySettings

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	passkeySettings.Enabled = true
	passkeySettings.RPDisplayName = "Passkey Registration Boundary"
	passkeySettings.RPID = "localhost"
	passkeySettings.Origins = "http://localhost"
	passkeySettings.AllowInsecureOrigin = true

	t.Cleanup(func() {
		*passkeySettings = oldPasskeySettings
		common.RedisEnabled = oldRedisEnabled
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	existingUser := &model.User{
		Username: "existing-passkey-user",
		Password: "password-hash",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(existingUser).Error)

	var countBefore int64
	require.NoError(t, db.Model(&model.User{}).Count(&countBefore).Error)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("passkey-registration-boundary-session"))))
	SetApiRouter(engine)

	for _, testCase := range []struct {
		name string
		path string
	}{
		{name: "begin", path: "/api/user/passkey/register/begin"},
		{name: "finish", path: "/api/user/passkey/register/finish"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, testCase.path, strings.NewReader(`{}`))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)

			var payload struct {
				Success bool `json:"success"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
			assert.Equal(t, http.StatusUnauthorized, response.Code)
			assert.False(t, payload.Success)

			var countAfter int64
			require.NoError(t, db.Model(&model.User{}).Count(&countAfter).Error)
			assert.Equal(t, countBefore, countAfter)
		})
	}

	request := httptest.NewRequest(http.MethodPost, "/api/user/passkey/login/finish", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	var loginPayload struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &loginPayload))
	assert.Equal(t, http.StatusOK, response.Code)
	assert.False(t, loginPayload.Success)

	var countAfterLoginFinish int64
	require.NoError(t, db.Model(&model.User{}).Count(&countAfterLoginFinish).Error)
	assert.Equal(t, countBefore, countAfterLoginFinish)
}
