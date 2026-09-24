package relay

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSensitiveBillingTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousCountToken := constant.CountToken
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(
		&model.User{}, &model.Token{}, &model.Log{}, &model.Option{},
		&model.SensitiveWordRule{}, &model.SensitiveWordRuleWord{}, &model.SensitiveWordRuleGroup{},
		&model.SensitiveWordPolicy{}, &model.SensitiveWordAuditEvent{},
	))
	model.DB, model.LOG_DB = database, database
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	constant.CountToken = false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		constant.CountToken = previousCountToken
		require.NoError(t, sqlDB.Close())
	})
	return database
}

func TestPrepareRequestBillingBlocksBeforeEstimateAndReservation(t *testing.T) {
	database := setupSensitiveBillingTest(t)
	require.NoError(t, model.MigrateSensitiveWordData())
	policy := model.GetSensitiveWordPolicy()
	policy.Enabled = true
	policy.CheckPrompt = true
	require.NoError(t, model.SaveSensitiveWordPolicy(policy, 1))
	_, err := model.UpsertSensitiveWordRuleWithMode(
		0, "billing boundary", []string{"billing-sensitive-marker"},
		model.SensitiveWordScopeGlobal, nil, 1, model.SensitiveWordModeBlock,
	)
	require.NoError(t, err)
	user := &model.User{
		Username: "billing-boundary-user", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", Quota: 9_000_000,
		UsedQuota: 321, AuthVersion: 1, AffCode: "billing-boundary-aff",
	}
	require.NoError(t, database.Create(user).Error)
	token := &model.Token{
		UserId: user.Id, Key: "billing-boundary-token", Name: "billing boundary token",
		Status: common.TokenStatusEnabled, RemainQuota: 8_000_000,
	}
	require.NoError(t, database.Create(token).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "billing-boundary-request")
	c.Set("username", user.Username)
	c.Set("token_name", token.Name)
	request := &dto.GeneralOpenAIRequest{
		Model:    "unpriced-model-must-not-be-reached",
		Messages: []dto.Message{{Role: "user", Content: "billing-sensitive-marker"}},
	}
	info := &relaycommon.RelayInfo{
		Request: request, UserId: user.Id, TokenId: token.Id,
		UsingGroup: "default", UserGroup: "default", TokenGroup: "default",
		OriginModelName: request.Model, RelayFormat: types.RelayFormatOpenAI,
	}

	apiErr := PrepareRequestBilling(c, info)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusUnprocessableEntity, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeSensitiveWordsDetected, apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.Zero(t, info.GetEstimatePromptTokens(), "estimation must not run after a local policy block")
	assert.Nil(t, info.Billing, "reservation must not run after a local policy block")

	var storedUser model.User
	var storedToken model.Token
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	require.NoError(t, database.First(&storedToken, token.Id).Error)
	assert.Equal(t, user.Quota, storedUser.Quota)
	assert.Equal(t, user.UsedQuota, storedUser.UsedQuota)
	assert.Equal(t, token.RemainQuota, storedToken.RemainQuota)
	assert.Equal(t, 1, storedUser.SensitiveWordViolationCount)
}

