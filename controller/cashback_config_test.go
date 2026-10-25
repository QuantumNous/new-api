package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCashbackConfigControllerTest(t *testing.T) {
	t.Helper()
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldType := common.MainDatabaseType()
	oldPayment := *operation_setting.GetPaymentSetting()
	oldCashback := *operation_setting.GetCashbackSetting()
	oldRedis := common.RedisEnabled
	common.OptionMapRWMutex.Lock()
	oldOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.User{}, &model.TopUp{}, &model.CashbackCampaign{}, &model.CashbackOrderContext{}, &model.EpayPaymentEvidence{}, &model.Log{}, &model.AuditLog{}))
	model.DB, model.LOG_DB = db, db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	admin := model.User{Username: "cashback-config-admin", Password: "password", Status: common.UserStatusEnabled, Role: common.RoleRootUser}
	require.NoError(t, db.Create(&admin).Error)

	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.SetMainDatabaseType(oldType)
		common.RedisEnabled = oldRedis
		*operation_setting.GetPaymentSetting() = oldPayment
		*operation_setting.GetCashbackSetting() = oldCashback
		common.OptionMapRWMutex.Lock()
		common.OptionMap = oldOptionMap
		common.OptionMapRWMutex.Unlock()
	})
}

func TestCashbackRewardListItemPreservesFixedStrategyAndLegacyRate(t *testing.T) {
	for _, tc := range []struct {
		name            string
		reward          model.CashbackReward
		strategy        string
		fixedPerHundred int
		rateBPS         int
	}{
		{name: "fixed per hundred", reward: model.CashbackReward{Strategy: "per_hundred", FixedPerHundred: 6, RateBPS: 0}, strategy: "per_hundred", fixedPerHundred: 6},
		{name: "historical rate", reward: model.CashbackReward{RateBPS: 1250}, rateBPS: 1250},
	} {
		t.Run(tc.name, func(t *testing.T) {
			item := cashbackRewardToListItem(&tc.reward)
			encoded, err := common.Marshal(item)
			require.NoError(t, err)
			var wire struct {
				Strategy        string `json:"strategy"`
				FixedPerHundred int    `json:"fixed_per_hundred"`
				RateBPS         int    `json:"rate_bps"`
			}
			require.NoError(t, common.Unmarshal(encoded, &wire))
			assert.Equal(t, tc.strategy, wire.Strategy)
			assert.Equal(t, tc.fixedPerHundred, wire.FixedPerHundred)
			assert.Equal(t, tc.rateBPS, wire.RateBPS)
		})
	}
}

const validCashbackConfigJSON = `{
	"inviter_enabled":false,"invitee_enabled":false,
	"inviter_rate_bps":0,"invitee_rate_bps":0,
	"settlement_days":7,"max_reward_quota":1000,"daily_reward_quota":5000,
	"ip_account_threshold":3,"device_account_threshold":2,"daily_topup_count_threshold":5
}`

func runCashbackConfigUpdate(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodPut, "/api/cashback/config", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request
	context.Set("id", 1)
	context.Set("username", "cashback-config-admin")
	context.Set("role", common.RoleRootUser)
	UpdateCashbackConfig(context)
	return recorder
}

func TestRecordedSpendRejectsInvalidCurrencyConfirmations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	for _, query := range []string{
		"confirm_cny_top_up_id=0", "confirm_cny_top_up_id=abc",
		"confirm_cny_top_up_id=1&confirm_cny_top_up_id=1",
		"confirm_cny_top_up_id=123", // No such order for this user.
	} {
		t.Run(query, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/api/cashback/users/1/recorded-spend?start_at=100&end_at=200&"+query, nil)
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Params = gin.Params{{Key: "id", Value: "1"}}
			context.Request = request
			GetCashbackRecordedSpend(context)
			assert.Equal(t, http.StatusBadRequest, recorder.Code)
		})
	}
}

