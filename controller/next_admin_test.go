package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func performNextAdminJSON(t *testing.T, method, target, body string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, target, strings.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")
	context.Set("id", 9999)
	context.Set("role", common.RoleRootUser)
	context.Set("username", "root-operator")
	handler(context)
	return recorder
}

func TestNextAdminUserCreateAndUpdateReturnPersistedContract(t *testing.T) {
	db := setupManageUserTestDB(t)

	created := decodeNextResponse[nextAdminUserDTO](t, performNextAdminJSON(
		t,
		http.MethodPost,
		"/api/next/admin/users",
		`{"username":"managed-user","display_name":"Managed","email":" USER@Example.COM ","password":"password123","role":1,"status":2}`,
		NextCreateAdminUser,
	))
	assert.Equal(t, "user@example.com", created.Email)
	assert.Equal(t, common.UserStatusDisabled, created.Status)

	var stored model.User
	require.NoError(t, db.First(&stored, created.ID).Error)
	assert.Equal(t, "user@example.com", stored.Email)
	assert.NotEqual(t, "password123", stored.Password)

	updated := decodeNextResponse[nextAdminUserDTO](t, performNextAdminJSON(
		t,
		http.MethodPut,
		"/api/next/admin/users",
		`{"id":`+strconv.Itoa(created.ID)+`,"username":"managed-user","display_name":"Operator","email":"operator@example.com","role":10}`,
		NextUpdateAdminUser,
	))
	assert.Equal(t, "Operator", updated.DisplayName)
	assert.Equal(t, "operator@example.com", updated.Email)
	assert.Equal(t, common.RoleAdminUser, updated.Role)
	assert.Equal(t, common.UserStatusDisabled, updated.Status)

	require.NoError(t, db.First(&stored, created.ID).Error)
	assert.Equal(t, common.RoleAdminUser, stored.Role)
	assert.Greater(t, stored.AuthVersion, int64(1))
}

func TestNextAdminBatchDeleteUsesExistingResources(t *testing.T) {
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.TwoFABackupCode{}, &model.TwoFA{}, &model.AuthFlow{},
		&model.PasskeyCredential{}, &model.Token{}, &model.ExternalIdentityClaim{},
		&model.UserOAuthBinding{}, &model.Redemption{},
	))
	users := []model.User{
		{Username: "delete-one", Password: "password", AffCode: "delete-one-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Username: "delete-two", Password: "password", AffCode: "delete-two-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
	}
	require.NoError(t, db.Create(&users).Error)

	deletedUsers := decodeNextResponse[int](t, performNextAdminJSON(
		t,
		http.MethodPost,
		"/api/next/admin/users/delete/batch",
		`{"ids":[`+strconv.Itoa(users[0].Id)+`,`+strconv.Itoa(users[1].Id)+`]}`,
		NextDeleteAdminUsersBatch,
	))
	assert.Equal(t, 2, deletedUsers)
	var userCount int64
	require.NoError(t, db.Unscoped().Model(&model.User{}).Where("id IN ?", []int{users[0].Id, users[1].Id}).Count(&userCount).Error)
	assert.Zero(t, userCount)

	redemptions := []model.Redemption{
		{Name: "$1.00", Key: "batch-code-one", Status: common.RedemptionCodeStatusEnabled},
		{Name: "$2.00", Key: "batch-code-two", Status: common.RedemptionCodeStatusDisabled},
	}
	require.NoError(t, db.Create(&redemptions).Error)
	deletedCodes := decodeNextResponse[int64](t, performNextAdminJSON(
		t,
		http.MethodPost,
		"/api/next/admin/redemptions/delete/batch",
		`{"ids":[`+strconv.Itoa(redemptions[0].Id)+`,`+strconv.Itoa(redemptions[1].Id)+`]}`,
		NextDeleteAdminRedemptionsBatch,
	))
	assert.Equal(t, int64(2), deletedCodes)
}

