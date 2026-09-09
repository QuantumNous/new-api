package controller

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentAdminResponseNormalizesDailyUsageToServerLocalDate(t *testing.T) {
	today := time.Now().In(time.Local).Format("2006-01-02")
	current := agentAccountResponse(model.AgentAccount{
		DailyCountDate: today, DailyCodeCount: 7, DailyCodeLimit: 20,
	}, "", "")
	stale := agentAccountResponse(model.AgentAccount{
		DailyCountDate: "2000-01-01", DailyCodeCount: 19, DailyCodeLimit: 20,
	}, "", "")

	assert.Equal(t, 7, current.DailyCodeCount)
	assert.Zero(t, stale.DailyCodeCount)
}

func TestAgentAdminResponseFormatsMoneyAsStrings(t *testing.T) {
	account := agentAccountResponse(model.AgentAccount{Balance: 123456}, "agent", "Agent")
	assert.Equal(t, "1234.56", account.Balance)

	log := agentCreditLogResponse(model.AgentCreditLog{
		Delta: -125, BalanceBefore: 123456, BalanceAfter: 123331,
	})
	assert.Equal(t, "-1.25", log.Delta)
	assert.Equal(t, "1234.56", log.BalanceBefore)
	assert.Equal(t, "1233.31", log.BalanceAfter)

	raw, err := common.Marshal(struct {
		Account interface{} `json:"account"`
		Log     interface{} `json:"log"`
	}{Account: account, Log: log})
	require.NoError(t, err)
	assert.NotContains(t, string(raw), "123456")
}

func TestAgentStatusIncludesFeatureSwitch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setting := operation_setting.GetAgentSetting()
	original := setting.Enabled
	setting.Enabled = true
	t.Cleanup(func() { setting.Enabled = original })

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("GET", "/api/status", nil)
	GetStatus(context)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			AgentEnabled bool `json:"agent_enabled"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.True(t, response.Data.AgentEnabled)
}

func TestAgentAuditActionsHaveStableContent(t *testing.T) {
	params := map[string]interface{}{
		"agent_user_id":    10,
		"amount":           "100.00",
		"daily_code_limit": 200,
	}
	assert.Contains(t, auditContentEN("agent.enable", params), "10")
	assert.Contains(t, auditContentEN("agent.disable", params), "10")
	assert.Contains(t, auditContentEN("agent.limit_update", params), "200")
	assert.Contains(t, auditContentEN("agent.credit", params), "100.00")
	assert.Contains(t, auditContentEN("agent.debit", params), "100.00")
	offerParams := map[string]interface{}{
		"plan_id": 7, "enabled": true, "unit_price": "60.00",
		"code_valid_days": 365, "refund_fee_bps": 500,
	}
	offerAudit := auditContentEN("agent.offer_update", offerParams)
	assert.Contains(t, offerAudit, "7")
	assert.Contains(t, offerAudit, "true")
	assert.Contains(t, offerAudit, "60.00")
	assert.Contains(t, offerAudit, "365")
	assert.Contains(t, offerAudit, "500")
}

func TestAgentPlanOfferResponseFormatsMoneyAndReturnsCurrentPlan(t *testing.T) {
	response := agentPlanOfferResponse(service.AgentPlanOfferRecord{
		Offer: model.AgentPlanOffer{
			Id: 3, PlanId: 7, Enabled: true, UnitPrice: 6000,
			CodeValidDays: 365, RefundFeeBps: 500,
		},
		Plan: model.SubscriptionPlan{Id: 7, Title: "Monthly Current"},
	})
	assert.Equal(t, "60.00", response.UnitPrice)
	assert.Equal(t, 7, response.Plan.Id)
	assert.Equal(t, "Monthly Current", response.Plan.Title)

	raw, err := common.Marshal(response)
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"unit_price":"60.00"`)
	assert.NotContains(t, string(raw), `"unit_price":6000`)
}

func TestListAgentQueryParsingCapsPagesAndDoesNotTrustOwnerFilter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("GET", "/api/agent/codes?p=2&page_size=1000&agent_user_id=999&plan_id=7", nil)

	page, ok := parseAgentQueryPage(context)
	require.True(t, ok)
	assert.Equal(t, 2, page.Page)
	assert.Equal(t, 100, page.PageSize)
	assert.Equal(t, 100, page.Offset)
	query, ok := parseAgentCodeQuery(context, page, false)
	require.True(t, ok)
	assert.Zero(t, query.AgentUserID, "agent identity comes from UserAuth, never query parameters")
	assert.Equal(t, 7, query.PlanID)
}

func TestListAgentQueryParsingRejectsUnsafePaginationAndTimeRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, target := range []string{
		"/api/agent/codes?p=0",
		"/api/agent/codes?page_size=-1",
		"/api/agent/codes?p=not-a-number",
	} {
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest("GET", target, nil)
		_, ok := parseAgentQueryPage(context)
		assert.False(t, ok, target)
	}

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("GET", "/api/agent/codes?start_timestamp=20&end_timestamp=10", nil)
	_, _, ok := parseAgentTimeRange(context)
	assert.False(t, ok)
}
