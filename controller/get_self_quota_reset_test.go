package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type getSelfQuotaResetAPIResponse struct {
	Success bool                       `json:"success"`
	Data    map[string]json.RawMessage `json:"data"`
}

type getSelfQuotaResetView struct {
	Period        string `json:"period"`
	ResetValue    int    `json:"reset_value"`
	NextResetTime int64  `json:"next_reset_time"`
}

func callGetSelfForQuotaReset(t *testing.T, userId int) *httptest.ResponseRecorder {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userId)
	ctx.Set("role", common.RoleCommonUser)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/self", nil)

	GetSelf(ctx)

	return recorder
}

func decodeGetSelfQuotaResetResponse(t *testing.T, recorder *httptest.ResponseRecorder) getSelfQuotaResetAPIResponse {
	t.Helper()
	var response getSelfQuotaResetAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestGetSelf_GlobalRuleEffective_ExposesQuotaReset(t *testing.T) {
	db := openQuotaResetNowTestDB(t)
	setQuotaResetNowGlobalRule(t, true, operation_setting.QuotaResetPeriodMonthly, 500000)
	user := createQuotaResetNowTestUser(t, db, "self_qr_global", 100, common.UserStatusEnabled, dto.UserSetting{})

	before := service.NextQuotaResetTime(operation_setting.QuotaResetPeriodMonthly, time.Now()).Unix()
	recorder := callGetSelfForQuotaReset(t, user.Id)
	after := service.NextQuotaResetTime(operation_setting.QuotaResetPeriodMonthly, time.Now()).Unix()

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeGetSelfQuotaResetResponse(t, recorder)
	assert.True(t, response.Success)

	raw, ok := response.Data["quota_reset"]
	require.True(t, ok, "expected quota_reset key to be present for user covered by global rule")

	var view getSelfQuotaResetView
	require.NoError(t, common.Unmarshal(raw, &view))
	assert.Equal(t, operation_setting.QuotaResetPeriodMonthly, view.Period)
	assert.Equal(t, 500000, view.ResetValue)
	assert.GreaterOrEqual(t, view.NextResetTime, before)
	assert.LessOrEqual(t, view.NextResetTime, after)
}

func TestGetSelf_ExclusiveRuleOverridesGlobal_ExposesExclusiveValues(t *testing.T) {
	db := openQuotaResetNowTestDB(t)
	setQuotaResetNowGlobalRule(t, true, operation_setting.QuotaResetPeriodMonthly, 500000)
	user := createQuotaResetNowTestUser(t, db, "self_qr_exclusive", 100, common.UserStatusEnabled, dto.UserSetting{
		QuotaResetRule: &dto.QuotaResetRule{Period: operation_setting.QuotaResetPeriodWeekly, Value: 100000},
	})

	before := service.NextQuotaResetTime(operation_setting.QuotaResetPeriodWeekly, time.Now()).Unix()
	recorder := callGetSelfForQuotaReset(t, user.Id)
	after := service.NextQuotaResetTime(operation_setting.QuotaResetPeriodWeekly, time.Now()).Unix()

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeGetSelfQuotaResetResponse(t, recorder)
	raw, ok := response.Data["quota_reset"]
	require.True(t, ok, "expected quota_reset key to be present for user covered by exclusive rule")

	var view getSelfQuotaResetView
	require.NoError(t, common.Unmarshal(raw, &view))
	assert.Equal(t, operation_setting.QuotaResetPeriodWeekly, view.Period)
	assert.Equal(t, 100000, view.ResetValue)
	assert.GreaterOrEqual(t, view.NextResetTime, before)
	assert.LessOrEqual(t, view.NextResetTime, after)
}

func TestGetSelf_OptedOutUser_OmitsQuotaResetKey(t *testing.T) {
	db := openQuotaResetNowTestDB(t)
	setQuotaResetNowGlobalRule(t, true, operation_setting.QuotaResetPeriodMonthly, 500000)
	user := createQuotaResetNowTestUser(t, db, "self_qr_optout", 100, common.UserStatusEnabled, dto.UserSetting{
		QuotaResetOptOut: true,
	})

	recorder := callGetSelfForQuotaReset(t, user.Id)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeGetSelfQuotaResetResponse(t, recorder)
	_, ok := response.Data["quota_reset"]
	assert.False(t, ok, "opted-out user must not have quota_reset key in response data")
}

func TestGetSelf_GlobalDisabledAndNoExclusiveRule_OmitsQuotaResetKey(t *testing.T) {
	db := openQuotaResetNowTestDB(t)
	setQuotaResetNowGlobalRule(t, false, operation_setting.QuotaResetPeriodMonthly, 500000)
	user := createQuotaResetNowTestUser(t, db, "self_qr_noglobal", 100, common.UserStatusEnabled, dto.UserSetting{})

	recorder := callGetSelfForQuotaReset(t, user.Id)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeGetSelfQuotaResetResponse(t, recorder)
	_, ok := response.Data["quota_reset"]
	assert.False(t, ok, "user with no effective rule must not have quota_reset key in response data")
}
