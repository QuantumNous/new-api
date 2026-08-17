package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBuildOperationLogDTOExposesOnlyAuditContract(t *testing.T) {
	log := &model.Log{
		Id:        12,
		UserId:    3,
		Username:  "stored-admin",
		CreatedAt: 1234,
		Type:      model.LogTypeManage,
		Content:   "Updated user alice",
		Ip:        "203.0.113.9",
		Other: common.MapToJsonStr(map[string]interface{}{
			"op": map[string]interface{}{
				"action": "user.update",
				"params": map[string]interface{}{
					"target_user_id": 7,
					"username":       "alice",
					"password":       "must-not-leak",
					"nested": map[string]interface{}{
						"access_token": "must-not-leak",
						"status":       "active",
					},
				},
			},
			"admin_info": map[string]interface{}{
				"admin_id": 3, "admin_username": "root", "admin_role": 100, "auth_method": "session",
			},
			"audit_info": map[string]interface{}{
				"method": "PUT", "route": "/api/user/", "path": "/api/user/", "status": 200, "success": true,
				"user_agent":   "Audit Browser/1.0",
				"request_body": map[string]interface{}{"password": "must-not-leak"},
			},
			"secret": "must-not-leak",
		}),
	}

	dto := buildOperationLogDTO(log)
	assert.Equal(t, "manage", dto.Kind)
	assert.Equal(t, "user.update", dto.Action)
	assert.Equal(t, "root", dto.Actor.Username)
	require.NotNil(t, dto.Actor.Role)
	assert.Equal(t, 100, *dto.Actor.Role)
	assert.Equal(t, "203.0.113.9", dto.Ip)
	assert.Equal(t, "Audit Browser/1.0", dto.UserAgent)
	require.NotNil(t, dto.Request)
	assert.Equal(t, "PUT", dto.Request.Method)
	require.NotNil(t, dto.Request.Success)
	assert.True(t, *dto.Request.Success)
	assert.NotContains(t, dto.Params, "request_body")
	assert.NotContains(t, dto.Params, "password")
	nested, ok := dto.Params["nested"].(map[string]interface{})
	require.True(t, ok)
	assert.NotContains(t, nested, "access_token")
	assert.Equal(t, "active", nested["status"])
}

func TestBuildOperationLogDTOHandlesLoginAndLegacySystemRows(t *testing.T) {
	login := buildOperationLogDTO(&model.Log{
		Type: model.LogTypeLogin, UserId: 9, Username: "alice", Content: "Logged in", Ip: "198.51.100.3",
		Other: common.MapToJsonStr(map[string]interface{}{
			"op":           map[string]interface{}{"action": "login", "params": map[string]interface{}{"method": "password"}},
			"login_method": "password", "user_role": 1, "user_agent": "Browser/1.0",
		}),
	})
	assert.Equal(t, "login", login.Kind)
	assert.Equal(t, "password", login.Actor.AuthMethod)
	require.NotNil(t, login.Actor.Role)
	assert.Equal(t, 1, *login.Actor.Role)
	assert.Equal(t, "Browser/1.0", login.UserAgent)

	legacy := buildOperationLogDTO(&model.Log{Type: model.LogTypeSystem, UserId: 10, Username: "bob", Content: "legacy system event"})
	assert.Equal(t, "system", legacy.Kind)
	assert.Empty(t, legacy.Action)
	assert.Nil(t, legacy.Request)
	assert.Equal(t, "legacy system event", legacy.Content)
}

func TestManualManageAuditWritesOneLogAndMarksRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec("CREATE TABLE users (id integer primary key, username text)").Error)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Exec("INSERT INTO users (id, username) VALUES (?, ?)", 3, "root").Error)

	previousDB, previousLogDB := model.DB, model.LOG_DB
	model.DB, model.LOG_DB = db, db
	t.Cleanup(func() { model.DB, model.LOG_DB = previousDB, previousLogDB })

	request := httptest.NewRequest(http.MethodPut, "/api/user/", nil)
	request.Header.Set("User-Agent", "Audit Browser/2.0")
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = request
	context.Set("id", 3)
	context.Set("username", "root")
	context.Set("role", 100)

	recordManageAuditFor(context, 7, "user.update", map[string]interface{}{"username": "alice"})
	assert.True(t, common.GetContextKeyBool(context, constant.ContextKeyAuditLogged))

	var count int64
	require.NoError(t, db.Model(&model.Log{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)

	var recorded model.Log
	require.NoError(t, db.First(&recorded).Error)
	other, err := common.StrToMap(recorded.Other)
	require.NoError(t, err)
	auditInfo := operationLogMap(other["audit_info"])
	assert.Equal(t, true, auditInfo["success"])
	assert.Equal(t, "PUT", auditInfo["method"])
	assert.Equal(t, "Audit Browser/2.0", auditInfo["user_agent"])
	assert.Equal(t, float64(100), auditInfo["actor_role"])
	assert.Equal(t, "session", auditInfo["auth_method"])
}
