package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPreConsumeTokenQuotaConsumesPeriodicPolicy(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	const userID, tokenID = 11, 21
	seedToken(t, tokenID, userID, "policy-preconsume", 1000)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 100)
	setServiceTokenQuotaPolicyBoundaryMode(t, tokenID, model.TokenQuotaBoundaryStrict)
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-preconsume",
		UserId:                  userID,
		TokenQuotaPolicyEnabled: true,
	}

	require.NoError(t, PreConsumeTokenQuota(relayInfo, 60))

	assert.Equal(t, 940, getTokenRemainQuota(t, tokenID))
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	assert.Equal(t, 60, policy.UsedQuota)
}

func TestPreConsumeTokenQuotaRejectsPeriodicOverspendWithoutTokenCharge(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	const userID, tokenID = 12, 22
	seedToken(t, tokenID, userID, "policy-overspend", 1000)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 50)
	setServiceTokenQuotaPolicyBoundaryMode(t, tokenID, model.TokenQuotaBoundaryStrict)
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-overspend",
		UserId:                  userID,
		TokenQuotaPolicyEnabled: true,
	}

	err := PreConsumeTokenQuota(relayInfo, 60)

	require.ErrorIs(t, err, model.ErrTokenQuotaPolicyExhausted)
	assert.Equal(t, 1000, getTokenRemainQuota(t, tokenID))
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	assert.Equal(t, 0, policy.UsedQuota)
	assert.Equal(t, common.TokenStatusEnabled, getTokenStatus(t, tokenID))
}

func TestPreConsumeTokenQuotaDoesNotDisableTokenOnStrictPreCheckReject(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	const userID, tokenID = 16, 26
	seedToken(t, tokenID, userID, "policy-disable", 1000)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 50)
	setServiceTokenQuotaPolicyBoundaryMode(t, tokenID, model.TokenQuotaBoundaryStrict)
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	policy.ExhaustedAction = model.TokenQuotaExhaustDisableToken
	require.NoError(t, model.DB.Save(policy).Error)
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-disable",
		UserId:                  userID,
		TokenQuotaPolicyEnabled: true,
	}

	err := PreConsumeTokenQuota(relayInfo, 60)

	require.ErrorIs(t, err, model.ErrTokenQuotaPolicyExhausted)
	assert.Equal(t, common.TokenStatusEnabled, getTokenStatus(t, tokenID))
	policy = getServiceTokenQuotaPolicy(t, tokenID)
	assert.Zero(t, policy.ExhaustedAt)
	assert.Zero(t, policy.ExhaustedTokenStatus)
}

func TestPostConsumeQuotaRefundsPeriodicPolicy(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	const userID, tokenID = 13, 23
	seedUser(t, userID, 10000)
	seedToken(t, tokenID, userID, "policy-post-refund", 1000)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 100)
	setServiceTokenQuotaPolicyBoundaryMode(t, tokenID, model.TokenQuotaBoundaryStrict)
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-post-refund",
		UserId:                  userID,
		TokenQuotaPolicyEnabled: true,
	}
	require.NoError(t, PreConsumeTokenQuota(relayInfo, 60))

	require.NoError(t, PostConsumeQuota(relayInfo, -40, 0, false))

	assert.Equal(t, 980, getTokenRemainQuota(t, tokenID))
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	assert.Equal(t, 20, policy.UsedQuota)
}

func TestBillingSessionSettleAdjustsPeriodicPolicyDelta(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	gin.SetMode(gin.TestMode)
	const userID, tokenID = 14, 24
	seedUser(t, userID, 10000)
	seedToken(t, tokenID, userID, "policy-billing-settle", 1000)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 100)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-billing-settle",
		UserId:                  userID,
		TokenQuotaPolicyEnabled: true,
	}
	session, apiErr := NewBillingSession(ctx, relayInfo, 60)
	require.Nil(t, apiErr)
	relayInfo.Billing = session

	require.NoError(t, SettleBilling(ctx, relayInfo, 80))

	assert.Equal(t, 920, getTokenRemainQuota(t, tokenID))
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	assert.Equal(t, 80, policy.UsedQuota)
}

func TestBillingSessionSettleRecordsGracefulPeriodicPolicyWhenActualMatchesPreConsume(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	gin.SetMode(gin.TestMode)
	const userID, tokenID = 19, 29
	seedUser(t, userID, 10000)
	seedToken(t, tokenID, userID, "policy-billing-same", 1000)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 100)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-billing-same",
		UserId:                  userID,
		TokenQuotaPolicyEnabled: true,
	}
	session, apiErr := NewBillingSession(ctx, relayInfo, 60)
	require.Nil(t, apiErr)
	relayInfo.Billing = session

	require.NoError(t, SettleBilling(ctx, relayInfo, 60))

	assert.Equal(t, 940, getTokenRemainQuota(t, tokenID))
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	assert.Equal(t, 60, policy.UsedQuota)
}

func TestBillingSessionSettleRefundsPeriodicPolicyDelta(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	gin.SetMode(gin.TestMode)
	const userID, tokenID = 15, 25
	seedUser(t, userID, 10000)
	seedToken(t, tokenID, userID, "policy-billing-refund", 1000)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 100)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-billing-refund",
		UserId:                  userID,
		TokenQuotaPolicyEnabled: true,
	}
	session, apiErr := NewBillingSession(ctx, relayInfo, 60)
	require.Nil(t, apiErr)
	relayInfo.Billing = session

	require.NoError(t, SettleBilling(ctx, relayInfo, 30))

	assert.Equal(t, 970, getTokenRemainQuota(t, tokenID))
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	assert.Equal(t, 30, policy.UsedQuota)
}

