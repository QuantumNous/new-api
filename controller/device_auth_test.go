package controller

import (
	"bytes"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDeviceAuthTest(t *testing.T) *model.User {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Option{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })

	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	oldAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://you-box.com"
	desktop := system_setting.GetDesktopSettings()
	oldEnabled := desktop.Enabled
	desktop.Enabled = true
	t.Cleanup(func() {
		common.RedisEnabled = oldRedisEnabled
		system_setting.ServerAddress = oldAddress
		desktop.Enabled = oldEnabled
	})

	user := &model.User{Username: "desktop-user", Email: "desktop@example.com", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	return user
}

func postJSON(t *testing.T, handler gin.HandlerFunc, path string, body string, userId int) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", path, bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	if userId > 0 {
		c.Set("id", userId)
	}
	handler(c)

	parsed := map[string]any{}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &parsed))
	return recorder, parsed
}

func requestDeviceCode(t *testing.T) (deviceCode string, userCode string) {
	t.Helper()
	recorder, body := postJSON(t, RequestDeviceAuthCode, "/api/device/code", `{"client_name":"BoxAI Desktop"}`, 0)
	require.Equal(t, 200, recorder.Code)
	deviceCode, _ = body["device_code"].(string)
	userCode, _ = body["user_code"].(string)
	require.NotEmpty(t, deviceCode)
	require.NotEmpty(t, userCode)
	return deviceCode, userCode
}

func TestDeviceAuthApprovalIssuesSessionAndRelayKeyOnce(t *testing.T) {
	user := setupDeviceAuthTest(t)
	deviceCode, userCode := requestDeviceCode(t)

	_, pending := postJSON(t, PollDeviceAuthToken, "/api/device/token", `{"device_code":"`+deviceCode+`"}`, 0)
	assert.Equal(t, deviceErrorAuthorizationPending, pending["error"])

	_, approved := postJSON(t, ApproveDeviceAuth, "/api/device/approve", `{"user_code":"`+userCode+`","approve":true}`, user.Id)
	require.Equal(t, true, approved["success"], approved["message"])

	// The poll interval guard must not block the first poll after approval.
	stored, err := service.GetDeviceAuthByUserCode(userCode)
	require.NoError(t, err)
	stored.LastPolledAt = 0
	require.NoError(t, service.SaveDeviceAuthRequest(stored))

	recorder, session := postJSON(t, PollDeviceAuthToken, "/api/device/token", `{"device_code":"`+deviceCode+`"}`, 0)
	require.Equal(t, 200, recorder.Code)
	assert.Equal(t, "https://you-box.com/v1", session["base_url"])
	assert.Equal(t, float64(user.Id), session["user_id"])

	apiKey, _ := session["api_key"].(string)
	require.True(t, strings.HasPrefix(apiKey, "sk-"), "the desktop receives a ready-to-use key")
	relayToken := model.Token{}
	require.NoError(t, model.DB.Where(model.Token{Key: strings.TrimPrefix(apiKey, "sk-")}).First(&relayToken).Error)
	assert.Equal(t, user.Id, relayToken.UserId)
	assert.Equal(t, "BoxAI Desktop", relayToken.Name)
	assert.True(t, relayToken.UnlimitedQuota)
	assert.Equal(t, int64(-1), relayToken.ExpiredTime)

	accessToken, _ := session["access_token"].(string)
	claims, err := service.ParseDesktopToken(accessToken, service.DesktopTokenTypeAccess)
	require.NoError(t, err)
	assert.Equal(t, relayToken.Id, claims.RelayTokenId)
	assert.Equal(t, user.Email, claims.Email)

	// Credentials are handed out exactly once.
	_, replay := postJSON(t, PollDeviceAuthToken, "/api/device/token", `{"device_code":"`+deviceCode+`"}`, 0)
	assert.Equal(t, deviceErrorExpiredToken, replay["error"])
}

func TestDeviceAuthDenialAndExpiry(t *testing.T) {
	user := setupDeviceAuthTest(t)

	deniedCode, deniedUserCode := requestDeviceCode(t)
	_, denied := postJSON(t, ApproveDeviceAuth, "/api/device/approve", `{"user_code":"`+deniedUserCode+`","approve":false}`, user.Id)
	require.Equal(t, true, denied["success"], denied["message"])
	_, deniedPoll := postJSON(t, PollDeviceAuthToken, "/api/device/token", `{"device_code":"`+deniedCode+`"}`, 0)
	assert.Equal(t, deviceErrorAccessDenied, deniedPoll["error"])

	expiredCode, expiredUserCode := requestDeviceCode(t)
	stored, err := service.GetDeviceAuthByUserCode(expiredUserCode)
	require.NoError(t, err)
	stored.CreatedAt = time.Now().Add(-service.DeviceAuthLifetime - time.Minute).Unix()
	require.NoError(t, service.SaveDeviceAuthRequest(stored))
	_, expiredPoll := postJSON(t, PollDeviceAuthToken, "/api/device/token", `{"device_code":"`+expiredCode+`"}`, 0)
	assert.Equal(t, deviceErrorExpiredToken, expiredPoll["error"])

	// No relay token may be created by a denied or expired request.
	count, err := model.CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
}

