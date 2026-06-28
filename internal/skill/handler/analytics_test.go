package handler

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetOpsSkillAnalyticsOverviewAggregatesUsageEvents(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	withAnalyticsNow(t, end.Add(10*time.Minute))
	skillA := createAnalyticsSkill(t, db, "alpha", enums.RequiredPlanFree)
	skillB := createAnalyticsSkill(t, db, "beta", enums.RequiredPlanPro)

	emitAnalyticsEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, 1, skillA.ID, enums.EntryPointMarketplaceCard, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeDetailView, 1, skillA.ID, enums.EntryPointSkillDetail, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeEnabled, 1, skillA.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, 1, skillA.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(5*time.Hour), enums.SkillUsageEventTypeUsed, 1, skillA.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(6*time.Hour), enums.SkillUsageEventTypeUsed, 1, skillA.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(7*time.Hour), enums.SkillUsageEventTypeBlocked, 2, skillA.ID, enums.EntryPointSkillPackage, nil, blockReasonPtr(enums.BlockReasonPlanRequired))

	emitAnalyticsEvent(t, db, start.Add(8*time.Hour), enums.SkillUsageEventTypeImpression, 2, skillB.ID, enums.EntryPointMarketplaceCard, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(9*time.Hour), enums.SkillUsageEventTypeUsed, 2, skillB.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(10*time.Hour), enums.SkillUsageEventTypeUsed, 3, skillB.ID, enums.EntryPointSkillPackage, boolPtr(false), nil)
	emitAnalyticsEvent(t, db, start.Add(11*time.Hour), enums.SkillUsageEventTypeUsed, 9, skillB.ID, enums.EntryPointAdminPreview, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, end.Add(5*time.Minute), enums.SkillUsageEventTypeImpression, 10, skillB.ID, enums.EntryPointMarketplaceCard, nil, nil)

	w := performAnalyticsHandlerRequest(t, "/?start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsOverview)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsOverview
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, int64(2), got.WASU)
	assert.Equal(t, int64(3), got.TotalSkillRuns)
	assert.InDelta(t, 0.5, *got.DetailCTR, 0.0001)
	assert.InDelta(t, 1.0, *got.EnableRate, 0.0001)
	assert.InDelta(t, 1.0, *got.FirstUseRate, 0.0001)
	assert.InDelta(t, 0.5, *got.RepeatUseRate, 0.0001)
	assert.InDelta(t, 0.25, *got.BlockRate, 0.0001)
	require.NotNil(t, got.TopBlockReason)
	assert.Equal(t, "plan_required", *got.TopBlockReason)
	assert.Nil(t, got.RevenueAttributionUS)
	assert.False(t, got.ChargingEnabled)
	assert.Equal(t, "ok", got.DataFreshness)
	assert.Equal(t, start.Format(time.RFC3339), got.PeriodStart)
	assert.Equal(t, end.Format(time.RFC3339), got.PeriodEnd)
	assert.NotContains(t, w.Body.String(), "metadata")
}

