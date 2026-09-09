package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Claude Sonnet-style tiered expression: standard vs long-context
const sonnetTieredExpr = `p <= 200000 ? tier("standard", p * 1.5 + c * 7.5) : tier("long_context", p * 3 + c * 11.25)`

// Simple flat expression
const flatExpr = `tier("default", p * 2 + c * 10)`

// Expression with cache tokens
const cacheExpr = `tier("default", p * 2 + c * 10 + cr * 0.2 + cc * 2.5 + cc1h * 4)`

// Expression with request probes
const probeExpr = `param("service_tier") == "fast" ? tier("fast", p * 4 + c * 20) : tier("normal", p * 2 + c * 10)`

const testQuotaPerUnit = 500_000.0

func makeSnapshot(expr string, groupRatio float64, estPrompt, estCompletion int) *billingexpr.BillingSnapshot {
	return &billingexpr.BillingSnapshot{
		BillingMode:               "tiered_expr",
		ExprString:                expr,
		ExprHash:                  billingexpr.ExprHashString(expr),
		GroupRatio:                groupRatio,
		EstimatedPromptTokens:     estPrompt,
		EstimatedCompletionTokens: estCompletion,
		QuotaPerUnit:              testQuotaPerUnit,
	}
}

func makeRelayInfo(expr string, groupRatio float64, estPrompt, estCompletion int) *relaycommon.RelayInfo {
	snap := makeSnapshot(expr, groupRatio, estPrompt, estCompletion)
	cost, trace, _ := billingexpr.RunExpr(expr, billingexpr.TokenParams{P: float64(estPrompt), C: float64(estCompletion)})
	quotaBeforeGroup := cost / 1_000_000 * testQuotaPerUnit
	snap.EstimatedQuotaBeforeGroup = quotaBeforeGroup
	snap.EstimatedQuotaAfterGroup = billingexpr.QuotaRound(quotaBeforeGroup * groupRatio)
	snap.EstimatedTier = trace.MatchedTier
	return &relaycommon.RelayInfo{
		TieredBillingSnapshot: snap,
		FinalPreConsumedQuota: snap.EstimatedQuotaAfterGroup,
	}
}

// ---------------------------------------------------------------------------
// Existing tests (preserved)
// ---------------------------------------------------------------------------

func TestTryTieredSettleUsesFrozenRequestInput(t *testing.T) {
	exprStr := `param("service_tier") == "fast" ? tier("fast", p * 2) : tier("normal", p)`
	relayInfo := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:               "tiered_expr",
			ExprString:                exprStr,
			ExprHash:                  billingexpr.ExprHashString(exprStr),
			GroupRatio:                1.0,
			EstimatedPromptTokens:     100,
			EstimatedCompletionTokens: 0,
			EstimatedQuotaAfterGroup:  50,
			QuotaPerUnit:              testQuotaPerUnit,
		},
		BillingRequestInput: &billingexpr.RequestInput{
			Body: []byte(`{"service_tier":"fast"}`),
		},
	}

	ok, quota, result := TryTieredSettle(relayInfo, billingexpr.TokenParams{P: 100})
	require.True(t, ok, "expected tiered settle to apply")
	// fast: p*2 = 200; quota = 200 / 1M * 500K = 100
	require.Equal(t, 100, quota)
	require.NotNil(t, result)
	require.Equal(t, "fast", result.MatchedTier)
}

func TestTryTieredSettleFallsBackToFrozenPreConsumeOnExprError(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		FinalPreConsumedQuota: 321,
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:              "tiered_expr",
			ExprString:               `invalid +-+ expr`,
			ExprHash:                 billingexpr.ExprHashString(`invalid +-+ expr`),
			GroupRatio:               1.0,
			EstimatedQuotaAfterGroup: 123,
		},
	}

	ok, quota, result := TryTieredSettle(relayInfo, billingexpr.TokenParams{P: 100})
	require.True(t, ok, "expected tiered settle to apply")
	require.Equal(t, 321, quota)
	require.Nil(t, result)
}

// ---------------------------------------------------------------------------
// Pre-consume vs Post-consume consistency
// ---------------------------------------------------------------------------

