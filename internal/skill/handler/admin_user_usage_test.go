package handler

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetAdminUserSkillUsage_ConsentedUserReturnsDownloadsTokensCostTimelineAndAudit(t *testing.T) {
	db := testAdminUserUsageDB(t)
	SetDB(db)
	targetID := int64(42)
	skill := testSkill("usage-skill", "published")
	require.NoError(t, db.Create(&skill).Error)
	require.NoError(t, db.Create(&platformmodel.User{
		Id:                    int(targetID),
		Username:              "consented-user",
		Role:                  common.RoleCommonUser,
		Status:                1,
		Tier2TelemetryConsent: true,
	}).Error)
	lastUsedAt := time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:     targetID,
		TenantID:   targetID,
		SkillID:    skill.ID,
		Enabled:    true,
		EnabledAt:  lastUsedAt.Add(-time.Hour),
		Source:     "marketplace",
		LastUsedAt: &lastUsedAt,
	}).Error)
	inputTokens := 1000
	outputTokens := 500
	totalTokens := 1500
	success := true
	modelName := "gpt-4o-mini"
	require.NoError(t, skillmodel.EmitSkillUsageEvent(db, skillmodel.SkillUsageEvent{
		EventType:    enums.SkillUsageEventTypeUsed,
		OccurredAt:   lastUsedAt,
		UserID:       &targetID,
		TenantID:     &targetID,
		SkillID:      &skill.ID,
		EntryPoint:   enums.EntryPointSkillPackage,
		Model:        &modelName,
		InputTokens:  &inputTokens,
		OutputTokens: &outputTokens,
		TotalTokens:  &totalTokens,
		Success:      &success,
		Metadata:     skillmodel.SkillJSONB(`{"producer":"relay"}`),
	}))

	c, w := testContext("/api/v1/admin/users/42/skill-usage")
	c.Params = append(c.Params, ginParam("user_id", "42"))
	c.Set("id", 7)
	c.Set("role", common.RoleRootUser)
	GetAdminUserSkillUsage(c)

	require.Equal(t, 200, w.Code)
	assert.NotContains(t, w.Body.String(), "producer")
	assert.NotContains(t, w.Body.String(), "metadata")
	assert.NotContains(t, w.Body.String(), "prompt")
	var got struct {
		Data AdminUserSkillUsageResponse `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.True(t, got.Data.ConsentGranted)
	require.False(t, got.Data.KidsProtected)
	require.Len(t, got.Data.Downloads, 1)
	assert.Equal(t, skill.ID, got.Data.Downloads[0].SkillID)
	assert.Equal(t, skill.Slug, got.Data.Downloads[0].SkillSlug)
	assert.Equal(t, int64(1000), got.Data.Downloads[0].InputTokens)
	assert.Equal(t, int64(500), got.Data.Downloads[0].OutputTokens)
	assert.Equal(t, int64(1500), got.Data.Downloads[0].TotalTokens)
	assert.InDelta(t, 0.00045, got.Data.Downloads[0].CostUSD, 0.000001)
	require.Len(t, got.Data.UsageTimeline, 1)
	assert.Equal(t, enums.SkillUsageEventTypeUsed, got.Data.UsageTimeline[0].EventType)
	assert.Equal(t, modelName, got.Data.UsageTimeline[0].Model)

	var audit skillmodel.SkillAuditLog
	require.NoError(t, db.Where("action = ?", adminUserUsageAction).First(&audit).Error)
	assert.Equal(t, int64(7), audit.ActorID)
	require.NotNil(t, audit.AfterValue)
	assert.Contains(t, string(*audit.AfterValue), `"target_user_id":42`)
}

func TestGetAdminUserSkillUsage_NonConsentedReturnsNoRowsButAudits(t *testing.T) {
	db := testAdminUserUsageDB(t)
	SetDB(db)
	require.NoError(t, db.Create(&platformmodel.User{
		Id:                    43,
		Username:              "no-consent",
		Role:                  common.RoleCommonUser,
		Status:                1,
		Tier2TelemetryConsent: false,
	}).Error)

	c, w := testContext("/api/v1/admin/users/43/skill-usage")
	c.Params = append(c.Params, ginParam("user_id", "43"))
	c.Set("id", 7)
	c.Set("role", common.RoleRootUser)
	GetAdminUserSkillUsage(c)

	require.Equal(t, 200, w.Code)
	var got struct {
		Data AdminUserSkillUsageResponse `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	assert.False(t, got.Data.ConsentGranted)
	assert.Empty(t, got.Data.Downloads)
	assert.Empty(t, got.Data.UsageTimeline)
	var auditCount int64
	require.NoError(t, db.Model(&skillmodel.SkillAuditLog{}).Where("action = ?", adminUserUsageAction).Count(&auditCount).Error)
	assert.EqualValues(t, 1, auditCount)
}

func TestGetAdminUserSkillUsage_KidsPseudoEventsAreNotDePseudonymized(t *testing.T) {
	db := testAdminUserUsageDB(t)
	SetDB(db)
	targetID := int64(44)
	skill := testSkill("kids-skill", "published")
	require.NoError(t, db.Create(&skill).Error)
	require.NoError(t, db.Create(&platformmodel.User{
		Id:                    int(targetID),
		Username:              "kids-user",
		Role:                  common.RoleCommonUser,
		Status:                1,
		KidsMode:              true,
		Tier2TelemetryConsent: true,
	}).Error)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:    targetID,
		TenantID:  targetID,
		SkillID:   skill.ID,
		Enabled:   true,
		EnabledAt: time.Now().UTC(),
		Source:    "marketplace",
	}).Error)
	pseudoID := "kids-pseudo-session"
	inputTokens := 10
	require.NoError(t, skillmodel.EmitSkillUsageEvent(db, skillmodel.SkillUsageEvent{
		EventType:     enums.SkillUsageEventTypeUsed,
		SessionID:     &pseudoID,
		SkillID:       &skill.ID,
		EntryPoint:    enums.EntryPointSkillPackage,
		IsKidsSession: true,
		InputTokens:   &inputTokens,
		Metadata:      skillmodel.SkillJSONB(`{}`),
	}))

	c, w := testContext("/api/v1/admin/users/44/skill-usage")
	c.Params = append(c.Params, ginParam("user_id", "44"))
	c.Set("id", 7)
	c.Set("role", common.RoleRootUser)
	GetAdminUserSkillUsage(c)

	require.Equal(t, 200, w.Code)
	var got struct {
		Data AdminUserSkillUsageResponse `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &got))
	require.True(t, got.Data.KidsProtected)
	require.Len(t, got.Data.Downloads, 1)
	assert.Zero(t, got.Data.Downloads[0].InputTokens)
	assert.Empty(t, got.Data.UsageTimeline)
	assert.NotContains(t, w.Body.String(), pseudoID)
}

func TestGetAdminUserSkillUsage_RequiresRootRole(t *testing.T) {
	db := testAdminUserUsageDB(t)
	SetDB(db)
	c, w := testContext("/api/v1/admin/users/42/skill-usage")
	c.Params = append(c.Params, ginParam("user_id", "42"))
	c.Set("id", 7)
	c.Set("role", common.RoleAdminUser)

	GetAdminUserSkillUsage(c)

	require.Equal(t, 403, w.Code)
}

func testAdminUserUsageDB(t *testing.T) *gorm.DB {
	t.Helper()
	ratio_setting.InitRatioSettings()
	db := testSkillDB(t)
	require.NoError(t, db.AutoMigrate(&platformmodel.User{}))
	return db
}

func ginParam(key, value string) gin.Param {
	return gin.Param{Key: key, Value: value}
}