func TestGetOpsSkillAnalyticsOverviewMonetizationGatedByCharging(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	withChargingDisabled(t)
	skill := createAnalyticsSkill(t, db, "paid-skill", enums.RequiredPlanPro)
	emitSuccessfulTopUp(t, db, 1, start.Add(time.Hour), 10)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeFirstUse, 1, skill.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeUsed, 1, skill.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitSuccessfulTopUp(t, db, 1, start.Add(4*time.Hour), 20)

	w := performAnalyticsHandlerRequest(t, "/?start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsOverview)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsOverview
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	assert.False(t, got.ChargingEnabled)
	assert.Nil(t, got.RechargeToFirstUseRate)
	assert.Nil(t, got.SkillUseToRepeatRechargeRate)
	assert.Nil(t, got.MedianTimeToFirstUseSeconds)
	assert.Nil(t, got.RevenueAttributionUS)
}

func TestGetOpsSkillAnalyticsOverviewJoinsTopUpsToSkillFunnels(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	withStripeChargingEnabled(t)
	skillA := createAnalyticsSkill(t, db, "paid-alpha", enums.RequiredPlanPro)
	skillB := createAnalyticsSkill(t, db, "paid-beta", enums.RequiredPlanFree)

	emitSuccessfulTopUp(t, db, 1, start.Add(time.Hour), 10)
	emitSuccessfulTopUp(t, db, 2, start.Add(time.Hour), 12)
	emitSuccessfulTopUp(t, db, 3, start.Add(time.Hour), 9)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeFirstUse, 1, skillA.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, 2, skillB.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeUsed, 1, skillA.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeUsed, 2, skillB.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeUsed, 3, skillB.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitSuccessfulTopUp(t, db, 1, start.Add(5*time.Hour), 30)
	emitSuccessfulTopUp(t, db, 2, start.Add(6*time.Hour), 40)

	w := performAnalyticsHandlerRequest(t, "/?start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsOverview)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsOverview
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	assert.True(t, got.ChargingEnabled)
	assert.Equal(t, int64(5), got.RechargeCount)
	assert.Equal(t, int64(2), got.RechargeToFirstUseConversions)
	require.NotNil(t, got.RechargeToFirstUseRate)
	assert.InDelta(t, 0.4, *got.RechargeToFirstUseRate, 0.0001)
	require.NotNil(t, got.MedianTimeToFirstUseSeconds)
	assert.Equal(t, int64(9000), *got.MedianTimeToFirstUseSeconds)
	assert.Equal(t, int64(3), got.SkillUseToRepeatRechargeUserCohort)
	assert.Equal(t, int64(2), got.SkillUseToRepeatRechargeUsers)
	require.NotNil(t, got.SkillUseToRepeatRechargeRate)
	assert.InDelta(t, float64(2)/float64(3), *got.SkillUseToRepeatRechargeRate, 0.0001)
	require.NotNil(t, got.RevenueAttributionUS)
	assert.InDelta(t, 70, *got.RevenueAttributionUS, 0.0001)
}

func TestGetOpsSkillAnalyticsOverviewEnforcesOrderedFunnelAndSessionIdentity(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	withAnalyticsNow(t, end.Add(10*time.Minute))
	skill := createAnalyticsSkill(t, db, "ordered", enums.RequiredPlanFree)

	emitAnalyticsEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, 1, skill.ID, enums.EntryPointMarketplaceCard, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeDetailView, 1, skill.ID, enums.EntryPointSkillDetail, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeEnabled, 1, skill.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, 1, skill.ID, enums.EntryPointSkillPackage, nil, nil)

	anonSession := "anon-session-1"
	emitAnalyticsSessionEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, nil, &anonSession, skill.ID, enums.EntryPointMarketplaceCard, false, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeDetailView, nil, &anonSession, skill.ID, enums.EntryPointSkillDetail, false, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeEnabled, nil, &anonSession, skill.ID, enums.EntryPointSkillPackage, false, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, nil, &anonSession, skill.ID, enums.EntryPointSkillPackage, false, nil, nil)

	// This identity has all funnel stages but in the wrong order. It contributes
	// to the impression denominator only; later stages must not inflate conversion.
	emitAnalyticsEvent(t, db, start.Add(9*time.Hour), enums.SkillUsageEventTypeFirstUse, 2, skill.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(10*time.Hour), enums.SkillUsageEventTypeEnabled, 2, skill.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(11*time.Hour), enums.SkillUsageEventTypeDetailView, 2, skill.ID, enums.EntryPointSkillDetail, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(12*time.Hour), enums.SkillUsageEventTypeImpression, 2, skill.ID, enums.EntryPointMarketplaceCard, nil, nil)

	kidsSession := "kids-session-1"
	emitAnalyticsSessionEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, nil, &kidsSession, skill.ID, enums.EntryPointMarketplaceCard, true, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeDetailView, nil, &kidsSession, skill.ID, enums.EntryPointSkillDetail, true, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeEnabled, nil, &kidsSession, skill.ID, enums.EntryPointSkillPackage, true, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, nil, &kidsSession, skill.ID, enums.EntryPointSkillPackage, true, nil, nil)

	w := performAnalyticsHandlerRequest(t, "/?include_kids=true&start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsOverview)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsOverview
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.NotNil(t, got.DetailCTR)
	require.NotNil(t, got.EnableRate)
	require.NotNil(t, got.FirstUseRate)
	assert.InDelta(t, 0.75, *got.DetailCTR, 0.0001)
	assert.InDelta(t, 1.0, *got.EnableRate, 0.0001)
	assert.InDelta(t, 1.0, *got.FirstUseRate, 0.0001)
}