func TestTryTieredSettle_PreConsumeMatchesPostConsume(t *testing.T) {
	info := makeRelayInfo(flatExpr, 1.0, 1000, 500)
	params := billingexpr.TokenParams{P: 1000, C: 500}

	ok, quota, _ := TryTieredSettle(info, params)
	require.True(t, ok, "expected tiered settle")
	// p*2 + c*10 = 7000; quota = 7000 / 1M * 500K = 3500
	require.Equal(t, 3500, quota)
	require.Equal(t, info.FinalPreConsumedQuota, quota)
}

func TestTryTieredSettle_PostConsumeOverPreConsume(t *testing.T) {
	info := makeRelayInfo(flatExpr, 1.0, 1000, 500)
	preConsumed := info.FinalPreConsumedQuota // 3500

	// Actual usage is higher than estimated
	params := billingexpr.TokenParams{P: 2000, C: 1000}
	ok, quota, _ := TryTieredSettle(info, params)
	require.True(t, ok, "expected tiered settle")
	// p*2 + c*10 = 14000; quota = 14000 / 1M * 500K = 7000
	require.Equal(t, 7000, quota)
	require.Greater(t, quota, preConsumed)
}

func TestTryTieredSettle_PostConsumeUnderPreConsume(t *testing.T) {
	info := makeRelayInfo(flatExpr, 1.0, 1000, 500)
	preConsumed := info.FinalPreConsumedQuota // 3500

	// Actual usage is lower than estimated
	params := billingexpr.TokenParams{P: 100, C: 50}
	ok, quota, _ := TryTieredSettle(info, params)
	require.True(t, ok, "expected tiered settle")
	// p*2 + c*10 = 700; quota = 700 / 1M * 500K = 350
	require.Equal(t, 350, quota)
	require.Less(t, quota, preConsumed)
}

// ---------------------------------------------------------------------------
// Tiered boundary conditions
// ---------------------------------------------------------------------------

func TestTryTieredSettle_ExactBoundary(t *testing.T) {
	info := makeRelayInfo(sonnetTieredExpr, 1.0, 200000, 1000)

	// p == 200000 => standard tier (p <= 200000)
	ok, quota, result := TryTieredSettle(info, billingexpr.TokenParams{P: 200000, C: 1000})
	require.True(t, ok, "expected tiered settle")
	// standard: p*1.5 + c*7.5 = 307500; quota = 307500 / 1M * 500K = 153750
	require.Equal(t, 153750, quota)
	require.NotNil(t, result)
	require.Equal(t, "standard", result.MatchedTier)
}

func TestTryTieredSettle_BoundaryPlusOne(t *testing.T) {
	info := makeRelayInfo(sonnetTieredExpr, 1.0, 200000, 1000)

	// p == 200001 => crosses to long_context tier
	ok, quota, result := TryTieredSettle(info, billingexpr.TokenParams{P: 200001, C: 1000})
	require.True(t, ok, "expected tiered settle")
	// long_context: p*3 + c*11.25 = 611253; quota = round(611253 / 1M * 500K) = 305627
	require.Equal(t, 305627, quota)
	require.NotNil(t, result)
	require.Equal(t, "long_context", result.MatchedTier)
	require.True(t, result.CrossedTier, "expected CrossedTier = true")
}

func TestTryTieredSettle_ZeroTokens(t *testing.T) {
	info := makeRelayInfo(flatExpr, 1.0, 0, 0)

	ok, quota, result := TryTieredSettle(info, billingexpr.TokenParams{P: 0, C: 0})
	require.True(t, ok, "expected tiered settle")
	require.Equal(t, 0, quota)
	require.NotNil(t, result)
}

func TestTryTieredSettle_HugeTokens(t *testing.T) {
	info := makeRelayInfo(flatExpr, 1.0, 10000000, 5000000)

	ok, quota, _ := TryTieredSettle(info, billingexpr.TokenParams{P: 10000000, C: 5000000})
	require.True(t, ok, "expected tiered settle")
	// p*2 + c*10 = 70000000; quota = 70000000 / 1M * 500K = 35000000
	require.Equal(t, 35000000, quota)
}

func TestTryTieredSettle_CacheTokensAffectSettlement(t *testing.T) {
	info := makeRelayInfo(cacheExpr, 1.0, 1000, 500)

	// Without cache tokens
	ok1, quota1, _ := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500})
	require.True(t, ok1, "expected tiered settle")
	// p*2 + c*10 = 7000; quota = 7000 / 1M * 500K = 3500

	// With cache tokens
	ok2, quota2, _ := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500, CR: 10000, CC: 5000, CC1h: 2000})
	require.True(t, ok2, "expected tiered settle")
	// 2000 + 5000 + 2000 + 12500 + 8000 = 29500; quota = 29500 / 1M * 500K = 14750

	require.Greater(t, quota2, quota1)
	require.Equal(t, 3500, quota1)
	require.Equal(t, 14750, quota2)
}

