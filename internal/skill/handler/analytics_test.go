package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
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

func TestGetOpsSkillAnalyticsSkillsReturnsPerSkillRows(t *testing.T) {
	db := newAnalyticsTestDB(t)
	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC)
	skillA := createAnalyticsSkill(t, db, "alpha", enums.RequiredPlanFree)
	skillB := createAnalyticsSkill(t, db, "beta", enums.RequiredPlanPro)

	require.NoError(t, skillmodel.EnableSkillForUser(db, 1, 1, skillA.ID, "marketplace"))
	require.NoError(t, skillmodel.EnableSkillForUser(db, 2, 2, skillA.ID, "marketplace"))
	require.NoError(t, skillmodel.EnableSkillForUser(db, 3, 3, skillB.ID, "marketplace"))

	emitAnalyticsEvent(t, db, start.Add(time.Hour), enums.SkillUsageEventTypeImpression, 1, skillA.ID, enums.EntryPointMarketplaceCard, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(2*time.Hour), enums.SkillUsageEventTypeDetailView, 1, skillA.ID, enums.EntryPointSkillDetail, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(3*time.Hour), enums.SkillUsageEventTypeEnabled, 1, skillA.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(4*time.Hour), enums.SkillUsageEventTypeFirstUse, 1, skillA.ID, enums.EntryPointSkillPackage, nil, nil)
	emitAnalyticsEvent(t, db, start.Add(5*time.Hour), enums.SkillUsageEventTypeUsed, 1, skillA.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(6*time.Hour), enums.SkillUsageEventTypeUsed, 1, skillA.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(7*time.Hour), enums.SkillUsageEventTypeBlocked, 2, skillA.ID, enums.EntryPointSkillPackage, nil, blockReasonPtr(enums.BlockReasonKidsModeBlocked))

	emitAnalyticsEvent(t, db, start.Add(8*time.Hour), enums.SkillUsageEventTypeUsed, 3, skillB.ID, enums.EntryPointSkillPackage, boolPtr(true), nil)
	emitAnalyticsEvent(t, db, start.Add(9*time.Hour), enums.SkillUsageEventTypeUsed, 9, skillB.ID, enums.EntryPointAdminPreview, boolPtr(true), nil)

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
	assert.Equal(t, int64(1), beta.ActiveUsers)
	assert.Equal(t, int64(1), beta.SuccessfulRuns)
	assert.False(t, got.ChargingEnabled)
	assert.Equal(t, int64(2), got.Pagination.Total)
	assert.NotContains(t, w.Body.String(), "instruction_template")
	assert.NotContains(t, w.Body.String(), "metadata")
}

func TestGetOpsSkillAnalyticsRejectsInvalidDateRange(t *testing.T) {
	_ = newAnalyticsTestDB(t)
	w := performAnalyticsHandlerRequest(t, "/?start=2026-06-08T00:00:00Z&end=2026-06-01T00:00:00Z", GetOpsSkillAnalyticsOverview)

	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
	assert.Contains(t, w.Body.String(), `"reason":"INVALID_RANGE"`)
}

func newAnalyticsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, skillmodel.MigrateSkills(db))
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(db))
	SetDB(db)
	return db
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
