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

type quotaResetRuleAPIResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func openQuotaResetRuleTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))

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

func createQuotaResetRuleTestUser(t *testing.T, db *gorm.DB, username string, role int, setting string) *model.User {
	t.Helper()

	user := &model.User{
		Username: username,
		Password: "placeholder-hash",
		Role:     role,
		Setting:  setting,
		AffCode:  "aff-" + username,
	}
	require.NoError(t, db.Create(user).Error)
	return user
}

func fetchQuotaResetRuleSetting(t *testing.T, db *gorm.DB, userId int) map[string]interface{} {
	t.Helper()

	var user model.User
	require.NoError(t, db.First(&user, "id = ?", userId).Error)

	setting := map[string]interface{}{}
	if user.Setting != "" {
		require.NoError(t, common.Unmarshal([]byte(user.Setting), &setting))
	}
	return setting
}

func decodeQuotaResetRuleResponse(t *testing.T, recorder *httptest.ResponseRecorder) quotaResetRuleAPIResponse {
	t.Helper()

	var response quotaResetRuleAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func postQuotaResetRule(t *testing.T, operatorId int, operatorRole int, body string) *httptest.ResponseRecorder {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", operatorId)
	ctx.Set("role", operatorRole)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/quota_reset_rule", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateUserQuotaResetRule(ctx)

	return recorder
}

func TestUpdateUserQuotaResetRule_AdminSetsRuleForCommonUser(t *testing.T) {
	db := openQuotaResetRuleTestDB(t)
	admin := createQuotaResetRuleTestUser(t, db, "admin1", common.RoleAdminUser, "")
	target := createQuotaResetRuleTestUser(t, db, "member1", common.RoleCommonUser, "")

	body := fmt.Sprintf(`{"user_id":%d,"rule":{"period":"weekly","value":100000},"opt_out":false}`, target.Id)
	recorder := postQuotaResetRule(t, admin.Id, common.RoleAdminUser, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeQuotaResetRuleResponse(t, recorder)
	assert.True(t, response.Success)

	setting := fetchQuotaResetRuleSetting(t, db, target.Id)
	rule, ok := setting["quota_reset_rule"].(map[string]interface{})
	require.True(t, ok, "expected quota_reset_rule to be present in target user setting")
	assert.Equal(t, "weekly", rule["period"])
	assert.EqualValues(t, 100000, rule["value"])
}

func TestUpdateUserQuotaResetRule_NullRuleClearsField(t *testing.T) {
	db := openQuotaResetRuleTestDB(t)
	admin := createQuotaResetRuleTestUser(t, db, "admin2", common.RoleAdminUser, "")
	target := createQuotaResetRuleTestUser(t, db, "member2", common.RoleCommonUser,
		`{"quota_reset_rule":{"period":"daily","value":50}}`)

	body := fmt.Sprintf(`{"user_id":%d,"rule":null,"opt_out":false}`, target.Id)
	recorder := postQuotaResetRule(t, admin.Id, common.RoleAdminUser, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeQuotaResetRuleResponse(t, recorder)
	assert.True(t, response.Success)

	setting := fetchQuotaResetRuleSetting(t, db, target.Id)
	_, exists := setting["quota_reset_rule"]
	assert.False(t, exists, "expected quota_reset_rule field to be absent after clearing with null")
}

func TestUpdateUserQuotaResetRule_InvalidRuleRejected(t *testing.T) {
	tests := []struct {
		name   string
		period string
		value  int
	}{
		{"unsupported period rejected", "hourly", 100},
		{"negative value rejected", "daily", -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := openQuotaResetRuleTestDB(t)
			admin := createQuotaResetRuleTestUser(t, db, "admin3", common.RoleAdminUser, "")
			target := createQuotaResetRuleTestUser(t, db, "member3", common.RoleCommonUser,
				`{"quota_reset_rule":{"period":"daily","value":50}}`)

			body := fmt.Sprintf(`{"user_id":%d,"rule":{"period":%q,"value":%d},"opt_out":false}`, target.Id, tt.period, tt.value)
			recorder := postQuotaResetRule(t, admin.Id, common.RoleAdminUser, body)

			require.Equal(t, http.StatusOK, recorder.Code)
			response := decodeQuotaResetRuleResponse(t, recorder)
			assert.False(t, response.Success)

			setting := fetchQuotaResetRuleSetting(t, db, target.Id)
			rule, ok := setting["quota_reset_rule"].(map[string]interface{})
			require.True(t, ok, "expected original quota_reset_rule to remain untouched")
			assert.Equal(t, "daily", rule["period"])
			assert.EqualValues(t, 50, rule["value"])
		})
	}
}

func TestUpdateUserQuotaResetRule_AdminCannotOperateOnRootUser(t *testing.T) {
	db := openQuotaResetRuleTestDB(t)
	admin := createQuotaResetRuleTestUser(t, db, "admin4", common.RoleAdminUser, "")
	root := createQuotaResetRuleTestUser(t, db, "root4", common.RoleRootUser, "")

	body := fmt.Sprintf(`{"user_id":%d,"rule":{"period":"weekly","value":100000},"opt_out":false}`, root.Id)
	recorder := postQuotaResetRule(t, admin.Id, common.RoleAdminUser, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeQuotaResetRuleResponse(t, recorder)
	assert.False(t, response.Success)

	setting := fetchQuotaResetRuleSetting(t, db, root.Id)
	_, exists := setting["quota_reset_rule"]
	assert.False(t, exists, "admin below root must not be able to write root user's setting")
}

func TestUpdateUserQuotaResetRule_AdminSetsOptOut(t *testing.T) {
	db := openQuotaResetRuleTestDB(t)
	admin := createQuotaResetRuleTestUser(t, db, "admin5", common.RoleAdminUser, "")
	target := createQuotaResetRuleTestUser(t, db, "member5", common.RoleCommonUser, "")

	body := fmt.Sprintf(`{"user_id":%d,"rule":null,"opt_out":true}`, target.Id)
	recorder := postQuotaResetRule(t, admin.Id, common.RoleAdminUser, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeQuotaResetRuleResponse(t, recorder)
	assert.True(t, response.Success)

	setting := fetchQuotaResetRuleSetting(t, db, target.Id)
	optOut, _ := setting["quota_reset_opt_out"].(bool)
	assert.True(t, optOut)
}

func TestUpdateUserQuotaResetRule_AdminCannotOperateOnPeerAdmin(t *testing.T) {
	db := openQuotaResetRuleTestDB(t)
	admin := createQuotaResetRuleTestUser(t, db, "admin6", common.RoleAdminUser, "")
	peer := createQuotaResetRuleTestUser(t, db, "admin7", common.RoleAdminUser, "")

	body := fmt.Sprintf(`{"user_id":%d,"rule":{"period":"weekly","value":100000},"opt_out":false}`, peer.Id)
	recorder := postQuotaResetRule(t, admin.Id, common.RoleAdminUser, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeQuotaResetRuleResponse(t, recorder)
	assert.False(t, response.Success)

	setting := fetchQuotaResetRuleSetting(t, db, peer.Id)
	_, exists := setting["quota_reset_rule"]
	assert.False(t, exists, "admin must not be able to write a peer admin's setting")
}

func TestUpdateUserSetting_PreservesQuotaResetFields(t *testing.T) {
	db := openQuotaResetRuleTestDB(t)
	user := createQuotaResetRuleTestUser(t, db, "selfservice3", common.RoleCommonUser,
		`{"quota_reset_rule":{"period":"weekly","value":100000},"quota_reset_opt_out":true}`)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", user.Id)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/user/setting",
		strings.NewReader(`{"notify_type":"email","quota_warning_threshold":1}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateUserSetting(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)

	setting := fetchQuotaResetRuleSetting(t, db, user.Id)
	rule, ok := setting["quota_reset_rule"].(map[string]interface{})
	require.True(t, ok, "quota_reset_rule must survive a self-service notify settings save")
	assert.Equal(t, "weekly", rule["period"])
	assert.EqualValues(t, 100000, rule["value"])
	optOut, _ := setting["quota_reset_opt_out"].(bool)
	assert.True(t, optOut, "quota_reset_opt_out must survive a self-service notify settings save")
}

func TestUpdateUserSetting_CannotSetQuotaResetOptOut(t *testing.T) {
	db := openQuotaResetRuleTestDB(t)
	user := createQuotaResetRuleTestUser(t, db, "selfservice1", common.RoleCommonUser, "")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", user.Id)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/user/setting",
		strings.NewReader(`{"notify_type":"email","quota_warning_threshold":1,"quota_reset_opt_out":true}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateUserSetting(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)

	setting := fetchQuotaResetRuleSetting(t, db, user.Id)
	optOut, _ := setting["quota_reset_opt_out"].(bool)
	assert.False(t, optOut, "self-service PUT /api/user/setting must not be able to set quota_reset_opt_out")
}

func TestUpdateSelf_CannotSetQuotaResetOptOut(t *testing.T) {
	db := openQuotaResetRuleTestDB(t)
	user := createQuotaResetRuleTestUser(t, db, "selfservice2", common.RoleCommonUser, "")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", user.Id)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/user/self",
		strings.NewReader(`{"sidebar_modules":"{}","quota_reset_opt_out":true}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)

	setting := fetchQuotaResetRuleSetting(t, db, user.Id)
	optOut, _ := setting["quota_reset_opt_out"].(bool)
	assert.False(t, optOut, "self-service PUT /api/user/self must not be able to set quota_reset_opt_out")
}