// ---------------------------------------------------------------------------
// Request probe tests
// ---------------------------------------------------------------------------

func TestTryTieredSettle_RequestProbeInfluencesBilling(t *testing.T) {
	info := makeRelayInfo(probeExpr, 1.0, 1000, 500)
	info.BillingRequestInput = &billingexpr.RequestInput{
		Body: []byte(`{"service_tier":"fast"}`),
	}

	ok, quota, result := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500})
	require.True(t, ok, "expected tiered settle")
	// fast: p*4 + c*20 = 14000; quota = 14000 / 1M * 500K = 7000
	require.Equal(t, 7000, quota)
	require.NotNil(t, result)
	require.Equal(t, "fast", result.MatchedTier)
}

func TestTryTieredSettle_NoRequestInput_FallsBackToDefault(t *testing.T) {
	info := makeRelayInfo(probeExpr, 1.0, 1000, 500)
	// No BillingRequestInput set — param("service_tier") returns nil, not "fast"

	ok, quota, result := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500})
	require.True(t, ok, "expected tiered settle")
	// normal: p*2 + c*10 = 7000; quota = 7000 / 1M * 500K = 3500
	require.Equal(t, 3500, quota)
	require.NotNil(t, result)
	require.Equal(t, "normal", result.MatchedTier)
}

// ---------------------------------------------------------------------------
// Group ratio tests
// ---------------------------------------------------------------------------

type recordingBillingSettler struct {
	preConsumedQuota int
	reserveTargets   []int
}

func (*recordingBillingSettler) Settle(int) error { return nil }

func (*recordingBillingSettler) Refund(*gin.Context) {}

func (*recordingBillingSettler) NeedsRefund() bool { return false }

func (s *recordingBillingSettler) GetPreConsumedQuota() int {
	return s.preConsumedQuota
}

func (s *recordingBillingSettler) Reserve(targetQuota int) error {
	s.reserveTargets = append(s.reserveTargets, targetQuota)
	if targetQuota > s.preConsumedQuota {
		s.preConsumedQuota = targetQuota
	}
	return nil
}

func TestPrepareTieredBillingForSelectedGroupUpdatesReservation(t *testing.T) {
	const expr = `tier("base", p)`
	billing := &recordingBillingSettler{preConsumedQuota: 50_000}
	relayInfo := &relaycommon.RelayInfo{
		Billing:               billing,
		FinalPreConsumedQuota: 50_000,
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:               "tiered_expr",
			ExprString:                expr,
			ExprHash:                  billingexpr.ExprHashString(expr),
			GroupRatio:                0.10,
			EstimatedQuotaBeforeGroup: 500_000,
			EstimatedQuotaAfterGroup:  50_000,
			QuotaPerUnit:              testQuotaPerUnit,
		},
		PriceData: types.PriceData{
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 0.20},
		},
	}

	require.Nil(t, PrepareTieredBillingForSelectedGroup(nil, relayInfo))
	require.Equal(t, []int{100_000}, billing.reserveTargets)
	assert.Equal(t, 100_000, billing.preConsumedQuota)
	assert.Equal(t, 100_000, relayInfo.FinalPreConsumedQuota)
	assert.Equal(t, 0.20, relayInfo.TieredBillingSnapshot.GroupRatio)
	assert.Equal(t, 100_000, relayInfo.TieredBillingSnapshot.EstimatedQuotaAfterGroup)
}

