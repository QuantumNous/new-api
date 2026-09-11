package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type quotaResetNowAPIResponse struct {
	Success bool `json:"success"`
	Data    struct {
		ResetCount int `json:"reset_count"`
	} `json:"data"`
}

func openQuotaResetNowTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}))

	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func setQuotaResetNowGlobalRule(t *testing.T, enabled bool, period string, value int) {
	t.Helper()
	s := operation_setting.GetQuotaResetSetting()
	original := *s
	s.Enabled = enabled
	s.Period = period
	s.ResetValue = value
	t.Cleanup(func() { *s = original })
}

func createQuotaResetNowTestUser(t *testing.T, db *gorm.DB, username string, quota int, status int, setting dto.UserSetting) *model.User {
	t.Helper()

	user := &model.User{
		Username: username,
		Password: "placeholder-hash",
		Quota:    quota,
		Status:   status,
		AffCode:  "aff-" + username,
	}
	user.SetSetting(setting)
	require.NoError(t, db.Create(user).Error)
	return user
}

func fetchQuotaResetNowUser(t *testing.T, db *gorm.DB, id int) *model.User {
	t.Helper()
	var user model.User
	require.NoError(t, db.First(&user, "id = ?", id).Error)
	return &user
}

func fetchQuotaResetNowLogs(t *testing.T, db *gorm.DB, userId int) []model.Log {
	t.Helper()
	var logs []model.Log
	require.NoError(t, db.Where("user_id = ?", userId).Order("id").Find(&logs).Error)
	return logs
}

func postQuotaResetNow(t *testing.T, adminId int, adminRole int) *httptest.ResponseRecorder {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", adminId)
	ctx.Set("role", adminRole)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/quota_reset/run", nil)

	RunQuotaResetNow(ctx)

	return recorder
}

func decodeQuotaResetNowResponse(t *testing.T, recorder *httptest.ResponseRecorder) quotaResetNowAPIResponse {
	t.Helper()
	var response quotaResetNowAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestRunQuotaResetNow_MixedUsers_ResetsOnlyUsersWithEffectiveRule(t *testing.T) {
	db := openQuotaResetNowTestDB(t)
	admin := createQuotaResetNowTestUser(t, db, "admin_now1", 0, common.UserStatusEnabled, dto.UserSetting{})
	setQuotaResetNowGlobalRule(t, true, operation_setting.QuotaResetPeriodMonthly, 500000)

	globalUser := createQuotaResetNowTestUser(t, db, "member_now1", 123456, common.UserStatusEnabled, dto.UserSetting{})
	exclusiveUser := createQuotaResetNowTestUser(t, db, "member_now2", 50, common.UserStatusEnabled, dto.UserSetting{
		QuotaResetRule: &dto.QuotaResetRule{Period: operation_setting.QuotaResetPeriodWeekly, Value: 100000},
	})
	optedOutUser := createQuotaResetNowTestUser(t, db, "member_now3", 999, common.UserStatusEnabled, dto.UserSetting{QuotaResetOptOut: true})
	disabledUser := createQuotaResetNowTestUser(t, db, "member_now4", 888, common.UserStatusDisabled, dto.UserSetting{})

	recorder := postQuotaResetNow(t, admin.Id, common.RoleAdminUser)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeQuotaResetNowResponse(t, recorder)
	assert.True(t, response.Success)
	// 管理员自身也适用全局规则，与普通用户同口径参与重置
	assert.Equal(t, 3, response.Data.ResetCount)

	assert.Equal(t, 500000, fetchQuotaResetNowUser(t, db, admin.Id).Quota)
	assert.Equal(t, 500000, fetchQuotaResetNowUser(t, db, globalUser.Id).Quota)
	assert.Equal(t, 100000, fetchQuotaResetNowUser(t, db, exclusiveUser.Id).Quota)
	assert.Equal(t, 999, fetchQuotaResetNowUser(t, db, optedOutUser.Id).Quota)
	assert.Equal(t, 888, fetchQuotaResetNowUser(t, db, disabledUser.Id).Quota)

	globalLogs := fetchQuotaResetNowLogs(t, db, globalUser.Id)
	require.Len(t, globalLogs, 1)
	assert.Equal(t, model.LogTypeSystem, globalLogs[0].Type)
	assert.Equal(t, "额度重置（手动）：123456 -> 500000", globalLogs[0].Content)

	exclusiveLogs := fetchQuotaResetNowLogs(t, db, exclusiveUser.Id)
	require.Len(t, exclusiveLogs, 1)
	assert.Equal(t, "额度重置（手动）：50 -> 100000", exclusiveLogs[0].Content)

	assert.Empty(t, fetchQuotaResetNowLogs(t, db, optedOutUser.Id))
	assert.Empty(t, fetchQuotaResetNowLogs(t, db, disabledUser.Id))
}

func TestRunQuotaResetNow_DoesNotModifyGlobalRuleSetting(t *testing.T) {
	db := openQuotaResetNowTestDB(t)
	admin := createQuotaResetNowTestUser(t, db, "admin_now2", 0, common.UserStatusEnabled, dto.UserSetting{})
	setQuotaResetNowGlobalRule(t, true, operation_setting.QuotaResetPeriodWeekly, 300000)
	createQuotaResetNowTestUser(t, db, "member_now5", 10, common.UserStatusEnabled, dto.UserSetting{})

	before := *operation_setting.GetQuotaResetSetting()

	recorder := postQuotaResetNow(t, admin.Id, common.RoleAdminUser)
	require.Equal(t, http.StatusOK, recorder.Code)

	after := *operation_setting.GetQuotaResetSetting()
	assert.Equal(t, before, after)
}
