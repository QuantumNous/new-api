package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func retryBillingContext() *gin.Context {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	return ctx
}

func retryBillingInfo(userQuota int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RequestId:       "retry-billing-test",
		UserId:          1,
		UserQuota:       userQuota,
		TokenId:         2,
		TokenKey:        "retry-billing-key",
		TokenGroup:      "default",
		UsingGroup:      "default",
		OriginModelName: "retry-billing-model",
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}
}

func TestPrepareRetryBillingReservesHigherFallbackPrice(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)
	seedToken(t, 2, 1, "retry-billing-key", 1000)
	info := retryBillingInfo(1000)
	ctx := retryBillingContext()

	require.Nil(t, PreConsumeBilling(ctx, 100, info))
	require.Nil(t, PrepareRetryBilling(ctx, info, types.PriceData{QuotaToPreConsume: 300}))
	require.Equal(t, 300, info.Billing.GetPreConsumedQuota())

	var user model.User
	var token model.Token
	require.NoError(t, model.DB.First(&user, 1).Error)
	require.NoError(t, model.DB.First(&token, 2).Error)
	require.Equal(t, 700, user.Quota)
	require.Equal(t, 700, token.RemainQuota)
}

func TestPrepareRetryBillingRejectsUnaffordableFallback(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 250)
	seedToken(t, 2, 1, "retry-billing-key", 1000)
	info := retryBillingInfo(250)
	ctx := retryBillingContext()

	require.Nil(t, PreConsumeBilling(ctx, 100, info))
	apiErr := PrepareRetryBilling(ctx, info, types.PriceData{QuotaToPreConsume: 300})
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
	require.Equal(t, 100, info.Billing.GetPreConsumedQuota())

	var user model.User
	var token model.Token
	require.NoError(t, model.DB.First(&user, 1).Error)
	require.NoError(t, model.DB.First(&token, 2).Error)
	require.Equal(t, 150, user.Quota)
	require.Equal(t, 900, token.RemainQuota)
}

func TestPrepareRetryBillingCreatesSessionAfterFreePrimary(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)
	seedToken(t, 2, 1, "retry-billing-key", 1000)
	info := retryBillingInfo(1000)

	apiErr := PrepareRetryBilling(retryBillingContext(), info, types.PriceData{QuotaToPreConsume: 200})
	require.Nil(t, apiErr)
	require.NotNil(t, info.Billing)
	require.Equal(t, 200, info.Billing.GetPreConsumedQuota())
	require.Equal(t, BillingSourceWallet, info.BillingSource)
}