func TestPrepareTieredBillingForSelectedGroupStartsBillingAfterFreeGroup(t *testing.T) {
	truncate(t)
	gin.SetMode(gin.TestMode)

	const userID = 700
	seedUser(t, userID, 500_000)

	relayInfo := &relaycommon.RelayInfo{
		UserId:          userID,
		IsPlayground:    true,
		ForcePreConsume: true,
		OriginModelName: "gpt-test",
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:               "tiered_expr",
			ExprString:                `tier("base", p)`,
			ExprHash:                  billingexpr.ExprHashString(`tier("base", p)`),
			GroupRatio:                0,
			EstimatedQuotaBeforeGroup: 500_000,
			QuotaPerUnit:              testQuotaPerUnit,
		},
		PriceData: types.PriceData{
			FreeModel:      true,
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 0.20},
		},
	}
	ctx, _ := gin.CreateTestContext(nil)

	require.Nil(t, PrepareTieredBillingForSelectedGroup(ctx, relayInfo))
	require.NotNil(t, relayInfo.Billing)
	assert.False(t, relayInfo.PriceData.FreeModel, "FreeModel must be cleared after switching to a paid group")
	assert.Equal(t, 100_000, relayInfo.FinalPreConsumedQuota)
	assert.Equal(t, 0.20, relayInfo.TieredBillingSnapshot.GroupRatio)
	assert.Equal(t, 100_000, relayInfo.TieredBillingSnapshot.EstimatedQuotaAfterGroup)

	userQuota, err := model.GetUserQuota(userID, false)
	require.NoError(t, err)
	assert.Equal(t, 400_000, userQuota)
}

func TestPrepareTieredBillingForSelectedGroupPaidToFreeKeepsFreeModelFalse(t *testing.T) {
	const expr = `tier("base", p)`
	billing := &recordingBillingSettler{preConsumedQuota: 50_000}
	relayInfo := &relaycommon.RelayInfo{
		Billing:               billing,
		FinalPreConsumedQuota: 50_000,
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:               "tiered_expr",
			ExprString:                expr,
			ExprHash:                  billingexpr.ExprHashString(expr),
			GroupRatio:                0.10,
			EstimatedQuotaBeforeGroup: 500_000,
			EstimatedQuotaAfterGroup:  50_000,
			QuotaPerUnit:              testQuotaPerUnit,
		},
		PriceData: types.PriceData{
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 0},
		},
	}

	require.Nil(t, PrepareTieredBillingForSelectedGroup(nil, relayInfo))

	// Pre-consume did happen under the paid group, so FreeModel stays false;
	// settlement already yields 0 for GroupRatio == 0 and the session refunds.
	assert.False(t, relayInfo.PriceData.FreeModel)
	assert.Empty(t, billing.reserveTargets)
	assert.Equal(t, 50_000, relayInfo.FinalPreConsumedQuota)
}

func TestPrepareTieredBillingForSelectedGroupTopUpArrearsAllowsNegativeBalance(t *testing.T) {
	truncate(t)

	const userID = 701
	// Balance covers the initial 50k pre-consume (already deducted before this
	// test's seed) but not the 50k top-up to the more expensive retry group.
	// The top-up must NOT abort the request: the full delta is deducted, the
	// uncovered 30k becomes arrears (negative balance), mirroring how
	// settlement charges a positive delta unconditionally.
	seedUser(t, userID, 20_000)

	relayInfo := &relaycommon.RelayInfo{
		UserId:                userID,
		IsPlayground:          true,
		FinalPreConsumedQuota: 50_000,
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:               "tiered_expr",
			ExprString:                `tier("base", p)`,
			ExprHash:                  billingexpr.ExprHashString(`tier("base", p)`),
			GroupRatio:                0.10,
			EstimatedQuotaBeforeGroup: 500_000,
			EstimatedQuotaAfterGroup:  50_000,
			QuotaPerUnit:              testQuotaPerUnit,
		},
		PriceData: types.PriceData{
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 0.20},
		},
	}
	session := &BillingSession{
		relayInfo:        relayInfo,
		funding:          &WalletFunding{userId: userID, consumed: 50_000},
		preConsumedQuota: 50_000,
	}
	relayInfo.Billing = session

	require.Nil(t, PrepareTieredBillingForSelectedGroup(nil, relayInfo))

	// Full reservation recorded; wallet charged the full delta into arrears.
	assert.Equal(t, 100_000, session.GetPreConsumedQuota())
	assert.Equal(t, 100_000, relayInfo.FinalPreConsumedQuota)
	assert.Equal(t, 100_000, relayInfo.TieredBillingSnapshot.EstimatedQuotaAfterGroup)
	userQuota, err := model.GetUserQuota(userID, false)
	require.NoError(t, err)
	assert.Equal(t, -30_000, userQuota)

	// Settlement still reconciles against the full reservation: actual 80k
	// refunds the 20k over-reserve, landing at seed - (actual - initial) = -10k.
	require.NoError(t, session.Settle(80_000))
	userQuota, err = model.GetUserQuota(userID, false)
	require.NoError(t, err)
	assert.Equal(t, -10_000, userQuota)
}

