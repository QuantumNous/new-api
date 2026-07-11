package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newBillingTestContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	return c
}

// 套餐限定可用分组后：请求分组不匹配 → 直接走钱包；匹配 → 走订阅。
func TestNewBillingSessionRoutesFundingByPlanUsableGroups(t *testing.T) {
	truncate(t)
	now := common.GetTimestamp()

	seedUser(t, 301, 5000)
	seedToken(t, 401, 301, "sk-billing-group-test", 5000)
	plan := &model.SubscriptionPlan{Id: 9501, Title: "Team", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000, QuotaResetPeriod: model.SubscriptionResetNever, QuotaUsableGroups: "vip"}
	require.NoError(t, model.DB.Create(plan).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{Id: 9601, UserId: 301, PlanId: plan.Id, AmountTotal: 1000, StartTime: now - 3600, EndTime: now + 3600, Status: "active"}).Error)

	// 分组不匹配 → 钱包（不受 allow_wallet_overflow 限制）
	walletInfo := &relaycommon.RelayInfo{UserId: 301, TokenId: 401, TokenKey: "sk-billing-group-test", UsingGroup: "default", RequestId: "req-bsg-1"}
	session, apiErr := NewBillingSession(newBillingTestContext(t), walletInfo, 0)
	require.Nil(t, apiErr)
	assert.Equal(t, BillingSourceWallet, session.funding.Source())

	// 分组匹配 → 订阅
	subInfo := &relaycommon.RelayInfo{UserId: 301, TokenId: 401, TokenKey: "sk-billing-group-test", UsingGroup: "vip", RequestId: "req-bsg-2"}
	session2, apiErr := NewBillingSession(newBillingTestContext(t), subInfo, 0)
	require.Nil(t, apiErr)
	assert.Equal(t, BillingSourceSubscription, session2.funding.Source())
}