func TestGetOpsSkillAnalyticsOverviewKidsSessionsExcludedByDefaultAndIncludedWhenRequested(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	withAnalyticsNow(t, end.Add(10*time.Minute))
	skill := createAnalyticsSkill(t, db, "kids", enums.RequiredPlanFree)
	kidsSession := "kids-session-runs"

	emitAnalyticsSessionEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, nil, &kidsSession, skill.ID, enums.EntryPointMarketplaceCard, true, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeUsed, nil, &kidsSession, skill.ID, enums.EntryPointSkillPackage, true, boolPtr(true), nil)

	defaultW := performAnalyticsHandlerRequest(t, "/?start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsOverview)
	require.Equal(t, http.StatusOK, defaultW.Code)
	var defaultGot SkillAnalyticsOverview
	require.NoError(t, common.Unmarshal(defaultW.Body.Bytes(), &defaultGot))
	assert.Equal(t, int64(0), defaultGot.WASU)
	assert.Equal(t, int64(0), defaultGot.TotalSkillRuns)
	assert.Nil(t, defaultGot.DetailCTR)

	includeW := performAnalyticsHandlerRequest(t, "/?include_kids=true&start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsOverview)
	require.Equal(t, http.StatusOK, includeW.Code)
	var includeGot SkillAnalyticsOverview
	require.NoError(t, common.Unmarshal(includeW.Body.Bytes(), &includeGot))
	assert.Equal(t, int64(1), includeGot.WASU)
	assert.Equal(t, int64(1), includeGot.TotalSkillRuns)
	require.NotNil(t, includeGot.DetailCTR)
	assert.InDelta(t, 0.0, *includeGot.DetailCTR, 0.0001)
}

func TestGetOpsSkillAnalyticsSkillsReturnsPerSkillRows(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	withAnalyticsNow(t, end)
	skillA := createAnalyticsSkill(t, db, "alpha", enums.RequiredPlanFree)
	skillB := createAnalyticsSkill(t, db, "beta", enums.RequiredPlanPro)

	require.NoError(t, skillmodel.EnableSkillForUser(db, 1, 1, skillA.ID, "marketplace"))
	require.NoError(t, skillmodel.EnableSkillForUser(db, 2, 2, skillA.ID, "marketplace"))
	require.NoError(t, skillmodel.EnableSkillForUser(db, 3, 3, skillB.ID, "marketplace"))

	success := true
	emitAnalyticsEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, 1, skillA.ID, enums.EntryPointMarketplaceCard, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeDetailView, 1, skillA.ID, enums.EntryPointSkillDetail, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeEnabled, 1, skillA.ID, enums.EntryPointSkillPackage, &success, nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour+time.Minute), enums.SkillUsageEventTypePurchased, 2, skillA.ID, enums.EntryPointSkillDetail, &success, nil)
	emitAnalyticsEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, 1, skillA.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(5*time.Hour), enums.SkillUsageEventTypeUsed, 1, skillA.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(6*time.Hour), enums.SkillUsageEventTypeUsed, 1, skillA.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(7*time.Hour), enums.SkillUsageEventTypeBlocked, 2, skillA.ID, enums.EntryPointSkillPackage, nil, blockReasonPtr(enums.BlockReasonKidsModeBlocked))

	emitAnalyticsEvent(t, db, start.Add(8*time.Hour), enums.SkillUsageEventTypeUsed, 3, skillB.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(9*time.Hour), enums.SkillUsageEventTypeUsed, 9, skillB.ID, enums.EntryPointAdminPreview, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(-8*24*time.Hour), enums.SkillUsageEventTypeEnabled, 3, skillB.ID, enums.EntryPointSkillPackage, &success, nil)

	w := performAnalyticsHandlerRequest(t, "/?start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsSkills)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsSkillsResponse
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Skills, 2)
	alpha := got.Skills[0]
	assert.Equal(t, skillA.ID, alpha.SkillID)
	assert.Equal(t, "alpha", alpha.SkillName)
	assert.Equal(t, enums.SkillStatusPublished, alpha.Status)
	assert.Equal(t, enums.RequiredPlanFree, alpha.RequiredPlan)
	assert.Equal(t, int64(2), alpha.EnabledUsers)
	assert.Equal(t, int64(2), alpha.Downloads7D)
	assert.Equal(t, int64(2), alpha.Downloads30D)
	assert.Equal(t, int64(1), alpha.ActiveUsers)
	assert.Equal(t, int64(2), alpha.SuccessfulRuns)
	assert.InDelta(t, 1.0, *alpha.DetailCTR, 0.0001)
	assert.InDelta(t, 1.0, *alpha.EnableRate, 0.0001)
	assert.InDelta(t, 1.0, *alpha.FirstUseRate, 0.0001)
	assert.InDelta(t, 1.0, *alpha.RepeatUseRate, 0.0001)
	assert.InDelta(t, float64(1)/float64(3), *alpha.BlockRate, 0.0001)
	assert.Nil(t, alpha.RevenueAttributionUS)

	beta := got.Skills[1]
	assert.Equal(t, skillB.ID, beta.SkillID)
	assert.Equal(t, int64(1), beta.EnabledUsers)
	assert.Equal(t, int64(0), beta.Downloads7D)
	assert.Equal(t, int64(1), beta.Downloads30D)
	assert.Equal(t, int64(1), beta.ActiveUsers)
	assert.Equal(t, int64(1), beta.SuccessfulRuns)
	assert.False(t, got.ChargingEnabled)
	assert.Equal(t, int64(2), got.Pagination.Total)
	assert.NotContains(t, w.Body.String(), "instruction_template")
	assert.NotContains(t, w.Body.String(), "metadata")
}