func TestDeviceAuthPollingRespectsInterval(t *testing.T) {
	setupDeviceAuthTest(t)
	deviceCode, _ := requestDeviceCode(t)

	_, first := postJSON(t, PollDeviceAuthToken, "/api/device/token", `{"device_code":"`+deviceCode+`"}`, 0)
	assert.Equal(t, deviceErrorAuthorizationPending, first["error"])

	_, second := postJSON(t, PollDeviceAuthToken, "/api/device/token", `{"device_code":"`+deviceCode+`"}`, 0)
	assert.Equal(t, deviceErrorSlowDown, second["error"])
}

func TestDeviceAuthRefreshDiesWithRelayToken(t *testing.T) {
	user := setupDeviceAuthTest(t)
	deviceCode, userCode := requestDeviceCode(t)

	_, approved := postJSON(t, ApproveDeviceAuth, "/api/device/approve", `{"user_code":"`+userCode+`","approve":true}`, user.Id)
	require.Equal(t, true, approved["success"], approved["message"])
	stored, err := service.GetDeviceAuthByUserCode(userCode)
	require.NoError(t, err)
	stored.LastPolledAt = 0
	require.NoError(t, service.SaveDeviceAuthRequest(stored))

	_, session := postJSON(t, PollDeviceAuthToken, "/api/device/token", `{"device_code":"`+deviceCode+`"}`, 0)
	refreshToken, _ := session["refresh_token"].(string)
	require.NotEmpty(t, refreshToken)

	recorder, refreshed := postJSON(t, RefreshDeviceAuthToken, "/api/device/refresh", `{"refresh_token":"`+refreshToken+`"}`, 0)
	require.Equal(t, 200, recorder.Code)
	assert.NotEmpty(t, refreshed["access_token"])

	// Revoking the desktop API key in the console must end the session.
	require.NoError(t, model.DeleteTokenById(stored.RelayTokenId, user.Id))
	revokedRecorder, revoked := postJSON(t, RefreshDeviceAuthToken, "/api/device/refresh", `{"refresh_token":"`+refreshToken+`"}`, 0)
	assert.Equal(t, 401, revokedRecorder.Code)
	assert.Equal(t, deviceErrorInvalidGrant, revoked["error"])
}

// A poll only means to stamp last_polled_at. Reading a copy and saving it back
// wholesale used to overwrite an approval that landed in between, losing the
// approval and orphaning the unlimited key it had just created.
func TestDeviceAuthPollDoesNotClobberApproval(t *testing.T) {
	user := setupDeviceAuthTest(t)
	deviceCode, userCode := requestDeviceCode(t)

	stale, err := service.GetDeviceAuthByDeviceCode(deviceCode)
	require.NoError(t, err)
	require.Equal(t, service.DeviceAuthStatusPending, stale.Status)

	_, approved := postJSON(t, ApproveDeviceAuth, "/api/device/approve", `{"user_code":"`+userCode+`","approve":true}`, user.Id)
	require.Equal(t, true, approved["success"], approved["message"])

	// The poll that started before the approval finishes after it: it must observe
	// the approval rather than write its own stale pending snapshot back.
	polled, _, err := service.PollDeviceAuthRequest(deviceCode)
	require.NoError(t, err)
	assert.Equal(t, service.DeviceAuthStatusApproved, polled.Status)
	assert.Equal(t, user.Id, polled.UserId)
	assert.NotZero(t, polled.RelayTokenId)
}

// Two browser tabs (or a double-clicked button) must not each mint an unlimited
// desktop key; only the caller that claims the request may create one.
func TestDeviceAuthDoubleApprovalMintsOneKey(t *testing.T) {
	user := setupDeviceAuthTest(t)
	_, userCode := requestDeviceCode(t)

	body := `{"user_code":"` + userCode + `","approve":true}`
	_, first := postJSON(t, ApproveDeviceAuth, "/api/device/approve", body, user.Id)
	require.Equal(t, true, first["success"], first["message"])

	_, second := postJSON(t, ApproveDeviceAuth, "/api/device/approve", body, user.Id)
	assert.Equal(t, false, second["success"])

	count, err := model.CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)
}

func TestDeviceAuthAccessTokenRejectsRefreshToken(t *testing.T) {
	setupDeviceAuthTest(t)
	user := &model.User{Id: 1, Username: "x", Email: "x@example.com"}

	access, refresh, expiresIn, err := service.IssueDesktopSession(user, 42)
	require.NoError(t, err)
	assert.Positive(t, expiresIn)

	_, err = service.ParseDesktopToken(refresh, service.DesktopTokenTypeAccess)
	assert.Error(t, err)
	_, err = service.ParseDesktopToken(access, service.DesktopTokenTypeRefresh)
	assert.Error(t, err)
}