func TestBillingSessionReserveWalletTopUpDecrementsBalance(t *testing.T) {
	truncate(t)

	const userID = 702
	seedUser(t, userID, 500_000)

	relayInfo := &relaycommon.RelayInfo{
		UserId:       userID,
		IsPlayground: true,
	}
	session := &BillingSession{
		relayInfo:        relayInfo,
		funding:          &WalletFunding{userId: userID, consumed: 50_000},
		preConsumedQuota: 50_000,
	}

	require.NoError(t, session.Reserve(100_000))

	assert.Equal(t, 100_000, session.GetPreConsumedQuota())
	assert.Equal(t, 100_000, relayInfo.FinalPreConsumedQuota)
	userQuota, err := model.GetUserQuota(userID, false)
	require.NoError(t, err)
	assert.Equal(t, 450_000, userQuota)
}

func TestTryTieredSettleUsesFinalGroupAfterRetry(t *testing.T) {
	const expr = `tier("base", p)`
	tests := []struct {
		name            string
		finalGroupRatio float64
		wantQuota       int
	}{
		{name: "more expensive final group", finalGroupRatio: 0.20, wantQuota: 100_000},
		{name: "free final group", finalGroupRatio: 0, wantQuota: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			relayInfo := &relaycommon.RelayInfo{
				Billing:               &recordingBillingSettler{preConsumedQuota: 50_000},
				FinalPreConsumedQuota: 50_000,
				TieredBillingSnapshot: &billingexpr.BillingSnapshot{
					BillingMode:               "tiered_expr",
					ExprString:                expr,
					ExprHash:                  billingexpr.ExprHashString(expr),
					GroupRatio:                0.10,
					EstimatedQuotaBeforeGroup: 500_000,
					EstimatedQuotaAfterGroup:  50_000,
					QuotaPerUnit:              testQuotaPerUnit,
				},
				PriceData: types.PriceData{
					GroupRatioInfo: types.GroupRatioInfo{GroupRatio: tt.finalGroupRatio},
				},
			}

			require.Nil(t, PrepareTieredBillingForSelectedGroup(nil, relayInfo))
			ok, quota, result := TryTieredSettle(relayInfo, billingexpr.TokenParams{P: 1_000_000})

			require.True(t, ok)
			require.NotNil(t, result)
			assert.Equal(t, tt.wantQuota, quota)
			assert.Equal(t, tt.finalGroupRatio, relayInfo.TieredBillingSnapshot.GroupRatio)
			assert.Equal(t, tt.wantQuota, relayInfo.TieredBillingSnapshot.EstimatedQuotaAfterGroup)
		})
	}
}

func TestTryTieredSettle_GroupRatioScaling(t *testing.T) {
	info := makeRelayInfo(flatExpr, 1.5, 1000, 500)

	ok, quota, _ := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500})
	require.True(t, ok, "expected tiered settle")
	// exprCost = 7000, quotaBeforeGroup = 3500, afterGroup = round(3500 * 1.5) = 5250
	require.Equal(t, 5250, quota)
}

func TestTryTieredSettle_GroupRatioZero(t *testing.T) {
	info := makeRelayInfo(flatExpr, 0, 1000, 500)

	ok, quota, _ := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500})
	require.True(t, ok, "expected tiered settle")
	require.Equal(t, 0, quota)
}

// ---------------------------------------------------------------------------
// Ratio mode (negative tests) — TryTieredSettle must return false
// ---------------------------------------------------------------------------

func TestTryTieredSettle_RatioMode_NilSnapshot(t *testing.T) {
	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: nil,
	}

	ok, _, _ := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500})
	require.False(t, ok, "expected TryTieredSettle to return false when snapshot is nil")
}

func TestTryTieredSettle_RatioMode_WrongBillingMode(t *testing.T) {
	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode: "ratio",
			ExprString:  flatExpr,
			ExprHash:    billingexpr.ExprHashString(flatExpr),
			GroupRatio:  1.0,
		},
	}

	ok, _, _ := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500})
	require.False(t, ok, "expected TryTieredSettle to return false for ratio billing mode")
}

func TestTryTieredSettle_RatioMode_EmptyBillingMode(t *testing.T) {
	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode: "",
			ExprString:  flatExpr,
			ExprHash:    billingexpr.ExprHashString(flatExpr),
			GroupRatio:  1.0,
		},
	}

	ok, _, _ := TryTieredSettle(info, billingexpr.TokenParams{P: 1000, C: 500})
	require.False(t, ok, "expected TryTieredSettle to return false for empty billing mode")
}

