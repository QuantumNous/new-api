package controller

import (
	"net/http/httptest"
	"path/filepath"
	"strings"
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

func TestRegisterBindsAffiliateAgent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalMainDatabaseType, originalLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalRedisEnabled := common.RedisEnabled
	originalGenerateDefaultToken := constant.GenerateDefaultToken
	dsn := "file:" + filepath.Join(t.TempDir(), "agent-register.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AgentAccount{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	common.RedisEnabled = false
	constant.GenerateDefaultToken = false
	require.NoError(t, db.Create(&model.User{Id: 7301, Username: "agent-7301", AffCode: "agent-aff-7301"}).Error)
	require.NoError(t, db.Create(&model.AgentAccount{UserId: 7301, Status: model.AgentAccountStatusActive}).Error)
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		common.RedisEnabled = originalRedisEnabled
		constant.GenerateDefaultToken = originalGenerateDefaultToken
		sqlDB, dbErr := db.DB()
		require.NoError(t, dbErr)
		require.NoError(t, sqlDB.Close())
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/api/user/register", strings.NewReader(`{"username":"customer-7302","password":"password123","aff_code":"agent-aff-7301"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	Register(c)

	var response map[string]interface{}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, true, response["success"])
	var customer model.User
	require.NoError(t, db.Where("username = ?", "customer-7302").First(&customer).Error)
	assert.Equal(t, 7301, customer.BoundAgentId)
}
