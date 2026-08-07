package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestQuotaLifecycleAdminOverrideDoesNotRotateCycle(t *testing.T) {
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedis := common.RedisEnabled
	originalThreshold := common.QuotaRemindThreshold
	originalSQLite := common.UsingSQLite
	originalMySQL := common.UsingMySQL
	originalPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/admin-quota-lifecycle.db"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.QuotaRemindThreshold = 100
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.RecallLifecycleEvent{}, &model.QuotaLifecycleState{}))
	t.Cleanup(func() {
		_ = sqlDB.Close()
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedis
		common.QuotaRemindThreshold = originalThreshold
		common.UsingSQLite = originalSQLite
		common.UsingMySQL = originalMySQL
		common.UsingPostgreSQL = originalPostgreSQL
	})

	user := model.User{
		Id:       501,
		Username: "admin-quota-target",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Quota:    150,
		AffCode:  "admin-quota-target",
	}
	require.NoError(t, model.DB.Create(&user).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/manage", bytes.NewBufferString(`{"id":501,"action":"add_quota","mode":"override","value":90}`))
	ctx.Set("role", common.RoleAdminUser)
	ctx.Set("id", 1)
	ctx.Set("username", "admin")

	ManageUser(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var stored model.User
	require.NoError(t, model.DB.Where("id = ?", user.Id).First(&stored).Error)
	require.Equal(t, 90, stored.Quota)

	var state model.QuotaLifecycleState
	require.NoError(t, model.DB.Where("user_id = ? AND scope_type = ? AND scope_id = ?", user.Id, model.QuotaLifecycleScopeWallet, strconv.Itoa(user.Id)).First(&state).Error)
	require.Equal(t, "baseline:wallet:501", state.Cycle)
	require.EqualValues(t, 90, state.Balance)
	var eventCount int64
	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).Where("user_id = ?", user.Id).Count(&eventCount).Error)
	require.Equal(t, int64(1), eventCount)
}