// ---------------------------------------------------------------------------
// Fallback tests
// ---------------------------------------------------------------------------

func TestTryTieredSettle_ErrorFallbackToEstimatedQuotaAfterGroup(t *testing.T) {
	info := &relaycommon.RelayInfo{
		FinalPreConsumedQuota: 0,
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:              "tiered_expr",
			ExprString:               `invalid expr!!!`,
			ExprHash:                 billingexpr.ExprHashString(`invalid expr!!!`),
			GroupRatio:               1.0,
			EstimatedQuotaAfterGroup: 999,
		},
	}

	ok, quota, result := TryTieredSettle(info, billingexpr.TokenParams{P: 100})
	require.True(t, ok, "expected tiered settle to apply")
	// FinalPreConsumedQuota is 0, should fall back to EstimatedQuotaAfterGroup
	require.Equal(t, 999, quota)
	require.Nil(t, result)
}

// ---------------------------------------------------------------------------
// BuildTieredTokenParams: token normalization and expression pricing tests
// ---------------------------------------------------------------------------

func tieredQuota(t *testing.T, exprStr string, usage *dto.Usage, isClaudeSemantic bool, groupRatio float64) int {
	t.Helper()
	usedVars := billingexpr.UsedVars(exprStr)
	params := BuildTieredTokenParams(usage, isClaudeSemantic, usedVars)
	result, err := billingexpr.ComputeTieredQuota(&billingexpr.BillingSnapshot{
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   groupRatio,
		QuotaPerUnit: testQuotaPerUnit,
	}, params)
	require.NoError(t, err)
	return result.ActualQuotaAfterGroup
}

func TestBuildTieredTokenParams_GPT_WithCache(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 500,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 200,
			TextTokens:   800,
		},
	}
	expr := `tier("base", p * 2.5 + c * 15 + cr * 0.25)`
	got := tieredQuota(t, expr, usage, false, 1.0)
	// P=800, C=500, CR=200 → (800*2.5 + 500*15 + 200*0.25) * 0.5 = 4775
	assert.Equal(t, 4775, got)
}

func TestBuildTieredTokenParams_GPT_NoCacheVar(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 500,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 200,
			TextTokens:   800,
		},
	}
	expr := `tier("base", p * 2.5 + c * 15)`
	got := tieredQuota(t, expr, usage, false, 1.0)
	// No cr → P=1000 (cache stays in P), C=500 → (1000*2.5 + 500*15) * 0.5 = 5000
	assert.Equal(t, 5000, got)
}

func TestBuildTieredTokenParams_GPT_WithImage(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 500,
		PromptTokensDetails: dto.InputTokenDetails{
			ImageTokens: 200,
			TextTokens:  800,
		},
	}
	expr := `tier("base", p * 2 + c * 8 + img * 2.5)`
	got := tieredQuota(t, expr, usage, false, 1.0)
	// P=800, C=500, Img=200 → (800*2 + 500*8 + 200*2.5) * 0.5 = 3050
	assert.Equal(t, 3050, got)
}

func TestBuildTieredTokenParams_Claude_WithCache(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     800,
		CompletionTokens: 500,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 200,
			TextTokens:   800,
		},
	}
	expr := `tier("base", p * 3 + c * 15 + cr * 0.3)`
	got := tieredQuota(t, expr, usage, true, 1.0)
	// Claude: P=800 (no subtraction), C=500, CR=200 → (800*3 + 500*15 + 200*0.3) * 0.5 = 4980
	assert.Equal(t, 4980, got)
}

func TestBuildTieredTokenParams_GPT_AudioOutput(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 600,
		CompletionTokenDetails: dto.OutputTokenDetails{
			AudioTokens: 100,
			TextTokens:  500,
		},
	}
	expr := `tier("base", p * 2 + c * 10 + ao * 50)`
	got := tieredQuota(t, expr, usage, false, 1.0)
	// C=600-100=500, AO=100 → (1000*2 + 500*10 + 100*50) * 0.5 = 6000
	assert.Equal(t, 6000, got)
}