func TestPrepareRequestBillingReusesPreChannelSensitiveDecision(t *testing.T) {
	database := setupSensitiveBillingTest(t)
	require.NoError(t, model.MigrateSensitiveWordData())
	policy := model.GetSensitiveWordPolicy()
	policy.Enabled = true
	policy.CheckPrompt = true
	require.NoError(t, model.SaveSensitiveWordPolicy(policy, 1))
	_, err := model.UpsertSensitiveWordRuleWithMode(
		0, "pre-channel cache", []string{"pre-channel-sensitive-marker"},
		model.SensitiveWordScopeGlobal, nil, 1, model.SensitiveWordModeBlock,
	)
	require.NoError(t, err)
	user := &model.User{
		Username: "pre-channel-cache-user", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", Quota: 9_000_000,
		AuthVersion: 1, AffCode: "pre-channel-cache-aff",
	}
	require.NoError(t, database.Create(user).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "pre-channel-cache-request")
	c.Set("username", user.Username)
	request := &dto.GeneralOpenAIRequest{
		Model:    "unpriced-model-must-not-be-reached",
		Messages: []dto.Message{{Role: "user", Content: "pre-channel-sensitive-marker"}},
	}
	input := model.SensitiveCheckInput{
		RequestID: "pre-channel-cache-request", UserID: user.Id, Username: user.Username,
		GroupName: "default", ModelName: request.Model, Endpoint: c.Request.URL.Path,
		Protocol: string(types.RelayFormatOpenAI), Prompt: request.GetTokenCountMeta().CombineText,
	}
	preChannelResult, err := model.CheckSensitiveRequest(input)
	require.NoError(t, err)
	require.True(t, preChannelResult.Blocked)
	common.SetContextKey(c, constant.ContextKeySensitiveWordCheckResult, preChannelResult)

	info := &relaycommon.RelayInfo{
		Request: request, UserId: user.Id, UsingGroup: "default", UserGroup: "default", TokenGroup: "default",
		OriginModelName: request.Model, RelayFormat: types.RelayFormatOpenAI,
	}
	apiErr := PrepareRequestBilling(c, info)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusUnprocessableEntity, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeSensitiveWordsDetected, apiErr.GetErrorCode())
	assert.Zero(t, info.GetEstimatePromptTokens())

	var auditCount int64
	require.NoError(t, database.Model(&model.SensitiveWordAuditEvent{}).
		Where("request_id = ? AND user_id = ?", input.RequestID, user.Id).Count(&auditCount).Error)
	assert.Equal(t, int64(1), auditCount, "billing must reuse the pre-channel audit decision")
	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, 1, storedUser.SensitiveWordViolationCount)
}

func TestPrepareRequestBillingFailsClosedWhenObserveAuditCannotPersist(t *testing.T) {
	database := setupSensitiveBillingTest(t)
	require.NoError(t, model.MigrateSensitiveWordData())
	policy := model.GetSensitiveWordPolicy()
	policy.Enabled = true
	policy.CheckPrompt = true
	require.NoError(t, model.SaveSensitiveWordPolicy(policy, 1))
	_, err := model.UpsertSensitiveWordRuleWithMode(
		0, "observe audit boundary", []string{"observe-audit-failure-marker"},
		model.SensitiveWordScopeGlobal, nil, 1, model.SensitiveWordModeObserve,
	)
	require.NoError(t, err)
	user := &model.User{
		Username: "observe-audit-boundary-user", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", Quota: 9_000_000,
		AuthVersion: 1, AffCode: "observe-audit-boundary-aff",
	}
	require.NoError(t, database.Create(user).Error)
	triggerName := fmt.Sprintf("observe_audit_failure_%d", user.Id)
	require.NoError(t, database.Exec(fmt.Sprintf(
		"CREATE TRIGGER %s BEFORE INSERT ON sensitive_word_audit_events BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END",
		triggerName,
	)).Error)
	t.Cleanup(func() { _ = database.Exec("DROP TRIGGER " + triggerName).Error })

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "observe-audit-failure-request")
	c.Set("username", user.Username)
	request := &dto.GeneralOpenAIRequest{
		Model:    "unpriced-model-must-not-be-reached",
		Messages: []dto.Message{{Role: "user", Content: "observe-audit-failure-marker"}},
	}
	info := &relaycommon.RelayInfo{
		Request: request, UserId: user.Id, UsingGroup: "default", UserGroup: "default", TokenGroup: "default",
		OriginModelName: request.Model, RelayFormat: types.RelayFormatOpenAI,
	}

	apiErr := PrepareRequestBilling(c, info)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.Zero(t, info.GetEstimatePromptTokens())
	assert.Nil(t, info.Billing)
}