func TestGetOpsSkillAnalyticsSkillsReturnsPerSkillMonetizationSlices(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	withStripeChargingEnabled(t)
	skillA := createAnalyticsSkill(t, db, "paid-alpha", enums.RequiredPlanPro)
	skillB := createAnalyticsSkill(t, db, "paid-beta", enums.RequiredPlanFree)
	emitSuccessfulTopUp(t, db, 1, start.Add(time.Hour), 10)
	emitSuccessfulTopUp(t, db, 2, start.Add(time.Hour), 12)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeFirstUse, 1, skillA.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, 2, skillB.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeUsed, 1, skillA.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitSuccessfulTopUp(t, db, 1, start.Add(5*time.Hour), 30)

	w := performAnalyticsHandlerRequest(t, "/?start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsSkills)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsSkillsResponse
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	assert.True(t, got.ChargingEnabled)
	require.Len(t, got.Skills, 2)
	alpha := got.Skills[0]
	assert.Equal(t, skillA.ID, alpha.SkillID)
	assert.Equal(t, enums.RequiredPlanPro, alpha.RequiredPlan)
	assert.Equal(t, int64(3), alpha.RechargeCount)
	assert.Equal(t, int64(1), alpha.RechargeToFirstUseConversions)
	require.NotNil(t, alpha.RechargeToFirstUseRate)
	assert.InDelta(t, float64(1)/float64(3), *alpha.RechargeToFirstUseRate, 0.0001)
	require.NotNil(t, alpha.MedianTimeToFirstUseSeconds)
	assert.Equal(t, int64(7200), *alpha.MedianTimeToFirstUseSeconds)
	assert.Equal(t, int64(1), alpha.SkillUseToRepeatRechargeUserCohort)
	assert.Equal(t, int64(1), alpha.SkillUseToRepeatRechargeUsers)
	require.NotNil(t, alpha.RevenueAttributionUS)
	assert.InDelta(t, 30, *alpha.RevenueAttributionUS, 0.0001)
}

func TestGetOpsSkillAnalyticsSkillsEnforcesOrderedFunnelWithSessionIdentity(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	skill := createAnalyticsSkill(t, db, "skill-funnel", enums.RequiredPlanFree)

	emitAnalyticsEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, 1, skill.ID, enums.EntryPointMarketplaceCard, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeDetailView, 1, skill.ID, enums.EntryPointSkillDetail, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeEnabled, 1, skill.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, 1, skill.ID, enums.EntryPointSkillPackage, nil, nil)

	anonSession := "anon-skill-funnel"
	emitAnalyticsSessionEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, nil, &anonSession, skill.ID, enums.EntryPointMarketplaceCard, false, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeDetailView, nil, &anonSession, skill.ID, enums.EntryPointSkillDetail, false, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeEnabled, nil, &anonSession, skill.ID, enums.EntryPointSkillPackage, false, nil, nil)
	emitAnalyticsSessionEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, nil, &anonSession, skill.ID, enums.EntryPointSkillPackage, false, nil, nil)

	emitAnalyticsEvent(t, db, start.Add(9*time.Hour), enums.SkillUsageEventTypeEnabled, 2, skill.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(10*time.Hour), enums.SkillUsageEventTypeDetailView, 2, skill.ID, enums.EntryPointSkillDetail, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(11*time.Hour), enums.SkillUsageEventTypeImpression, 2, skill.ID, enums.EntryPointMarketplaceCard, nil, nil)

	w := performAnalyticsHandlerRequest(t, "/?start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsSkills)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsSkillsResponse
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Skills, 1)
	row := got.Skills[0]
	require.NotNil(t, row.DetailCTR)
	require.NotNil(t, row.EnableRate)
	require.NotNil(t, row.FirstUseRate)
	assert.InDelta(t, float64(2)/float64(3), *row.DetailCTR, 0.0001)
	assert.InDelta(t, 1.0, *row.EnableRate, 0.0001)
	assert.InDelta(t, 1.0, *row.FirstUseRate, 0.0001)
}

