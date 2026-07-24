package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInvitationControllerTestDB(t *testing.T) (*gorm.DB, *model.User) {
	t.Helper()
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldRedisEnabled := common.RedisEnabled
	oldMainDatabaseType := common.MainDatabaseType()
	oldLogDatabaseType := common.LogDatabaseType()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.InvitationCode{}, &model.User{}, &model.Log{}))
	admin := &model.User{
		Username: "invitation-admin",
		Password: "password",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(admin).Error)
	t.Cleanup(func() {
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.RedisEnabled = oldRedisEnabled
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
	})
	return db, admin
}

func invitationControllerContext(t *testing.T, method string, target string, body any, userID int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	payload, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, strings.NewReader(string(payload)))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", userID)
	ctx.Set("username", "invitation-admin")
	ctx.Set("role", common.RoleAdminUser)
	return ctx, recorder
}

func TestAddInvitationCodesReturnsPlaintextButNeverSerializesHash(t *testing.T) {
	db, admin := setupInvitationControllerTestDB(t)
	ctx, recorder := invitationControllerContext(t, http.MethodPost, "/api/invitation/", map[string]interface{}{
		"name":         "launch",
		"count":        2,
		"expired_time": 0,
	}, admin.Id)

	AddInvitationCodes(ctx)

	var response struct {
		Success bool     `json:"success"`
		Data    []string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	require.Len(t, response.Data, 2)
	assert.NotContains(t, recorder.Body.String(), "code_hash")

	var rows []model.InvitationCode
	require.NoError(t, db.Order("id").Find(&rows).Error)
	require.Len(t, rows, 2)
	for i, row := range rows {
		assert.Equal(t, model.HashInvitationCode(response.Data[i]), row.CodeHash)
		assert.NotEqual(t, response.Data[i], row.CodeHash)
	}

	var auditLogs []model.Log
	require.NoError(t, db.Where("type = ?", model.LogTypeManage).Find(&auditLogs).Error)
	require.NotEmpty(t, auditLogs)
	for _, rawCode := range response.Data {
		for _, auditLog := range auditLogs {
			assert.NotContains(t, auditLog.Content, rawCode)
			assert.NotContains(t, auditLog.Other, rawCode)
		}
	}
}

func TestAddInvitationCodesRejectsBatchOverLimit(t *testing.T) {
	_, admin := setupInvitationControllerTestDB(t)
	ctx, recorder := invitationControllerContext(t, http.MethodPost, "/api/invitation/", map[string]interface{}{
		"name":  "too-many",
		"count": 101,
	}, admin.Id)

	AddInvitationCodes(ctx)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
}

func TestAddInvitationCodesRejectsWhitespaceName(t *testing.T) {
	_, admin := setupInvitationControllerTestDB(t)
	ctx, recorder := invitationControllerContext(t, http.MethodPost, "/api/invitation/", map[string]interface{}{
		"name":  "   ",
		"count": 1,
	}, admin.Id)

	AddInvitationCodes(ctx)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
}

func TestDeleteUsedInvitationCodesReturnsDeletedCount(t *testing.T) {
	db, admin := setupInvitationControllerTestDB(t)
	now := common.GetTimestamp()
	require.NoError(t, db.Create(&[]model.InvitationCode{
		{Name: "used-1", CodeHash: model.HashInvitationCode("used-1"), CodePrefix: "INV-USE1", Status: common.InvitationCodeStatusUsed, CreatedTime: now},
		{Name: "used-2", CodeHash: model.HashInvitationCode("used-2"), CodePrefix: "INV-USE2", Status: common.InvitationCodeStatusUsed, CreatedTime: now},
		{Name: "enabled", CodeHash: model.HashInvitationCode("enabled"), CodePrefix: "INV-ENA1", Status: common.InvitationCodeStatusEnabled, CreatedTime: now},
	}).Error)
	ctx, recorder := invitationControllerContext(t, http.MethodDelete, "/api/invitation/used", nil, admin.Id)

	DeleteUsedInvitationCodes(ctx)

	var response struct {
		Success bool  `json:"success"`
		Data    int64 `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, int64(2), response.Data)

	var remaining int64
	require.NoError(t, db.Model(&model.InvitationCode{}).Count(&remaining).Error)
	assert.Equal(t, int64(1), remaining)
}
