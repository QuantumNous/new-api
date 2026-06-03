package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWalletFundingTracksSourceSegmentsAndRefundsPaidPortion(t *testing.T) {
	truncate(t)
	seedUser(t, 901, 0)
	require.NoError(t, model.IncreaseUserQuotaWithSource(901, 100, model.QuotaSourceGift, "test", "gift", "", "gift credit"))
	require.NoError(t, model.IncreaseUserQuotaWithSource(901, 200, model.QuotaSourcePaid, "test", "paid", "", "paid credit"))

	wallet := &WalletFunding{userId: 901, requestId: "req-wallet-source", relatedType: "relay_request"}
	require.NoError(t, wallet.PreConsume(150))

	breakdown := model.SumQuotaSourceSegments(wallet.sourceSegments)
	assert.EqualValues(t, 100, breakdown.Gift)
	assert.EqualValues(t, 50, breakdown.Paid)
	assert.EqualValues(t, 150, breakdown.Total)
	assert.EqualValues(t, 0, quotaSourceBalanceForServiceTest(t, 901, model.QuotaSourceGift))
	assert.EqualValues(t, 150, quotaSourceBalanceForServiceTest(t, 901, model.QuotaSourcePaid))

	require.NoError(t, wallet.Settle(-40))
	breakdown = model.SumQuotaSourceSegments(wallet.sourceSegments)
	assert.EqualValues(t, 100, breakdown.Gift)
	assert.EqualValues(t, 10, breakdown.Paid)
	assert.EqualValues(t, 110, breakdown.Total)
	assert.EqualValues(t, 0, quotaSourceBalanceForServiceTest(t, 901, model.QuotaSourceGift))
	assert.EqualValues(t, 190, quotaSourceBalanceForServiceTest(t, 901, model.QuotaSourcePaid))

	require.NoError(t, wallet.Refund())
	assert.EqualValues(t, 100, quotaSourceBalanceForServiceTest(t, 901, model.QuotaSourceGift))
	assert.EqualValues(t, 200, quotaSourceBalanceForServiceTest(t, 901, model.QuotaSourcePaid))
	assert.EqualValues(t, 300, userQuotaForServiceTest(t, 901))
}

func TestNewBillingSessionWalletFundingWritesRequestIdSourceEvents(t *testing.T) {
	truncate(t)
	gin.SetMode(gin.TestMode)
	seedUser(t, 902, 0)
	require.NoError(t, model.IncreaseUserQuotaWithSource(902, 500, model.QuotaSourcePaid, "test", "paid", "", "paid credit"))

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayInfo := &relaycommon.RelayInfo{
		UserId:       902,
		RequestId:    "req-billing-wallet-source",
		IsPlayground: true,
	}
	session, apiErr := NewBillingSession(ctx, relayInfo, 120)
	require.Nil(t, apiErr)
	wallet, ok := session.funding.(*WalletFunding)
	require.True(t, ok)
	assert.Equal(t, "req-billing-wallet-source", wallet.requestId)

	var event model.UserQuotaSourceEvent
	require.NoError(t, model.DB.Where(
		"user_id = ? AND source = ? AND event_type = ? AND request_id = ?",
		902,
		model.QuotaSourcePaid,
		model.QuotaSourceEventDebit,
		"req-billing-wallet-source",
	).First(&event).Error)
	assert.EqualValues(t, 120, event.Amount)
	assert.Equal(t, "relay_request", event.RelatedType)
	assert.Equal(t, "req-billing-wallet-source", event.RelatedId)
}

func TestBillingSessionSettleRefreshesWalletSourceBreakdown(t *testing.T) {
	truncate(t)
	gin.SetMode(gin.TestMode)
	seedUser(t, 903, 0)
	require.NoError(t, model.IncreaseUserQuotaWithSource(903, 100, model.QuotaSourceGift, "test", "gift", "", "gift credit"))
	require.NoError(t, model.IncreaseUserQuotaWithSource(903, 200, model.QuotaSourcePaid, "test", "paid", "", "paid credit"))

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayInfo := &relaycommon.RelayInfo{
		UserId:       903,
		RequestId:    "req-billing-wallet-settle",
		IsPlayground: true,
	}
	session, apiErr := NewBillingSession(ctx, relayInfo, 150)
	require.Nil(t, apiErr)
	assert.EqualValues(t, 100, relayInfo.WalletGiftQuotaConsumed)
	assert.EqualValues(t, 50, relayInfo.WalletPaidQuotaConsumed)

	require.NoError(t, session.Settle(110))

	assert.EqualValues(t, 100, relayInfo.WalletGiftQuotaConsumed)
	assert.EqualValues(t, 10, relayInfo.WalletPaidQuotaConsumed)
	assert.EqualValues(t, 110, relayInfo.WalletGiftQuotaConsumed+relayInfo.WalletPaidQuotaConsumed+relayInfo.WalletTrialQuotaConsumed+relayInfo.WalletLegacyUnknownQuotaConsumed)
}

func quotaSourceBalanceForServiceTest(t *testing.T, userId int, source string) int64 {
	t.Helper()
	var balance model.UserQuotaSourceBalance
	require.NoError(t, model.DB.Where("user_id = ? AND source = ?", userId, source).First(&balance).Error)
	return balance.Balance
}

func userQuotaForServiceTest(t *testing.T, userId int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", userId).First(&user).Error)
	return user.Quota
}