func TestGetOpsSkillAnalyticsSkillsPaginatesDBOrderedRows(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	alpha := createAnalyticsSkill(t, db, "alpha", enums.RequiredPlanFree)
	beta := createAnalyticsSkill(t, db, "beta", enums.RequiredPlanFree)
	gamma := createAnalyticsSkill(t, db, "gamma", enums.RequiredPlanFree)

	emitAnalyticsEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeUsed, 1, gamma.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeUsed, 2, gamma.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeUsed, 3, beta.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeUsed, 4, gamma.ID, enums.EntryPointAdminPreview, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(5*time.Hour), enums.SkillUsageEventTypeUsed, 5, alpha.ID, enums.EntryPointSkillPackage, boolPtr(false), nil)

	w := performAnalyticsHandlerRequest(
		t,
		"/?start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339)+"&page=2&limit=1",
		GetOpsSkillAnalyticsSkills,
	)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsSkillsResponse
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Skills, 1)
	assert.Equal(t, beta.ID, got.Skills[0].SkillID)
	assert.Equal(t, int64(1), got.Skills[0].SuccessfulRuns)
	assert.Equal(t, 2, got.Pagination.Page)
	assert.Equal(t, 1, got.Pagination.Limit)
	assert.Equal(t, int64(3), got.Pagination.Total)
	assert.True(t, got.Pagination.HasNext)
}

func TestGetOpsSkillAnalyticsSkillsReturnsSavedDemandAndMostSavedSort(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	alpha := createAnalyticsSkill(t, db, "alpha", enums.RequiredPlanFree)
	beta := createAnalyticsSkill(t, db, "beta", enums.RequiredPlanFree)

	require.NoError(t, skillmodel.SaveSkillForUser(db, 1, 1, alpha.ID, "skill_detail"))
	require.NoError(t, skillmodel.SaveSkillForUser(db, 2, 2, beta.ID, "skill_detail"))
	require.NoError(t, skillmodel.SaveSkillForUser(db, 3, 3, beta.ID, "skill_detail"))
	require.NoError(t, skillmodel.EnableSkillForUser(db, 2, 2, beta.ID, "marketplace"))
	require.NoError(t, skillmodel.UpdateLastUsedAt(db, 2, 2, beta.ID))

	emitAnalyticsEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeUsed, 1, alpha.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeUsed, 1, alpha.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeUsed, 2, beta.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)

	w := performAnalyticsHandlerRequest(t, "/?sort=most_saved&start="+start.Format(time.RFC3339)+"&end="+end.Format(time.RFC3339), GetOpsSkillAnalyticsSkills)

	require.Equal(t, http.StatusOK, w.Code)
	var got SkillAnalyticsSkillsResponse
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got.Skills, 2)
	assert.Equal(t, beta.ID, got.Skills[0].SkillID)
	assert.Equal(t, int64(2), got.Skills[0].SavedUsers)
	assert.Equal(t, int64(1), got.Skills[0].SavedButUnusedUsers)
	assert.Equal(t, int64(1), got.Skills[1].SavedUsers)
	assert.Equal(t, int64(1), got.Skills[1].SavedButUnusedUsers)
	assert.NotContains(t, w.Body.String(), "metadata")
}