func TestBillingSessionAllowsBoundaryStreamThenBlocksNextRequest(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	gin.SetMode(gin.TestMode)
	const userID, tokenID = 17, 27
	seedUser(t, userID, common.GetTrustQuota()+1000000)
	seedToken(t, tokenID, userID, "policy-trust-bypass", common.GetTrustQuota()+1000000)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", tokenID).Update("unlimited_quota", true).Error)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 100)
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	policy.UsedQuota = 90
	policy.AnchorTime = common.GetTimestamp() - 60
	policy.PeriodStart = common.GetTimestamp() - 60
	policy.PeriodEnd = common.GetTimestamp() + 600
	policy.NextResetAt = policy.PeriodEnd
	require.NoError(t, model.DB.Save(policy).Error)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-trust-bypass",
		UserId:                  userID,
		TokenUnlimited:          true,
		TokenQuotaPolicyEnabled: true,
	}

	session, apiErr := NewBillingSession(ctx, relayInfo, 60)

	require.Nil(t, apiErr)
	require.NotNil(t, session)
	require.Equal(t, 0, session.GetPreConsumedQuota())
	require.NoError(t, session.Settle(60))
	policy = getServiceTokenQuotaPolicy(t, tokenID)
	assert.Equal(t, 150, policy.UsedQuota)
	assert.NotZero(t, policy.ExhaustedAt)
	assert.Equal(t, common.GetTrustQuota()+1000000-60, getPolicyTestUserQuota(t, userID))

	nextSession, nextErr := NewBillingSession(ctx, relayInfo, 1)

	require.Nil(t, nextSession)
	require.NotNil(t, nextErr)
	require.ErrorIs(t, nextErr.Err, model.ErrTokenQuotaPolicyExhausted)
}

func TestBillingSessionStrictBoundaryRejectsBeforeRequest(t *testing.T) {
	truncate(t)
	require.NoError(t, i18n.Init())
	require.NoError(t, model.DB.AutoMigrate(&model.TokenQuotaPolicy{}))
	gin.SetMode(gin.TestMode)
	const userID, tokenID = 18, 28
	seedUser(t, userID, common.GetTrustQuota()+1000000)
	seedToken(t, tokenID, userID, "policy-strict-boundary", common.GetTrustQuota()+1000000)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", tokenID).Update("unlimited_quota", true).Error)
	seedServiceTokenQuotaPolicy(t, tokenID, userID, 100)
	policy := getServiceTokenQuotaPolicy(t, tokenID)
	policy.UsedQuota = 90
	policy.BoundaryMode = model.TokenQuotaBoundaryStrict
	policy.AnchorTime = common.GetTimestamp() - 60
	policy.PeriodStart = common.GetTimestamp() - 60
	policy.PeriodEnd = common.GetTimestamp() + 600
	policy.NextResetAt = policy.PeriodEnd
	require.NoError(t, model.DB.Save(policy).Error)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayInfo := &relaycommon.RelayInfo{
		TokenId:                 tokenID,
		TokenKey:                "policy-strict-boundary",
		UserId:                  userID,
		TokenUnlimited:          true,
		TokenQuotaPolicyEnabled: true,
	}

	session, apiErr := NewBillingSession(ctx, relayInfo, 60)

	require.Nil(t, session)
	require.NotNil(t, apiErr)
	require.ErrorIs(t, apiErr.Err, model.ErrTokenQuotaPolicyExhausted)
	assert.Equal(t, types.ErrorCodeTokenQuotaPolicyExhausted, apiErr.GetErrorCode())
	assert.Contains(t, apiErr.Error(), "periodic quota is exhausted")
	policy = getServiceTokenQuotaPolicy(t, tokenID)
	assert.Equal(t, 90, policy.UsedQuota)
	assert.Zero(t, policy.ExhaustedAt)
}

func seedServiceTokenQuotaPolicy(t *testing.T, tokenID int, userID int, quota int) {
	t.Helper()
	anchor := int64(1782532500)
	window, err := model.CalculateTokenQuotaPolicyWindow(model.TokenQuotaPeriodPreset5h, 0, anchor, anchor)
	require.NoError(t, err)
	policy := &model.TokenQuotaPolicy{
		TokenId:         tokenID,
		UserId:          userID,
		Enabled:         true,
		PeriodMode:      model.TokenQuotaPeriodPreset5h,
		Quota:           quota,
		AnchorTime:      anchor,
		PeriodStart:     window.Start,
		PeriodEnd:       window.End,
		NextResetAt:     window.NextResetAt,
		ExhaustedAction: model.TokenQuotaExhaustRejectOnly,
		AutoResume:      true,
	}
	require.NoError(t, model.DB.Create(policy).Error)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", tokenID).Update("quota_policy_enabled", true).Error)
}

func getServiceTokenQuotaPolicy(t *testing.T, tokenID int) *model.TokenQuotaPolicy {
	t.Helper()
	policy, err := model.GetTokenQuotaPolicyByTokenId(tokenID)
	require.NoError(t, err)
	return policy
}

func setServiceTokenQuotaPolicyBoundaryMode(t *testing.T, tokenID int, mode model.TokenQuotaBoundaryMode) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.TokenQuotaPolicy{}).Where("token_id = ?", tokenID).Update("boundary_mode", mode).Error)
}

func getTokenStatus(t *testing.T, tokenID int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Select("status").Where("id = ?", tokenID).First(&token).Error)
	return token.Status
}

func getPolicyTestUserQuota(t *testing.T, userID int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Where("id = ?", userID).First(&user).Error)
	return user.Quota
}
