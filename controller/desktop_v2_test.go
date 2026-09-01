package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
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

func setupDesktopV2ControllerTest(t *testing.T) (*gorm.DB, *model.User, *service.AuthBundle) {
	t.Helper()
	previousDB := model.DB
	previousRedis := common.RedisEnabled
	previousSecret := common.SessionSecret
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}))
	model.DB = db
	common.RedisEnabled = false
	common.SessionSecret = "desktop-v2-controller-test-secret"
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		common.SessionSecret = previousSecret
	})

	user := &model.User{
		Username: "desktop-v2-user", Password: "unused", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
	}
	require.NoError(t, db.Create(user).Error)
	bundle, err := service.CreateLoginSession(user.Id, "desktop_device", "127.0.0.1", "desktop-test")
	require.NoError(t, err)
	return db, user, bundle
}

func TestRefreshDesktopSessionReturnsRotatedJSONBundle(t *testing.T) {
	_, _, bundle := setupDesktopV2ControllerTest(t)
	body, err := common.Marshal(map[string]string{
		"refresh_token": bundle.RefreshToken,
		"session_id":    bundle.Session.SID,
	})
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/desktop/v2/sessions/refresh", bytes.NewReader(body))
	RefreshDesktopSession(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
			SessionID    string `json:"session_id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.NotEmpty(t, response.Data.AccessToken)
	assert.NotEmpty(t, response.Data.RefreshToken)
	assert.NotEqual(t, bundle.RefreshToken, response.Data.RefreshToken)
	assert.Equal(t, bundle.Session.SID, response.Data.SessionID)
}

func TestRefreshDesktopSessionRejectsBrowserSessionWithoutRotation(t *testing.T) {
	_, user, _ := setupDesktopV2ControllerTest(t)
	browserBundle, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "browser-test")
	require.NoError(t, err)
	body, err := common.Marshal(map[string]string{
		"refresh_token": browserBundle.RefreshToken,
		"session_id":    browserBundle.Session.SID,
	})
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/desktop/v2/sessions/refresh", bytes.NewReader(body))
	RefreshDesktopSession(c)

	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "desktop_session_required")
	_, _, err = service.RefreshLoginSession(browserBundle.RefreshToken, browserBundle.Session.SID, "127.0.0.2", "browser-test")
	require.NoError(t, err, "desktop endpoint rejection must not consume the browser refresh token")
}

func TestRevokeCurrentDesktopSessionRevokesLiveSession(t *testing.T) {
	_, user, bundle := setupDesktopV2ControllerTest(t)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/desktop/v2/sessions/current", nil)
	c.Set("id", user.Id)
	c.Set("session_id", bundle.Session.SID)
	c.Set("auth_version", int64(1))
	c.Set("session_version", int64(1))
	c.Set("login_method", service.DesktopLoginMethod)
	RevokeCurrentDesktopSession(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	stored, err := model.GetUserSessionBySID(bundle.Session.SID)
	require.NoError(t, err)
	assert.Equal(t, model.UserSessionStatusRevoked, stored.Status)
	assert.Equal(t, "desktop_logout", stored.RevokedReason)
}

func TestRevokeCurrentDesktopSessionRejectsBrowserSession(t *testing.T) {
	_, user, _ := setupDesktopV2ControllerTest(t)
	browserBundle, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "browser-test")
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/desktop/v2/sessions/current", nil)
	c.Set("id", user.Id)
	c.Set("session_id", browserBundle.Session.SID)
	c.Set("auth_version", int64(1))
	c.Set("session_version", int64(1))
	c.Set("login_method", "password")
	RevokeCurrentDesktopSession(c)

	assert.Equal(t, http.StatusForbidden, recorder.Code)
	stored, err := model.GetUserSessionBySID(browserBundle.Session.SID)
	require.NoError(t, err)
	assert.Equal(t, model.UserSessionStatusActive, stored.Status)
}

func TestDecideDesktopDeviceAuthorizationRejectsDesktopSession(t *testing.T) {
	_, user, bundle := setupDesktopV2ControllerTest(t)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/desktop/v2/device-authorizations/decision", bytes.NewBufferString(`{"user_code":"ABCD-EFGH","decision":"approve"}`))
	c.Set("id", user.Id)
	c.Set("session_id", bundle.Session.SID)
	c.Set("auth_version", int64(1))
	c.Set("session_version", int64(1))
	c.Set("login_method", service.DesktopLoginMethod)
	DecideDesktopDeviceAuthorization(c)

	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "browser_session_required")
}

func TestRevokeCurrentDesktopSessionRejectsPATIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/desktop/v2/sessions/current", nil)
	c.Set("id", 7)
	c.Set("auth_version", int64(1))
	RevokeCurrentDesktopSession(c)

	assert.Equal(t, http.StatusForbidden, recorder.Code)
	var response struct {
		Success bool   `json:"success"`
		Code    string `json:"code"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Equal(t, "desktop_session_required", response.Code)
}