func TestDataFreshnessFromLatestP0Event(t *testing.T) {
	now := time.Date(2026, 6, 8, 12, 0, 0, 0, time.UTC)

	assert.Equal(t, "ok", dataFreshnessFromLatest(now.Add(-15*time.Minute), true, now))
	assert.Equal(t, "delayed", dataFreshnessFromLatest(now.Add(-16*time.Minute), true, now))
	assert.Equal(t, "delayed", dataFreshnessFromLatest(now.Add(-60*time.Minute), true, now))
	assert.Equal(t, "failed", dataFreshnessFromLatest(now.Add(-61*time.Minute), true, now))
	assert.Equal(t, "ok", dataFreshnessFromLatest(time.Time{}, false, now))
}

func TestDataFreshnessNoEventsIsOKForLowTraffic(t *testing.T) {
	db := newAnalyticsTestDB(t)
	withAnalyticsNow(t, time.Date(2026, 6, 8, 12, 0, 0, 0, time.UTC))

	got, err := dataFreshness(db)

	require.NoError(t, err)
	assert.Equal(t, "ok", got)
}

func TestDataFreshnessIgnoresAdminPreview(t *testing.T) {
	db := newAnalyticsTestDB(t)
	now := time.Date(2026, 6, 8, 12, 0, 0, 0, time.UTC)
	withAnalyticsNow(t, now)
	skill := createAnalyticsSkill(t, db, "freshness", enums.RequiredPlanFree)

	emitAnalyticsEvent(t, db, now.Add(-2*time.Hour), enums.SkillUsageEventTypeUsed, 1, skill.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, now.Add(-5*time.Minute), enums.SkillUsageEventTypeUsed, 2, skill.ID, enums.EntryPointAdminPreview, boolPtr(true), nil)

	got, err := dataFreshness(db)

	require.NoError(t, err)
	assert.Equal(t, "failed", got)
}

func TestGetOpsSkillAnalyticsRejectsInvalidDateRange(t *testing.T) {
	_ = newAnalyticsTestDB(t)
	w := performAnalyticsHandlerRequest(t, "/?start=2026-06-08T00:00:00Z&end=2026-06-01T00:00:00Z", GetOpsSkillAnalyticsOverview)

	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
	assert.Contains(t, w.Body.String(), `"reason":"INVALID_RANGE"`)
}

func TestGetOpsSkillAnalyticsRejectsRangeAboveMaxWindow(t *testing.T) {
	_ = newAnalyticsTestDB(t)
	w := performAnalyticsHandlerRequest(t, "/?start=2026-06-01T00:00:00Z&end=2026-07-02T00:00:00Z", GetOpsSkillAnalyticsOverview)

	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
	assert.Contains(t, w.Body.String(), `"reason":"INVALID_RANGE"`)
	assert.Contains(t, w.Body.String(), "30 days or less")
}

func TestGetOpsSkillAnalyticsRejectsInvalidIncludeKids(t *testing.T) {
	_ = newAnalyticsTestDB(t)
	w := performAnalyticsHandlerRequest(t, "/?include_kids=sometimes", GetOpsSkillAnalyticsOverview)

	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
	assert.Contains(t, w.Body.String(), `"reason":"INVALID_INCLUDE_KIDS"`)
}

func newAnalyticsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, skillmodel.MigrateSkills(db))
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	require.NoError(t, skillmodel.MigrateUserSavedSkills(db))
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(db))
	require.NoError(t, db.AutoMigrate(&platformmodel.TopUp{}))
	SetDB(db)
	return db
}

func withAnalyticsNow(t *testing.T, now time.Time) {
	t.Helper()
	previous := analyticsNow
	analyticsNow = func() time.Time { return now.UTC() }
	t.Cleanup(func() {
		analyticsNow = previous
	})
}

func createAnalyticsSkill(t *testing.T, db *gorm.DB, name string, plan enums.RequiredPlan) skillmodel.Skill {
	t.Helper()
	now := time.Date(2026, 5, 31, 0, 0, 0, 0, time.UTC)
	skill := skillmodel.Skill{
		Slug:                 name,
		Status:               enums.SkillStatusPublished,
		Category:             "writing",
		Tags:                 skillmodel.SkillJSONB(`[]`),
		DefaultLocale:        "en",
		Name:                 name,
		ShortDescription:     "short " + name,
		Description:          "long " + name,
		InputHints:           skillmodel.SkillJSONB(`[]`),
		ExampleInputs:        skillmodel.SkillJSONB(`[]`),
		ExampleOutputs:       skillmodel.SkillJSONB(`[]`),
		RequiredPlan:         plan,
		MonetizationType:     enums.MonetizationTypeFree,
		ModelWhitelist:       skillmodel.SkillJSONB(`["smart-tier"]`),
		TimeoutSeconds:       45,
		KidsApprovalStatus:   enums.KidsApprovalStatusNotRequired,
		AIDisclosureRequired: true,
		CreatedBy:            1,
		PublishedAt:          &now,
	}
	require.NoError(t, db.Create(&skill).Error)
	return skill
}