func TestRecordedSpendConfirmsOutsideWindowAndAudits(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	payer := model.User{Username: "report-outside-payer", AffCode: "report-outside-payer", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&payer).Error)
	order := model.TopUp{UserId: payer.Id, TradeNo: "report-outside-epay", Amount: 100, Status: common.TopUpStatusSuccess, CompleteTime: 100, PaymentProvider: model.PaymentProviderEpay}
	require.NoError(t, model.DB.Create(&order).Error)
	require.NoError(t, model.DB.Create(&model.CashbackOrderContext{TopUpID: order.Id, UserID: payer.Id, TradeNo: order.TradeNo, PaymentProvider: model.PaymentProviderEpay, BaseQuota: 100, CreditedQuota: 100, DeviceSignalStatus: model.CashbackDeviceSignalMissing, CompletionSource: model.CashbackCompletionProviderCallback, CompletionProvider: model.PaymentProviderEpay}).Error)
	require.NoError(t, model.DB.Create(&model.EpayPaymentEvidence{TopUpID: order.Id, TradeNo: order.TradeNo, GatewayTradeNo: "gateway", MerchantID: "merchant", PaidCents: 10000, Source: model.CashbackCompletionProviderCallback, VerifiedAt: order.CompleteTime}).Error)
	request := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/cashback/users/%d/recorded-spend?start_at=200&end_at=300&confirm_cny_top_up_id=%d", payer.Id, order.Id), nil)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Params = gin.Params{{Key: "id", Value: fmt.Sprint(payer.Id)}}
	context.Request = request
	context.Set("id", 1)
	context.Set("username", "cashback-config-admin")
	GetCashbackRecordedSpend(context)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"refund_status":"manual_reconciliation"`)
	assert.Contains(t, recorder.Body.String(), `"top_ups":[]`)
	var audit []model.AuditLog
	require.NoError(t, model.DB.Where("action = ?", "cashback.recorded_spend_view").Find(&audit).Error)
	require.Len(t, audit, 1)
	require.NotNil(t, audit[0].Other.Op)
	assert.Contains(t, fmt.Sprint(audit[0].Other.Op.Params["confirmed_cny_top_up_ids"]), fmt.Sprint(order.Id))
}

func TestUpdateCashbackConfigPreservesFirstEnableBoundary(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)

	first := runCashbackConfigUpdate(t, `{
		"inviter_enabled":true,"invitee_enabled":false,
		"inviter_rate_bps":1000,"invitee_rate_bps":0,
		"settlement_days":7,"max_reward_quota":1000,"daily_reward_quota":5000,
		"ip_account_threshold":3,"device_account_threshold":2,"daily_topup_count_threshold":5
	}`)
	assert.Equal(t, http.StatusOK, first.Code)
	stored, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	require.Positive(t, stored.FirstEnabledAt)
	firstEnabledAt := stored.FirstEnabledAt
	assert.EqualValues(t, 1, stored.Version)

	second := runCashbackConfigUpdate(t, `{
		"inviter_enabled":false,"invitee_enabled":false,
		"inviter_rate_bps":0,"invitee_rate_bps":0,
		"settlement_days":14,"max_reward_quota":0,"daily_reward_quota":0,
		"ip_account_threshold":4,"device_account_threshold":3,"daily_topup_count_threshold":8,
		"first_enabled_at":0,"version":0
	}`)
	assert.Equal(t, http.StatusOK, second.Code)
	stored, err = model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Equal(t, firstEnabledAt, stored.FirstEnabledAt)
	assert.EqualValues(t, 2, stored.Version)
}

func TestUpdateCashbackConfigPreservesReviewPolicyForOldClients(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	current, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.False(t, current.AutoReviewEnabled)
	assert.Nil(t, current.AutoReviewRiskFlags)
	assert.True(t, current.AutoReviewImmediateIssue)

	body := `{"inviter_enabled":false,"invitee_enabled":false,"inviter_rate_bps":0,"invitee_rate_bps":0,
		"settlement_days":7,"max_reward_quota":1000,"daily_reward_quota":5000,
		"ip_account_threshold":3,"device_account_threshold":2,"daily_topup_count_threshold":5,
		"auto_review_enabled":true,"medium_review_required":true,"high_review_required":false,"auto_review_immediate_issue":false}`
	response := runCashbackConfigUpdate(t, body)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	current, err = model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.True(t, current.AutoReviewEnabled)
	assert.Nil(t, current.AutoReviewRiskFlags)
	assert.False(t, current.AutoReviewImmediateIssue)
	response = runCashbackConfigUpdate(t, validCashbackConfigJSON)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	stored, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Equal(t, current.AutoReviewEnabled, stored.AutoReviewEnabled)
	assert.Nil(t, stored.AutoReviewRiskFlags)
	var absent int64
	require.NoError(t, model.DB.Model(&model.Option{}).Where(map[string]any{"key": "cashback_setting.auto_review_risk_flags"}).Count(&absent).Error)
	assert.Zero(t, absent)
	assert.Equal(t, current.AutoReviewImmediateIssue, stored.AutoReviewImmediateIssue)
}

func TestCashbackConfigRiskFlagsExplicitActivationAndValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	request := func(flags string) *httptest.ResponseRecorder {
		return runCashbackConfigUpdate(t, strings.Replace(validCashbackConfigJSON, `"inviter_rate_bps":0,`, `"inviter_rate_bps":0,"auto_review_risk_flags":`+flags+`,`, 1))
	}
	require.Equal(t, http.StatusOK, request(`[]`).Code)
	stored, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	require.NotNil(t, stored.AutoReviewRiskFlags)
	assert.Empty(t, stored.AutoReviewRiskFlags)
	require.Equal(t, http.StatusOK, request(`["user_agent_changed","login_ip_mismatch"]`).Code)
	// A pre-upgrade client still sends the legacy switches but omits the new policy.
	require.Equal(t, http.StatusOK, runCashbackConfigUpdate(t, strings.Replace(validCashbackConfigJSON,
		`"inviter_rate_bps":0,`, `"inviter_rate_bps":0,"high_review_required":false,"severe_review_required":false,`, 1)).Code)
	stored, err = model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Equal(t, []string{"login_ip_mismatch", "user_agent_changed"}, stored.AutoReviewRiskFlags)
	getRecorder := httptest.NewRecorder()
	getContext, _ := gin.CreateTestContext(getRecorder)
	getContext.Request = httptest.NewRequest(http.MethodGet, "/api/cashback/config", nil)
	GetCashbackConfig(getContext)
	require.Equal(t, http.StatusOK, getRecorder.Code)
	var getResponse struct {
		Data struct {
			AutoReviewRiskFlags          []string `json:"auto_review_risk_flags"`
			AvailableAutoReviewRiskFlags []string `json:"available_auto_review_risk_flags"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(getRecorder.Body.Bytes(), &getResponse))
	assert.Equal(t, stored.AutoReviewRiskFlags, getResponse.Data.AutoReviewRiskFlags)
	assert.Len(t, getResponse.Data.AvailableAutoReviewRiskFlags, 23)
	assert.NotContains(t, getRecorder.Body.String(), `"high_review_required"`)
	before := stored.Version
	for _, flags := range []string{`null`, `"new_account"`, `{}`, `["unknown"]`, `["device_missing","device_missing"]`, `[1]`, `[null]`, `[` + strings.Repeat(" ", operation_setting.CashbackMaxRiskFlagsJSONBytes) + `]`} {
		response := request(flags)
		assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
		assert.Contains(t, response.Body.String(), `"field":"auto_review_risk_flags"`)
	}
	stored, err = model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Equal(t, before, stored.Version)
	assert.Equal(t, []string{"login_ip_mismatch", "user_agent_changed"}, stored.AutoReviewRiskFlags)
}

