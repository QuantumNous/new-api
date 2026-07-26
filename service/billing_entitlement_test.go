package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func seedBillingEntitlement(t *testing.T, userId, tokenId int, tokenKey string) (*model.TokenEntitlement, string) {
	t.Helper()
	truncate(t)
	seedUser(t, userId, 10_000)
	seedToken(t, tokenId, userId, tokenKey, 10_000)
	now := common.GetTimestamp()
	pkg := &model.EntitlementPackage{
		Name: "billing-entitlement", Status: model.EntitlementStatusEnabled,
		Group: "billing-private", Models: "billing-model", AllowPublicFallback: false,
		DailyQuota: 1_000, TotalQuota: 2_000, CreatedTime: now, UpdatedTime: now,
	}
	require.NoError(t, model.DB.Create(pkg).Error)
	require.NoError(t, model.DB.Create(&model.UserEntitlement{
		PackageId: pkg.Id, UserId: userId, Status: model.EntitlementStatusEnabled,
		CreatedTime: now, UpdatedTime: now,
	}).Error)
	tokenGrant := &model.TokenEntitlement{
		PackageId: pkg.Id, TokenId: tokenId, UserId: userId,
		Status:             model.EntitlementStatusEnabled,
		DailyQuotaOverride: -1, DailyRequestLimitOverride: -1,
		TotalQuotaOverride: -1, TotalRequestLimitOverride: -1,
		CreatedTime: now, UpdatedTime: now,
	}
	require.NoError(t, model.DB.Create(tokenGrant).Error)
	return tokenGrant, time.Now().In(time.FixedZone("Asia/Shanghai", 8*60*60)).Format("2006-01-02")
}

func entitlementBillingContext(userId, tokenId int, tokenKey string, grantId int, usageDate string) (*gin.Context, *relaycommon.RelayInfo) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		UserId: userId, TokenId: tokenId, TokenKey: tokenKey,
		ForcePreConsume: true, IsPlayground: true,
		EntitlementId: grantId, EntitlementUsageDate: usageDate,
		EntitlementDailyQuota: 1_000, EntitlementTotalQuota: 2_000,
	}
	return ctx, info
}

func TestBillingSessionEntitlementQuotaSettlesToActualUsage(t *testing.T) {
	grant, usageDate := seedBillingEntitlement(t, 501, 601, "billing-token-settle")
	ctx, info := entitlementBillingContext(501, 601, "billing-token-settle", grant.Id, usageDate)

	session, apiErr := NewBillingSession(ctx, info, 100)
	require.Nil(t, apiErr)
	require.NoError(t, session.Settle(60))

	var stored model.TokenEntitlement
	require.NoError(t, model.DB.First(&stored, grant.Id).Error)
	require.Equal(t, 60, stored.UsedQuota)
	usage, err := model.GetEntitlementDailyUsage(grant.Id, usageDate)
	require.NoError(t, err)
	require.Equal(t, 60, usage.UsedQuota)
}

func TestBillingSessionEntitlementQuotaRefundsFailedRequest(t *testing.T) {
	grant, usageDate := seedBillingEntitlement(t, 502, 602, "billing-token-refund")
	ctx, info := entitlementBillingContext(502, 602, "billing-token-refund", grant.Id, usageDate)

	session, apiErr := NewBillingSession(ctx, info, 80)
	require.Nil(t, apiErr)
	require.True(t, session.NeedsRefund())
	session.Refund(ctx)

	require.Eventually(t, func() bool {
		var stored model.TokenEntitlement
		if err := model.DB.First(&stored, grant.Id).Error; err != nil {
			return false
		}
		return stored.UsedQuota == 0
	}, 2*time.Second, 20*time.Millisecond)
}