func emitAnalyticsEvent(
	t *testing.T,
	db *gorm.DB,
	occurredAt time.Time,
	eventType enums.SkillUsageEventType,
	userID int64,
	skillID string,
	entryPoint enums.EntryPoint,
	success *bool,
	blockReason *enums.BlockReason,
) {
	t.Helper()
	uid := userID
	sid := skillID
	require.NoError(t, skillmodel.EmitSkillUsageEvent(db, skillmodel.SkillUsageEvent{
		EventType:     eventType,
		OccurredAt:    occurredAt,
		UserID:        &uid,
		TenantID:      &uid,
		SkillID:       &sid,
		EntryPoint:    entryPoint,
		Success:       success,
		BlockReason:   blockReason,
		IsKidsSession: false,
		Metadata:      skillmodel.SkillJSONB(`{}`),
	}))
}

func emitAnalyticsSessionEvent(
	t *testing.T,
	db *gorm.DB,
	occurredAt time.Time,
	eventType enums.SkillUsageEventType,
	userID *int64,
	sessionID *string,
	skillID string,
	entryPoint enums.EntryPoint,
	isKidsSession bool,
	success *bool,
	blockReason *enums.BlockReason,
) {
	t.Helper()
	sid := skillID
	event := skillmodel.SkillUsageEvent{
		EventType:     eventType,
		OccurredAt:    occurredAt,
		UserID:        userID,
		SkillID:       &sid,
		SessionID:     sessionID,
		EntryPoint:    entryPoint,
		Success:       success,
		BlockReason:   blockReason,
		IsKidsSession: isKidsSession,
		Metadata:      skillmodel.SkillJSONB(`{}`),
	}
	if userID != nil {
		event.TenantID = userID
	}
	require.NoError(t, skillmodel.EmitSkillUsageEvent(db, event))
}

func emitSuccessfulTopUp(t *testing.T, db *gorm.DB, userID int, occurredAt time.Time, money float64) {
	t.Helper()
	require.NoError(t, db.Create(&platformmodel.TopUp{
		UserId:       userID,
		Amount:       int64(money * 500000),
		Money:        money,
		TradeNo:      "trade-" + strconv.FormatInt(int64(userID), 10) + "-" + strconv.FormatInt(occurredAt.Unix(), 10),
		CreateTime:   occurredAt.Add(-time.Minute).Unix(),
		CompleteTime: occurredAt.Unix(),
		Status:       common.TopUpStatusSuccess,
	}).Error)
}

func withStripeChargingEnabled(t *testing.T) {
	t.Helper()
	previousSecret := setting.StripeApiSecret
	previousWebhook := setting.StripeWebhookSecret
	previousPrice := setting.StripePriceId
	setting.StripeApiSecret = "sk_test_dr96"
	setting.StripeWebhookSecret = "whsec_dr96"
	setting.StripePriceId = "price_dr96"
	t.Cleanup(func() {
		setting.StripeApiSecret = previousSecret
		setting.StripeWebhookSecret = previousWebhook
		setting.StripePriceId = previousPrice
	})
}

func withChargingDisabled(t *testing.T) {
	t.Helper()
	previousSecret := setting.StripeApiSecret
	previousWebhook := setting.StripeWebhookSecret
	previousPrice := setting.StripePriceId
	setting.StripeApiSecret = ""
	setting.StripeWebhookSecret = ""
	setting.StripePriceId = ""
	t.Cleanup(func() {
		setting.StripeApiSecret = previousSecret
		setting.StripeWebhookSecret = previousWebhook
		setting.StripePriceId = previousPrice
	})
}

func performAnalyticsHandlerRequest(t *testing.T, target string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, target, nil)
	handler(c)
	return w
}

func boolPtr(v bool) *bool {
	return &v
}

func blockReasonPtr(v enums.BlockReason) *enums.BlockReason {
	return &v
}
