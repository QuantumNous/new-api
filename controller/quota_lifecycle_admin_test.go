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

func TestQuotaLifecycleAdminAddQuotaModesDoNotRotateCycle(t *testing.T) {
	for _, tc := range []struct {
		name       string
		mode       string
		value      int
		initial    int
		wantQuota  int
		wantEvents int64
	}{
		{name: "add", mode: "add", value: 40, initial: 150, wantQuota: 190, wantEvents: 0},
		{name: "subtract", mode: "subtract", value: 60, initial: 150, wantQuota: 90, wantEvents: 1},
		{name: "override", mode: "override", value: 90, initial: 150, wantQuota: 90, wantEvents: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assertAdminQuotaLifecycleMutation(t, tc.mode, tc.value, tc.initial, tc.wantQuota, tc.wantEvents)
		})
	}
}

func assertAdminQuotaLifecycleMutation(t *testing.T, mode string, value int, initial int, wantQuota int, wantEvents int64) {
	t.Helper()
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

	userID := 501 + value
	user := model.User{
		Id:       userID,
		Username: "admin-quota-target-" + mode,
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Quota:    initial,
		AffCode:  "admin-quota-target-" + mode,
	}
	require.NoError(t, model.DB.Create(&user).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/manage", bytes.NewBufferString(`{"id":`+strconv.Itoa(user.Id)+`,"action":"add_quota","mode":"`+mode+`","value":`+strconv.Itoa(value)+`}`))
	ctx.Set("role", common.RoleAdminUser)
	ctx.Set("id", 1)
	ctx.Set("username", "admin")

	ManageUser(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var stored model.User
	require.NoError(t, model.DB.Where("id = ?", user.Id).First(&stored).Error)
	require.Equal(t, wantQuota, stored.Quota)

	var state model.QuotaLifecycleState
	require.NoError(t, model.DB.Where("user_id = ? AND scope_type = ? AND scope_id = ?", user.Id, model.QuotaLifecycleScopeWallet, strconv.Itoa(user.Id)).First(&state).Error)
	require.Equal(t, "baseline:wallet:"+strconv.Itoa(user.Id), state.Cycle)
	require.EqualValues(t, wantQuota, state.Balance)
	var eventCount int64
	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).Where("user_id = ?", user.Id).Count(&eventCount).Error)
	require.Equal(t, wantEvents, eventCount)
}