func TestNextAdminBatchDeleteIsAtomicForPrivilegedTargets(t *testing.T) {
	db := setupManageUserTestDB(t)
	users := []model.User{
		{Username: "delete-safe", Password: "password", AffCode: "delete-safe-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Username: "delete-root", Password: "password", AffCode: "delete-root-aff", Role: common.RoleRootUser, Status: common.UserStatusEnabled},
	}
	require.NoError(t, db.Create(&users).Error)

	recorder := performNextAdminJSON(
		t,
		http.MethodPost,
		"/api/next/admin/users/delete/batch",
		`{"ids":[`+strconv.Itoa(users[0].Id)+`,`+strconv.Itoa(users[1].Id)+`]}`,
		NextDeleteAdminUsersBatch,
	)
	var response struct {
		Success bool   `json:"success"`
		Code    string `json:"code"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Equal(t, "FORBIDDEN", response.Code)

	var count int64
	require.NoError(t, db.Model(&model.User{}).Where("id IN ?", []int{users[0].Id, users[1].Id}).Count(&count).Error)
	assert.Equal(t, int64(2), count)
}

func TestNextAdminQuotaUsesManagedTransactionAndBounds(t *testing.T) {
	db := setupManageUserTestDB(t)
	users := []model.User{
		{Username: "quota-user", Password: "password", AffCode: "quota-user-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Quota: 100},
		{Username: "quota-root", Password: "password", AffCode: "quota-root-aff", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Quota: 200},
	}
	require.NoError(t, db.Create(&users).Error)

	updated := decodeNextResponse[nextAdminUserDTO](t, performNextAdminJSON(
		t, http.MethodPost, "/api/next/admin/users/quota", `{"id":`+strconv.Itoa(users[0].Id)+`,"delta":25}`, NextAdminUserQuota,
	))
	assert.Equal(t, 125, updated.Quota)

	for _, body := range []string{
		`{"id":` + strconv.Itoa(users[1].Id) + `,"delta":25}`,
		`{"id":` + strconv.Itoa(users[0].Id) + `,"delta":2147483647}`,
	} {
		recorder := performNextAdminJSON(t, http.MethodPost, "/api/next/admin/users/quota", body, NextAdminUserQuota)
		var response struct {
			Success bool   `json:"success"`
			Code    string `json:"code"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		assert.False(t, response.Success)
		assert.Contains(t, []string{"FORBIDDEN", "VALIDATION_ERROR"}, response.Code)
	}

	var user model.User
	require.NoError(t, db.First(&user, users[0].Id).Error)
	assert.Equal(t, 125, user.Quota)
}

func TestNextAdminUserStatusBatchIsAtomicAndRevokesSessions(t *testing.T) {
	db := setupManageUserTestDB(t)
	now := time.Now().Unix()
	users := []model.User{
		{Username: "status-one", Password: "password", AffCode: "status-one-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Username: "status-two", Password: "password", AffCode: "status-two-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Username: "status-root", Password: "password", AffCode: "status-root-aff", Role: common.RoleRootUser, Status: common.UserStatusEnabled, AuthVersion: 1},
	}
	require.NoError(t, db.Create(&users).Error)
	for index := 0; index < 2; index++ {
		require.NoError(t, db.Create(&model.UserSession{
			SID: "status-session-" + strconv.Itoa(index), UserID: users[index].Id,
			Version: 1, UserAuthVersion: 1, Status: model.UserSessionStatusActive,
			RefreshHash: "status-refresh-" + strconv.Itoa(index), LoginMethod: "password",
			LastActiveAt: now, ExpiresAt: now + 3600,
		}).Error)
	}

	forbidden := performNextAdminJSON(
		t,
		http.MethodPost,
		"/api/next/admin/users/status/batch",
		`{"ids":[`+strconv.Itoa(users[0].Id)+`,`+strconv.Itoa(users[2].Id)+`],"status":2}`,
		NextAdminUserStatusBatch,
	)
	var forbiddenResponse nextTestResponse[int]
	require.NoError(t, common.Unmarshal(forbidden.Body.Bytes(), &forbiddenResponse))
	assert.False(t, forbiddenResponse.Success)
	var unchanged model.User
	require.NoError(t, db.First(&unchanged, users[0].Id).Error)
	assert.Equal(t, common.UserStatusEnabled, unchanged.Status)
	assert.Equal(t, int64(1), unchanged.AuthVersion)

	missing := performNextAdminJSON(
		t,
		http.MethodPost,
		"/api/next/admin/users/status/batch",
		`{"ids":[`+strconv.Itoa(users[0].Id)+`,999999],"status":2}`,
		NextAdminUserStatusBatch,
	)
	var missingResponse nextTestResponse[int]
	require.NoError(t, common.Unmarshal(missing.Body.Bytes(), &missingResponse))
	assert.False(t, missingResponse.Success)
	require.NoError(t, db.First(&unchanged, users[0].Id).Error)
	assert.Equal(t, common.UserStatusEnabled, unchanged.Status)

	changed := decodeNextResponse[int](t, performNextAdminJSON(
		t,
		http.MethodPost,
		"/api/next/admin/users/status/batch",
		`{"ids":[`+strconv.Itoa(users[0].Id)+`,`+strconv.Itoa(users[1].Id)+`,`+strconv.Itoa(users[0].Id)+`],"status":2}`,
		NextAdminUserStatusBatch,
	))
	assert.Equal(t, 2, changed)
	for index := 0; index < 2; index++ {
		var updated model.User
		require.NoError(t, db.First(&updated, users[index].Id).Error)
		assert.Equal(t, common.UserStatusDisabled, updated.Status)
		assert.Equal(t, int64(2), updated.AuthVersion)
		var session model.UserSession
		require.NoError(t, db.Where("user_id = ?", users[index].Id).First(&session).Error)
		assert.Equal(t, model.UserSessionStatusRevoked, session.Status)
	}
}