func TestBuildTieredTokenParams_GPT_AudioOutputNoVar(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 600,
		CompletionTokenDetails: dto.OutputTokenDetails{
			AudioTokens: 100,
			TextTokens:  500,
		},
	}
	expr := `tier("base", p * 2 + c * 10)`
	got := tieredQuota(t, expr, usage, false, 1.0)
	// No ao → C=600 (audio stays in C) → (1000*2 + 600*10) * 0.5 = 4000
	assert.Equal(t, 4000, got)
}

func TestBuildTieredTokenParams_AppliesGroupRatio(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     10000,
		CompletionTokens: 2000,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 3000,
			TextTokens:   7000,
		},
	}
	expr := `tier("base", p * 2.5 + c * 15 + cr * 0.25)`
	// (7000*2.5 + 2000*15 + 3000*0.25) / 2 = 24125 before group scaling.
	// Settlement rounds half units away from zero after applying the group ratio.
	for _, tc := range []struct {
		ratio float64
		quota int
	}{
		{1, 24125},
		{1.5, 36188},
		{2, 48250},
		{0.5, 12063},
	} {
		assert.Equal(t, tc.quota, tieredQuota(t, expr, usage, false, tc.ratio), "group ratio %v", tc.ratio)
	}
}

func TestBuildTieredTokenParams_PricesImageTokensSeparately(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     5000,
		CompletionTokens: 4000,
		PromptTokensDetails: dto.InputTokenDetails{
			ImageTokens: 1000,
			TextTokens:  4000,
		},
	}
	expr := `tier("base", p * 2 + c * 8 + img * 2.5)`
	// (4000*2 + 4000*8 + 1000*2.5) / 2 = 21250.
	assert.Equal(t, 21250, tieredQuota(t, expr, usage, false, 1))
}

// ---------------------------------------------------------------------------
// BuildTieredTokenParams: Len computation tests
// ---------------------------------------------------------------------------

func TestBuildTieredTokenParams_Len_GPT(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     10000,
		CompletionTokens: 2000,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 3000,
			TextTokens:   7000,
		},
	}
	expr := `tier("base", p * 2.5 + c * 15 + cr * 0.25)`
	usedVars := billingexpr.UsedVars(expr)
	params := BuildTieredTokenParams(usage, false, usedVars)

	// Non-Claude: Len = raw PromptTokens
	require.Equal(t, float64(10000), params.Len)
	// P should be reduced by cache
	require.Equal(t, float64(7000), params.P)
}

func TestBuildTieredTokenParams_Len_Claude(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     5000,
		CompletionTokens: 2000,
		UsageSemantic:    "anthropic",
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 3000,
			TextTokens:   5000,
		},
		ClaudeCacheCreation5mTokens: 1000,
		ClaudeCacheCreation1hTokens: 500,
	}
	expr := `tier("base", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6)`
	usedVars := billingexpr.UsedVars(expr)
	params := BuildTieredTokenParams(usage, true, usedVars)

	// Claude: Len = PromptTokens + CachedTokens + CacheCreation5m + CacheCreation1h
	wantLen := float64(5000 + 3000 + 1000 + 500)
	require.Equal(t, wantLen, params.Len)
	// Claude: P is not reduced (isClaudeUsageSemantic = true)
	require.Equal(t, float64(5000), params.P)
}

func TestBuildTieredTokenParams_Len_TierCondition(t *testing.T) {
	// Test that len-based tier conditions work correctly when p is reduced by cache
	usage := &dto.Usage{
		PromptTokens:     300000,
		CompletionTokens: 5000,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 250000,
			TextTokens:   50000,
		},
	}
	expr := `len <= 200000 ? tier("standard", p * 3 + c * 15 + cr * 0.3) : tier("long_context", p * 6 + c * 22.5 + cr * 0.6)`
	usedVars := billingexpr.UsedVars(expr)
	params := BuildTieredTokenParams(usage, false, usedVars)

	// Len = 300000 (raw prompt), P = 50000 (300000 - 250000 cache)
	require.Equal(t, float64(300000), params.Len)
	require.Equal(t, float64(50000), params.P)

	// Run expression: len=300000 > 200000, so long_context tier
	cost, trace, err := billingexpr.RunExpr(expr, params)
	require.NoError(t, err)
	require.Equal(t, "long_context", trace.MatchedTier)
	// long_context: 50000*6 + 5000*22.5 + 250000*0.6
	wantCost := 50000.0*6 + 5000*22.5 + 250000*0.6
	require.InDelta(t, wantCost, cost, 1e-6)
}
