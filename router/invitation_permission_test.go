package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

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
	oldSessionSecret := common.SessionSecret
	oldGinMode := gin.Mode()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}, &model.AuthFlow{}, &model.InvitationCode{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled = false
	common.SessionSecret = "invitation-route-permission-session-secret"
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.RedisEnabled = oldRedisEnabled
		common.SessionSecret = oldSessionSecret
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
		gin.SetMode(oldGinMode)
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	admin := &model.User{Username: "invitation-admin", AffCode: "invitation-admin-aff", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	root := &model.User{Username: "invitation-root", AffCode: "invitation-root-aff", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	require.NoError(t, db.Create(admin).Error)
	require.NoError(t, db.Create(root).Error)
	adminBundle, err := service.CreateLoginSession(admin.Id, "password", "127.0.0.1", "test")
	require.NoError(t, err)
	rootBundle, err := service.CreateLoginSession(root.Id, "password", "127.0.0.1", "test")
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	requestInvitationCodes := func(t *testing.T, accessToken string) *httptest.ResponseRecorder {
		t.Helper()
		request := httptest.NewRequest(http.MethodGet, "/api/invitation/", nil)
		request.Header.Set("Authorization", "Bearer "+accessToken)
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, request)
		return response
	}

	t.Run("admin is denied", func(t *testing.T) {
		response := requestInvitationCodes(t, adminBundle.AccessToken)
		var payload struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
		assert.Equal(t, http.StatusForbidden, response.Code)
		assert.False(t, payload.Success)
	})

	t.Run("root reaches the invitation handler", func(t *testing.T) {
		response := requestInvitationCodes(t, rootBundle.AccessToken)
		var payload struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
		assert.Equal(t, http.StatusOK, response.Code)
		assert.True(t, payload.Success)
	})
}
