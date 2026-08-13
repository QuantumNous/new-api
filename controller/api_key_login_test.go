package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAPIKeyLoginTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	require.NoError(t, i18n.Init())
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedis := common.RedisEnabled
	previousAPIKeyLoginEnabled := common.APIKeyLoginEnabled
	previousSinglePrimaryAPIKeyEnabled := common.SinglePrimaryAPIKeyEnabled
	previousSecret := common.SessionSecret
	previousSQLitePath := common.SQLitePath
	previousIsMasterNode := common.IsMasterNode
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.SQLitePath = dsn
	common.IsMasterNode = false
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	require.NoError(t, model.InitDB())
	initializedDB := model.DB
	db := model.DB
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.UserSession{}, &model.TwoFA{}, &model.AuthFlow{}))
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled = false
	common.APIKeyLoginEnabled = true
	common.SinglePrimaryAPIKeyEnabled = true
	common.SessionSecret = "api-key-login-test-secret"

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.APIKeyLoginEnabled = previousAPIKeyLoginEnabled
		common.SinglePrimaryAPIKeyEnabled = previousSinglePrimaryAPIKeyEnabled
		common.SessionSecret = previousSecret
		common.SQLitePath = previousSQLitePath
		common.IsMasterNode = previousIsMasterNode
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", previousSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
		if initializedDB != nil && initializedDB != db {
			sqlDB, err := initializedDB.DB()
			if err == nil {
				_ = sqlDB.Close()
			}
		}
	})
	return db
}

func createAPIKeyLoginUser(t *testing.T, db *gorm.DB, key string) *model.User {
	t.Helper()
	user := &model.User{
		Username:    "api-key-login-user",
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(user).Error)
	token := &model.Token{
		UserId:         user.Id,
		Key:            key,
		Name:           "registration API key",
		Status:         common.TokenStatusEnabled,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	require.NoError(t, db.Create(token).Error)
	return user
}

func TestAPIKeyLoginCreatesDashboardSession(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	user := createAPIKeyLoginUser(t, db, "valid-api-key")

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/api-key", strings.NewReader(`{"api_key":"sk-valid-api-key"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	APIKeyLogin(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken string `json:"access_token"`
			Session     struct {
				LoginMethod string `json:"login_method"`
			} `json:"session"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.NotEmpty(t, response.Data.AccessToken)
	assert.Equal(t, "api_key", response.Data.Session.LoginMethod)

	var session model.UserSession
	require.NoError(t, db.Where("user_id = ?", user.Id).First(&session).Error)
	assert.Equal(t, "api_key", session.LoginMethod)
}

func TestAPIKeyLoginRejectsInvalidKey(t *testing.T) {
	_ = setupAPIKeyLoginTestDB(t)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/api-key", strings.NewReader(`{"api_key":"not-a-real-key"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	APIKeyLogin(c)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
}

func TestAPIKeyLoginRequiresTwoFactorVerification(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	user := createAPIKeyLoginUser(t, db, "two-factor-api-key")
	require.NoError(t, db.Create(&model.TwoFA{UserId: user.Id, Secret: "test-secret", IsEnabled: true}).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/api-key", strings.NewReader(`{"api_key":"two-factor-api-key"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	APIKeyLogin(c)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			RequireTwoFA bool   `json:"require_2fa"`
			FlowToken    string `json:"flow_token"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.True(t, response.Data.RequireTwoFA)
	assert.NotEmpty(t, response.Data.FlowToken)
}

func TestAPIKeyLoginAllowsExhaustedPrimaryKey(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	user := createAPIKeyLoginUser(t, db, "exhausted-primary-key")
	require.NoError(t, db.Model(&model.Token{}).Where("user_id = ?", user.Id).Updates(map[string]any{
		"unlimited_quota": false,
		"remain_quota":    0,
		"status":          common.TokenStatusExhausted,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/api-key", strings.NewReader(`{"api_key":"exhausted-primary-key"}`))
	APIKeyLogin(c)
	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
}

func TestLegacyAPIKeyLoginKeepsAdministratorCompatibility(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	user := createAPIKeyLoginUser(t, db, "legacy-admin-key")
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Update("role", common.RoleAdminUser).Error)
	common.SinglePrimaryAPIKeyEnabled = false
	common.APIKeyLoginEnabled = true

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/api-key", strings.NewReader(`{"api_key":"sk-legacy-admin-key"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	APIKeyLogin(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":true`)
}

func TestSinglePrimaryAPIKeyLoginKeepsPrivilegedMultiKeyCompatibility(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	user := createAPIKeyLoginUser(t, db, "privileged-key-one")
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Update("role", common.RoleAdminUser).Error)
	second := &model.Token{
		UserId: user.Id, Key: "privileged-key-two", Name: "second key",
		Status: common.TokenStatusEnabled, CreatedTime: common.GetTimestamp(),
		AccessedTime: common.GetTimestamp(), ExpiredTime: -1, UnlimitedQuota: true,
	}
	require.NoError(t, db.Create(second).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/api-key", strings.NewReader(`{"api_key":"privileged-key-two"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	APIKeyLogin(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":true`)
}

func TestSinglePrimaryAPIKeyLoginRejectsOrdinaryUserWithMultipleKeys(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	user := createAPIKeyLoginUser(t, db, "ordinary-key-one")
	second := &model.Token{
		UserId: user.Id, Key: "ordinary-key-two", Name: "second key",
		Status: common.TokenStatusEnabled, CreatedTime: common.GetTimestamp(),
		AccessedTime: common.GetTimestamp(), ExpiredTime: -1, UnlimitedQuota: true,
	}
	require.NoError(t, db.Create(second).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/api-key", strings.NewReader(`{"api_key":"ordinary-key-two"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	APIKeyLogin(c)

	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
}

func TestSinglePrimaryAPIKeyLoginRejectsGuestRole(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	user := createAPIKeyLoginUser(t, db, "guest-api-key")
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Update("role", common.RoleGuestUser).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login/api-key", strings.NewReader(`{"api_key":"guest-api-key"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	APIKeyLogin(c)

	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
}

func TestRotatePrimaryTokenRevokesSessionsAndInvalidatesOldKey(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	user := createAPIKeyLoginUser(t, db, "old-primary-key")
	bundle, err := service.CreateLoginSession(user.Id, "api_key", "127.0.0.1", "test")
	require.NoError(t, err)

	rotated, err := model.RotatePrimaryTokenByUserID(user.Id)
	require.NoError(t, err)
	require.NotEqual(t, "old-primary-key", rotated.Key)
	assert.NotEmpty(t, rotated.Key)

	_, err = model.ValidateUserTokenForLogin("old-primary-key")
	assert.ErrorIs(t, err, model.ErrTokenInvalid)
	_, _, err = service.RefreshLoginSession(bundle.RefreshToken, bundle.Session.SID, "127.0.0.1", "test")
	assert.Error(t, err)
	var count int64
	require.NoError(t, db.Model(&model.Token{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}