func TestCashbackCampaignCreateAndStop(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	start := time.Now().Unix() + 60
	body := fmt.Sprintf(`{"start_at":%d,"end_at":%d,"max_rewards_per_user":1}`, start, start+3600)
	call := func(method, path, body string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
		t.Helper()
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest(method, path, bytes.NewBufferString(body))
		context.Set("id", 1)
		context.Set("role", common.RoleRootUser)
		context.Set("username", "cashback-config-admin")
		if path != "/api/cashback/campaigns" {
			context.Params = gin.Params{{Key: "id", Value: "1"}}
		}
		handler(context)
		return recorder
	}
	for _, invalid := range []string{
		fmt.Sprintf(`{"start_at":%d,"end_at":%d,"max_rewards_per_user":1,"payer_scope":"second_top_up"}`, start, start+3600),
		fmt.Sprintf(`{"start_at":%d,"end_at":%d,"max_rewards_per_user":2,"payer_scope":"first_top_up"}`, start, start+3600),
	} {
		response := call(http.MethodPost, "/api/cashback/campaigns", invalid, CreateCashbackCampaign)
		assert.Equal(t, http.StatusBadRequest, response.Code, invalid)
	}
	response := call(http.MethodPost, "/api/cashback/campaigns", body, CreateCashbackCampaign)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"status":"planned"`)
	assert.Contains(t, response.Body.String(), `"payer_scope":""`)
	response = call(http.MethodPost, "/api/cashback/campaigns", body, CreateCashbackCampaign)
	assert.Equal(t, http.StatusConflict, response.Code)
	response = call(http.MethodPost, "/api/cashback/campaigns/1/stop", "", StopCashbackCampaign)
	assert.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `"status":"ended"`)
	response = call(http.MethodPost, "/api/cashback/campaigns/1/stop", "", StopCashbackCampaign)
	assert.Equal(t, http.StatusOK, response.Code)
	firstTopUp := strings.Replace(body, `}`, `,"payer_scope":"first_top_up"}`, 1)
	response = call(http.MethodPost, "/api/cashback/campaigns", firstTopUp, CreateCashbackCampaign)
	assert.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `"payer_scope":"first_top_up"`)

	var audit []model.AuditLog
	require.NoError(t, model.LOG_DB.Where("action IN ?", []string{"cashback.campaign_create", "cashback.campaign_stop"}).Order("id").Find(&audit).Error)
	require.Len(t, audit, 4) // Successful create, stop, idempotent stop, replacement create.
	assert.Equal(t, "cashback.campaign_create", audit[0].Action)
	assert.Equal(t, "cashback.campaign_stop", audit[1].Action)
	assert.Equal(t, "cashback.campaign_stop", audit[2].Action)
	assert.Equal(t, "cashback.campaign_create", audit[3].Action)
	for _, event := range audit {
		assert.Equal(t, 1, event.UserId)
		assert.Equal(t, common.RoleRootUser, event.ActorRole)
		assert.True(t, event.Success)
	}
}

func TestUpdateCashbackConfigMalformedJSONReturnsStableConfigField(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)

	response := runCashbackConfigUpdate(t, `{"inviter_enabled":`)

	assert.Equal(t, http.StatusBadRequest, response.Code)
	assert.JSONEq(t, `{"success":false,"message":"invalid cashback configuration","field":"config"}`, response.Body.String())
}

func TestUpdateCashbackConfigRejectsIncompleteReplacementWithoutMutation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, testCase := range []struct {
		name         string
		body         string
		missingField string
	}{
		{
			name: "boolean",
			body: `{
				"invitee_enabled":false,
				"inviter_rate_bps":0,"invitee_rate_bps":0,
				"settlement_days":7,"max_reward_quota":1000,"daily_reward_quota":5000,
				"ip_account_threshold":3,"device_account_threshold":2,"daily_topup_count_threshold":5
			}`,
			missingField: "inviter_enabled",
		},
		{
			name: "numeric",
			body: `{
				"inviter_enabled":false,"invitee_enabled":false,
				"inviter_rate_bps":0,"invitee_rate_bps":0,
				"settlement_days":7,"max_reward_quota":1000,"daily_reward_quota":5000,
				"ip_account_threshold":3,"device_account_threshold":2
			}`,
			missingField: "daily_topup_count_threshold",
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			setupCashbackConfigControllerTest(t)
			before, err := model.GetCashbackSettingFromDB()
			require.NoError(t, err)

			response := runCashbackConfigUpdate(t, testCase.body)

			assert.Equal(t, http.StatusBadRequest, response.Code)
			assert.Contains(t, response.Body.String(), `"field":"`+testCase.missingField+`"`)
			after, err := model.GetCashbackSettingFromDB()
			require.NoError(t, err)
			assert.Equal(t, before, after)
		})
	}
}

func TestUpdateCashbackConfigRejectsTrailingJSONWithoutMutation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	before, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)

	response := runCashbackConfigUpdate(t, validCashbackConfigJSON+` {"extra":true}`)

	assert.Equal(t, http.StatusBadRequest, response.Code)
	assert.Contains(t, response.Body.String(), `"field":"config"`)
	after, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Equal(t, before, after)
}

func TestCashbackConfigStrategyUpdatesAreAtomicAndOldClientsPreserveStrategy(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	body := strings.Replace(validCashbackConfigJSON, `"inviter_rate_bps":0,`, `"inviter_rate_bps":0,"inviter_strategy":"per_hundred","inviter_fixed_per_hundred":25,`, 1)
	assert.Equal(t, http.StatusOK, runCashbackConfigUpdate(t, body).Code)
	assert.Equal(t, http.StatusOK, runCashbackConfigUpdate(t, validCashbackConfigJSON).Code)
	before, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Equal(t, operation_setting.CashbackStrategyPerHundred, before.InviterStrategy)
	assert.Equal(t, 25, before.InviterFixedPerHundred)

	for _, input := range []struct{ field, extra string }{
		{"inviter_strategy", `"inviter_strategy":"other"`},
		{"inviter_strategy", `"inviter_strategy":1`},
		{"invitee_strategy", `"invitee_strategy":1`},
		{"inviter_fixed_per_hundred", `"inviter_strategy":"per_hundred","inviter_fixed_per_hundred":-1`},
		{"invitee_fixed_per_hundred", `"invitee_fixed_per_hundred":1.5`},
		{"inviter_fixed_per_hundred", `"inviter_strategy":"per_hundred","inviter_fixed_per_hundred":1.5`},
		{"inviter_fixed_per_hundred", `"inviter_strategy":"per_hundred","inviter_fixed_per_hundred":101`},
	} {
		request := strings.Replace(validCashbackConfigJSON, `"inviter_rate_bps":0,`, `"inviter_rate_bps":0,`+input.extra+`,`, 1)
		response := runCashbackConfigUpdate(t, request)
		require.Equal(t, http.StatusBadRequest, response.Code)
		assert.Contains(t, response.Body.String(), `"field":"`+input.field+`"`)
		after, err := model.GetCashbackSettingFromDB()
		require.NoError(t, err)
		assert.Equal(t, before, after)
	}
}

func TestCashbackTieredConfigOmissionClearAndAtomicValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	body := strings.Replace(validCashbackConfigJSON, `"inviter_rate_bps":0,`, `"inviter_rate_bps":0,"inviter_strategy":"tiered","inviter_tiers":[{"threshold_cents":10050,"reward_cents":250},{"threshold_cents":20000,"reward_cents":1500}],`, 1)
	require.Equal(t, http.StatusOK, runCashbackConfigUpdate(t, body).Code)
	before, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	require.Len(t, before.InviterTiers, 2)
	assert.EqualValues(t, 10050, before.InviterTiers[0].ThresholdCents)
	require.Equal(t, http.StatusOK, runCashbackConfigUpdate(t, validCashbackConfigJSON).Code)
	preserved, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Equal(t, before.InviterTiers, preserved.InviterTiers)

	for _, tc := range []struct{ field, extra string }{
		{"inviter_tiers", `"inviter_tiers":[{"threshold_cents":100,"reward_cents":1.001}]`},
		{"inviter_tiers", `"inviter_tiers":[{"threshold_cents":100,"reward_cents":5},{"threshold_cents":100,"reward_cents":10}]`},
		{"inviter_tiers", `"inviter_tiers":null`},
		{"inviter_tiers", `"inviter_tiers":[{"threshold_cents":9223372036854775807,"reward_cents":10}]`},
		{"invitee_tiers", `"invitee_tiers":[{"threshold_cents":"100","reward_cents":5}]`},
	} {
		request := strings.Replace(validCashbackConfigJSON, `"inviter_rate_bps":0,`, `"inviter_rate_bps":0,`+tc.extra+`,`, 1)
		response := runCashbackConfigUpdate(t, request)
		assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
		assert.Contains(t, response.Body.String(), `"field":"`+tc.field+`"`)
		current, err := model.GetCashbackSettingFromDB()
		require.NoError(t, err)
		assert.Equal(t, preserved, current)
	}
	emptyEnabled := strings.Replace(validCashbackConfigJSON, `"inviter_enabled":false,`, `"inviter_enabled":true,`, 1)
	emptyEnabled = strings.Replace(emptyEnabled, `"inviter_rate_bps":0,`, `"inviter_rate_bps":0,"inviter_strategy":"tiered","inviter_tiers":[],`, 1)
	response := runCashbackConfigUpdate(t, emptyEnabled)
	assert.Equal(t, http.StatusBadRequest, response.Code)
	assert.Contains(t, response.Body.String(), `"field":"inviter_tiers"`)
	cleared := strings.Replace(validCashbackConfigJSON, `"inviter_rate_bps":0,`, `"inviter_rate_bps":0,"inviter_strategy":"rate","inviter_tiers":[],`, 1)
	require.Equal(t, http.StatusOK, runCashbackConfigUpdate(t, cleared).Code)
	current, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Empty(t, current.InviterTiers)
}

func TestPublicCashbackOffersOnlyExposesLiveRules(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	body := strings.Replace(validCashbackConfigJSON, `"inviter_enabled":false,"invitee_enabled":false,`, `"inviter_enabled":true,"invitee_enabled":true,`, 1)
	body = strings.Replace(body, `"inviter_rate_bps":0,"invitee_rate_bps":0,`, `"inviter_rate_bps":0,"invitee_rate_bps":1000,"inviter_strategy":"tiered","inviter_tiers":[{"threshold_cents":10050,"reward_cents":250}],`, 1)
	require.Equal(t, http.StatusOK, runCashbackConfigUpdate(t, body).Code)
	call := func() *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest(http.MethodGet, "/api/cashback/public-offers", nil)
		PublicCashbackOffers(context)
		return recorder
	}
	response := call()
	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `"active":true`)
	assert.Contains(t, response.Body.String(), `"inviter":{"strategy":"tiered","tiers":[{"threshold_cents":10050,"reward_cents":250}]}`)
	assert.NotContains(t, response.Body.String(), `"invitee":`)
	for _, secret := range []string{"max_reward_quota", "risk", "auto_review", "version", "compliance_confirmed"} {
		assert.NotContains(t, response.Body.String(), secret)
	}

	now := time.Now().Unix()
	campaign := model.CashbackCampaign{StartAt: now - 10, EndAt: now + 3600, MaxRewardsPerUser: 1, CreatedBy: 1}
	require.NoError(t, model.DB.Create(&campaign).Error)
	response = call()
	assert.Contains(t, response.Body.String(), `"invitee":{"strategy":"rate","rate_bps":1000}`)
	require.NoError(t, model.DB.Model(&campaign).Update("payer_scope", model.CashbackPayerScopeFirstTopUp).Error)
	response = call()
	assert.Contains(t, response.Body.String(), `"invitee":{"strategy":"rate","payer_scope":"first_top_up","rate_bps":1000}`)
	require.NoError(t, model.DB.Model(&campaign).Update("stopped_at", now).Error)
	response = call()
	assert.NotContains(t, response.Body.String(), `"invitee":`)

	// An unavailable live-campaign table is an error, not a fabricated inactive offer.
	require.NoError(t, model.DB.Model(&campaign).Update("stopped_at", 0).Error)
	require.NoError(t, model.DB.Migrator().DropTable(&model.CashbackCampaign{}))
	response = call()
	assert.Equal(t, http.StatusServiceUnavailable, response.Code)
	assert.NotContains(t, response.Body.String(), `"active":false`)
}

func TestPublicCashbackOffersFailsClosedWhenOptionsTableIsUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	require.NoError(t, model.DB.Migrator().DropTable(&model.Option{}))
	setting, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.Equal(t, operation_setting.DefaultCashbackSetting(), setting)

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/cashback/public-offers", nil)
	PublicCashbackOffers(context)

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), `"active":false`)
}

func TestUpdateCashbackConfigRejectsCombinedRateAboveOneHundredPercent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)

	response := runCashbackConfigUpdate(t, `{
		"inviter_enabled":true,"invitee_enabled":true,
		"inviter_rate_bps":6000,"invitee_rate_bps":5000,
		"settlement_days":7,"max_reward_quota":1000,"daily_reward_quota":5000,
		"ip_account_threshold":3,"device_account_threshold":2,"daily_topup_count_threshold":5
	}`)

	assert.Equal(t, http.StatusBadRequest, response.Code)
	assert.Contains(t, response.Body.String(), "combined cashback nominal return")
	stored, err := model.GetCashbackSettingFromDB()
	require.NoError(t, err)
	assert.False(t, stored.AnyDirectionEnabled())
}
