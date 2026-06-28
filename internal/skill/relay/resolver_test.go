package skillrelay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ---- test helpers ----

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(
		&skillmodel.Skill{},
		&skillmodel.SkillVersion{},
		&skillmodel.UserEnabledSkill{},
		&skillmodel.SkillPurchaseOrder{},
		&skillmodel.SkillEntitlement{},
		&platformmodel.User{},
		&platformmodel.SubscriptionPlan{},
		&platformmodel.UserSubscription{},
		&platformmodel.SubscriptionPreConsumeRecord{},
	))
	return database
}

// enableSkillRow seeds an enabled user_enabled_skills row for (userID, tenant=userID, skillID).
// DR-66 enforces enablement for published skills, so success-path fixtures must seed this.
func enableSkillRow(t *testing.T, database *gorm.DB, userID int, skillID string) {
	t.Helper()
	require.NoError(t, database.Create(&skillmodel.UserEnabledSkill{
		UserID:   int64(userID),
		TenantID: int64(userID),
		SkillID:  skillID,
		Enabled:  true,
	}).Error)
}

// disableSkillRow seeds a DISABLED user_enabled_skills row (enabled=false).
//
// ⚠ Do NOT write `Create(&UserEnabledSkill{Enabled: false})`: GORM honours the
// `default:true` tag on a zero-value bool, silently inserting enabled=TRUE and
// producing a false positive. Always insert enabled then UPDATE it off (the real
// disable path). Use this helper instead of hand-rolling that pattern.
func disableSkillRow(t *testing.T, database *gorm.DB, userID int, skillID string) {
	t.Helper()
	enableSkillRow(t, database, userID, skillID)
	require.NoError(t, database.Model(&skillmodel.UserEnabledSkill{}).
		Where("user_id = ? AND tenant_id = ? AND skill_id = ?", userID, userID, skillID).
		Update("enabled", false).Error)
}

func newTestContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

// setContextUser sets both the user_id int and the *model.User pointer that
// middleware/policy.go would normally set, so the resolver uses the fast path.
func setContextUser(c *gin.Context, user *platformmodel.User) {
	common.SetContextKey(c, constant.ContextKeyUserId, user.Id)
	common.SetContextKey(c, constant.ContextKeyAirbotixUser, user)
}

func insertSkill(t *testing.T, database *gorm.DB, s *skillmodel.Skill) *skillmodel.Skill {
	t.Helper()
	require.NoError(t, database.Create(s).Error)
	return s
}

func insertSkillVersion(t *testing.T, database *gorm.DB, v *skillmodel.SkillVersion) *skillmodel.SkillVersion {
	t.Helper()
	require.NoError(t, database.Create(v).Error)
	return v
}

func insertRunnableSkill(t *testing.T, database *gorm.DB, s *skillmodel.Skill) (*skillmodel.Skill, *skillmodel.SkillVersion) {
	t.Helper()
	skill := insertSkill(t, database, s)
	require.NotNil(t, skill.ActiveVersionID)
	version := insertSkillVersion(t, database, defaultSkillVersion(skill.ID, *skill.ActiveVersionID))
	return skill, version
}

func defaultSkill() *skillmodel.Skill {
	versionID := "aaaaaaaa-bbbb-cccc-dddd-000000000001"
	return &skillmodel.Skill{
		Slug:             "test-skill",
		Status:           enums.SkillStatusPublished,
		Category:         "test",
		RequiredPlan:     enums.RequiredPlanFree,
		MonetizationType: enums.MonetizationTypeFree,
		Name:             "Test Skill",
		ShortDescription: "A test skill",
		Description:      "A test skill for unit tests",
		CreatedBy:        1,
		ActiveVersionID:  &versionID,
	}
}

func defaultSkillVersion(skillID string, versionID string) *skillmodel.SkillVersion {
	maxTokens := 4096
	return &skillmodel.SkillVersion{
		ID:                        versionID,
		SkillID:                   skillID,
		VersionNumber:             1,
		Status:                    enums.SkillVersionStatusActive,
		InstructionTemplate:       "You are the immutable skill executor.",
		InstructionTemplateSHA256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		ModelWhitelistSnapshot:    skillmodel.SkillJSONB(`["gpt-4o-mini","gpt-4o"]`),
		RequiredPlanSnapshot:      enums.RequiredPlanFree,
		MonetizationSnapshot:      skillmodel.SkillJSONB(`{"mode":"plan_included"}`),
		MaxInputTokensSnapshot:    &maxTokens,
		CreatedBy:                 1,
	}
}

func addActiveSubscription(t *testing.T, database *gorm.DB, userID int, upgradeGroup string) {
	t.Helper()
	plan := &platformmodel.SubscriptionPlan{
		Title:         "Test " + upgradeGroup,
		DurationUnit:  platformmodel.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		UpgradeGroup:  upgradeGroup,
	}
	require.NoError(t, database.Create(plan).Error)
	now := common.GetTimestamp()
	require.NoError(t, database.Create(&platformmodel.UserSubscription{
		UserId:       userID,
		PlanId:       plan.Id,
		StartTime:    now - 60,
		EndTime:      now + 3600,
		Status:       "active",
		Source:       "admin",
		UpgradeGroup: upgradeGroup,
	}).Error)
}

func addExpiredSubscription(t *testing.T, database *gorm.DB, userID int, upgradeGroup string) {
	t.Helper()
	plan := &platformmodel.SubscriptionPlan{
		Title:         "Expired " + upgradeGroup,
		DurationUnit:  platformmodel.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		UpgradeGroup:  upgradeGroup,
	}
	require.NoError(t, database.Create(plan).Error)
	now := common.GetTimestamp()
	require.NoError(t, database.Create(&platformmodel.UserSubscription{
		UserId:       userID,
		PlanId:       plan.Id,
		StartTime:    now - 7200,
		EndTime:      now - 3600,
		Status:       "expired",
		Source:       "admin",
		UpgradeGroup: upgradeGroup,
	}).Error)
}

func enabledUser(id int) *platformmodel.User {
	return &platformmodel.User{
		Id:       id,
		Username: "testuser",
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
}

func ptrString(value string) *string {
	return &value
}

// ---- groupToPlan ----

func TestGroupToPlan_Pro(t *testing.T) {
	assert.Equal(t, enums.RequiredPlanPro, groupToPlan("pro"))
}

func TestGroupToPlan_Enterprise(t *testing.T) {
	assert.Equal(t, enums.RequiredPlanEnterprise, groupToPlan("enterprise"))
}

func TestGroupToPlan_Default(t *testing.T) {
	assert.Equal(t, enums.RequiredPlanFree, groupToPlan("default"))
}

func TestGroupToPlan_Empty(t *testing.T) {
	assert.Equal(t, enums.RequiredPlanFree, groupToPlan(""))
}

func TestGroupToPlan_Unknown(t *testing.T) {
	assert.Equal(t, enums.RequiredPlanFree, groupToPlan("vip"))
}

// ---- context Set / Get ----

func TestSetGet_RoundTrip(t *testing.T) {
	c := newTestContext(t)
	original := &SkillRelayContext{RequestID: "req-123", SkillID: "skill-abc", UserID: 42}
	Set(c, original)
	got, ok := Get(c)
	require.True(t, ok)
	assert.Same(t, original, got)
}

func TestGet_Missing(t *testing.T) {
	c := newTestContext(t)
	got, ok := Get(c)
	assert.False(t, ok)
	assert.Nil(t, got)
}

// ---- resolve - error paths ----

func TestResolve_AnonymousUser_ReturnsAuthRequired(t *testing.T) {
	c := newTestContext(t)
	// userID not set -> defaults to 0 -> anonymous
	ctx, code := resolve(c, nil, "any-skill-id")
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrAuthRequired, code)
}

func TestResolve_DBNilWithNoContextUser_ReturnsInternalError(t *testing.T) {
	c := newTestContext(t)
	common.SetContextKey(c, constant.ContextKeyUserId, 5)
	// No ContextKeyAirbotixUser -> falls back to DB, but db=nil
	ctx, code := resolve(c, nil, "any-skill-id")
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillInternalError, code)
}

func TestResolve_DisabledUser_ReturnsAuthRequired(t *testing.T) {
	c := newTestContext(t)
	disabled := enabledUser(10)
	disabled.Status = common.UserStatusDisabled
	setContextUser(c, disabled)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrAuthRequired, code)
}

func TestResolve_SkillNotFound_ReturnsNotFound(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(11)
	setContextUser(c, user)

	database := newTestDB(t)

	ctx, code := resolve(c, database, "00000000-0000-0000-0000-000000000000")
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotFound, code)
}

func TestResolve_DBNilAfterUserResolved_ReturnsInternalError(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(12)
	setContextUser(c, user) // user comes from context, not DB

	// db=nil -> skill lookup cannot proceed
	ctx, code := resolve(c, nil, "some-skill-id")
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillInternalError, code)
}

func TestResolve_DraftSkill_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(13))

	database := newTestDB(t)
	s := defaultSkill()
	s.Status = enums.SkillStatusDraft
	skill := insertSkill(t, database, s)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code,
		"draft skill must be blocked at relay entry with SKILL_NOT_PUBLISHED")
}

func TestResolve_ArchivedSkill_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(14))

	database := newTestDB(t)
	s := defaultSkill()
	s.Status = enums.SkillStatusArchived
	skill := insertSkill(t, database, s)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code,
		"archived skill must be blocked at relay entry with SKILL_NOT_PUBLISHED")
}

func TestResolve_DeprecatedSkill_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(15))

	database := newTestDB(t)
	s := defaultSkill()
	s.Status = enums.SkillStatusDeprecated
	skill := insertSkill(t, database, s)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code,
		"deprecated skill must be blocked at relay entry with SKILL_NOT_PUBLISHED")
}

func TestResolve_NilActiveVersionID_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(16))

	database := newTestDB(t)
	s := defaultSkill()
	s.ActiveVersionID = nil // published but no runnable version
	skill := insertSkill(t, database, s)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code,
		"published skill with nil active_version_id must be blocked - no runnable version")
}

// ---- resolve - success paths ----

func TestResolve_Success_FreePlan(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(20)
	user.Group = "default"
	setContextUser(c, user)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 20, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.Equal(t, enums.RequiredPlanFree, skillCtx.Plan)
}

// TestResolve_FreePlan_UserNotSkill is the cross-source guard for the Plan field.
// A free user downloads a pro skill - Plan must be "free" (from user.Group),
// NOT "pro" (from skill.RequiredPlan). If resolve() ever accidentally used
// skill.RequiredPlan, this test would catch it (DR-81 anti-pattern: coincidentally
// equal values in TestResolve_Success_FreePlan would mask the bug).
func TestResolve_FreePlan_UserNotSkill(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(20)
	user.Group = "default"
	setContextUser(c, user)

	database := newTestDB(t)
	proSkill := defaultSkill()
	proSkill.RequiredPlan = enums.RequiredPlanPro
	skill, _ := insertRunnableSkill(t, database, proSkill)
	enableSkillRow(t, database, 20, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.Equal(t, enums.RequiredPlanFree, skillCtx.Plan,
		"Plan must come from user.Group (free), not skill.RequiredPlan (pro)")
}

func TestResolve_DR67_FreeUser_ProSnapshot_ReturnsPlanRequired_NoCharge(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(27)
	user.Group = "default"
	setContextUser(c, user)

	database := newTestDB(t)
	fixture := defaultSkill()
	fixture.MonetizationType = enums.MonetizationTypeOneTime
	skill := insertSkill(t, database, fixture)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanPro
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 27, skill.ID)

	qc := attachQueryCounter(t, database)
	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillPlanRequired, code)
	assert.Equal(t, 1, qc.get("skill_versions"), "plan block may read version entitlement metadata only")
	assert.Equal(t, 0, qc.get("skill_versions_prompt"), "plan block must not load prompt-bearing snapshot")

	var charges int64
	require.NoError(t, database.Model(&platformmodel.SubscriptionPreConsumeRecord{}).Count(&charges).Error)
	assert.Equal(t, int64(0), charges, "entitlement block must create no subscription charge/pre-consume record")
}

func TestResolve_DR100_OneTimeEntitlement_ProSnapshot_SucceedsWithoutSubscription(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(127)
	user.Group = "default"
	setContextUser(c, user)

	database := newTestDB(t)
	fixture := defaultSkill()
	fixture.MonetizationType = enums.MonetizationTypeOneTime
	skill := insertSkill(t, database, fixture)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanPro
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 127, skill.ID)
	require.NoError(t, skillmodel.GrantOneTimeEntitlement(database, 127, 127, skill.ID, "order-127"))

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.Equal(t, enums.RequiredPlanFree, skillCtx.Plan)
	assert.True(t, skillCtx.SubActive)
}

func TestResolve_DR99_ActivePlusUnlocksOneTimeSkillWithoutPurchase(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(227)
	user.Group = "pro"
	setContextUser(c, user)

	database := newTestDB(t)
	fixture := defaultSkill()
	fixture.MonetizationType = enums.MonetizationTypeOneTime
	skill := insertSkill(t, database, fixture)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanFree
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 227, skill.ID)
	addActiveSubscription(t, database, 227, "pro")

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.Equal(t, enums.RequiredPlanPro, skillCtx.Plan)
	assert.True(t, skillCtx.SubActive)
}

func TestResolve_DR99_ExpiredPlusRevokesPlusExclusiveSkill(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(228)
	user.Group = "pro"
	setContextUser(c, user)

	database := newTestDB(t)
	fixture := defaultSkill()
	fixture.RequiredPlan = enums.RequiredPlanPro
	fixture.MonetizationType = enums.MonetizationTypePlusExclusive
	skill := insertSkill(t, database, fixture)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanPro
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 228, skill.ID)
	addExpiredSubscription(t, database, 228, "pro")

	skillCtx, code := resolve(c, database, skill.ID)
	assert.Nil(t, skillCtx)
	assert.Equal(t, errcodes.ErrSkillSubscriptionInactive, code)
}

func TestResolve_DR67_ProUser_ActiveSubscription_ProSnapshot_Succeeds(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(28)
	user.Group = "pro"
	setContextUser(c, user)

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanPro
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 28, skill.ID)
	addActiveSubscription(t, database, 28, "pro")

	ctx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, ctx)
	assert.Equal(t, enums.RequiredPlanPro, ctx.Plan)
	assert.True(t, ctx.SubActive)
}

func TestResolve_DR67_ProUser_ExpiredSubscription_ProSnapshot_ReturnsSubscriptionInactive(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(29)
	user.Group = "pro"
	setContextUser(c, user)

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanPro
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 29, skill.ID)
	addExpiredSubscription(t, database, 29, "pro")

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillSubscriptionInactive, code)
}

func TestResolve_DR67_EnterpriseUser_ActiveSubscription_SatisfiesProSnapshot(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(32)
	user.Group = "enterprise"
	setContextUser(c, user)

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanPro
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 32, skill.ID)
	addActiveSubscription(t, database, 32, "enterprise")

	ctx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, ctx)
	assert.Equal(t, enums.RequiredPlanEnterprise, ctx.Plan)
	assert.True(t, ctx.SubActive)
}

func TestResolve_DR67_ProUser_EnterpriseSnapshot_ReturnsPlanRequired(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(33)
	user.Group = "pro"
	setContextUser(c, user)

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanEnterprise
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 33, skill.ID)
	addActiveSubscription(t, database, 33, "pro")

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillPlanRequired, code)
}

func TestResolve_DR67_UsesRequiredPlanSnapshotNotMutableSkillPlan(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(34)
	user.Group = "default"
	setContextUser(c, user)

	database := newTestDB(t)
	proSkill := defaultSkill()
	proSkill.RequiredPlan = enums.RequiredPlanPro
	skill := insertSkill(t, database, proSkill)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.RequiredPlanSnapshot = enums.RequiredPlanFree
	insertSkillVersion(t, database, version)
	enableSkillRow(t, database, 34, skill.ID)

	ctx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, ctx)
	assert.Equal(t, enums.RequiredPlanFree, ctx.SkillVersion.RequiredPlanSnapshot)
}

func TestResolve_Success_ProPlan(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(21)
	user.Group = "pro"
	setContextUser(c, user)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 21, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.Equal(t, enums.RequiredPlanPro, skillCtx.Plan)
}

func TestResolve_Success_EnterprisePlan(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(22)
	user.Group = "enterprise"
	setContextUser(c, user)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 22, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.Equal(t, enums.RequiredPlanEnterprise, skillCtx.Plan)
}

func TestResolve_KidsSession_Propagated(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(23)
	user.KidsMode = true
	setContextUser(c, user)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 23, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.True(t, skillCtx.IsKidsSession)
}

func TestResolve_NonKidsSession_Propagated(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(24)
	user.KidsMode = false
	setContextUser(c, user)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 24, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.False(t, skillCtx.IsKidsSession)
}

func TestResolve_FreeSkill_SubActiveTrue(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(25)
	setContextUser(c, user)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 25, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.True(t, skillCtx.SubActive)
}

func TestResolve_RequestIDNotEmpty(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(26)
	setContextUser(c, user)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 26, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	assert.NotEmpty(t, skillCtx.RequestID)
}

func TestResolve_TwoRequestsGetDistinctRequestIDs(t *testing.T) {
	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 30, skill.ID)
	enableSkillRow(t, database, 31, skill.ID)

	makeCtx := func(uid int) *gin.Context {
		c := newTestContext(t)
		setContextUser(c, enabledUser(uid))
		return c
	}

	ctx1, _ := resolve(makeCtx(30), database, skill.ID)
	ctx2, _ := resolve(makeCtx(31), database, skill.ID)
	require.NotNil(t, ctx1)
	require.NotNil(t, ctx2)
	assert.NotEqual(t, ctx1.RequestID, ctx2.RequestID)
}

func TestResolve_ContextFieldsPopulated(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(40)
	user.Group = "pro"
	user.KidsMode = true
	setContextUser(c, user)

	database := newTestDB(t)
	skill, version := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 40, skill.ID)
	addActiveSubscription(t, database, 40, "pro")

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)

	assert.Equal(t, skill.ID, skillCtx.SkillID)
	assert.Equal(t, 40, skillCtx.UserID)
	assert.Equal(t, version.ID, skillCtx.SkillVersionID)
	assert.Equal(t, enums.RequiredPlanPro, skillCtx.Plan)
	assert.True(t, skillCtx.IsKidsSession)
	assert.True(t, skillCtx.SubActive)
	assert.NotNil(t, skillCtx.Skill)
	assert.NotNil(t, skillCtx.SkillVersion)
	assert.Equal(t, skill.ID, skillCtx.Skill.ID)
	assert.Equal(t, version.ID, skillCtx.SkillVersion.ID)
	assert.Equal(t, version.InstructionTemplate, skillCtx.SkillVersion.InstructionTemplate)
	assert.Equal(t, version.RequiredPlanSnapshot, skillCtx.SkillVersion.RequiredPlanSnapshot)
	assert.Equal(t, string(version.ModelWhitelistSnapshot), string(skillCtx.SkillVersion.ModelWhitelistSnapshot))
	assert.Equal(t, string(version.MonetizationSnapshot), string(skillCtx.SkillVersion.MonetizationSnapshot))
	require.NotNil(t, skillCtx.SkillVersion.MaxInputTokensSnapshot)
	assert.Equal(t, *version.MaxInputTokensSnapshot, *skillCtx.SkillVersion.MaxInputTokensSnapshot)
}

// TestResolve_UserFromDB verifies the DB fallback path:
// when ContextKeyAirbotixUser is absent, resolve() queries the user from DB.
func TestResolve_UserFromDB(t *testing.T) {
	database := newTestDB(t)

	// Insert user into DB directly (no middleware).
	dbUser := &platformmodel.User{
		Id:       99,
		Username: "dbfallback",
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Group:    "enterprise",
		KidsMode: true,
	}
	require.NoError(t, database.Create(dbUser).Error)

	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 99, skill.ID)

	c := newTestContext(t)
	// Only set user_id; do NOT set ContextKeyAirbotixUser -> forces DB fallback.
	common.SetContextKey(c, constant.ContextKeyUserId, 99)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)

	assert.Equal(t, 99, skillCtx.UserID)
	assert.Equal(t, enums.RequiredPlanEnterprise, skillCtx.Plan)
	assert.True(t, skillCtx.IsKidsSession)
}

// TestResolve_T21_UserIDFromContextOnly confirms identity comes exclusively
// from the validated auth context and not from any client-provided field.
// The resolver must not read user identity from the request body.
func TestResolve_T21_UserIDFromContextOnly(t *testing.T) {
	// Two different users - only the one set in context should be used.
	c := newTestContext(t)
	trustedUser := enabledUser(50)
	trustedUser.Group = "pro"
	setContextUser(c, trustedUser)

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 50, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)

	// UserID must match the context user, not any implicit client claim.
	assert.Equal(t, 50, skillCtx.UserID)
	assert.Equal(t, enums.RequiredPlanPro, skillCtx.Plan)
}

// ---- exported Resolve wrapper ----

// TestResolve_ExportedWrapper_NilPackageDB verifies that the exported Resolve()
// function delegates to resolve() and correctly propagates errors through the
// package-level db. In tests the package-level db is never set (SetDB not called),
// so a request with a context user but no db -> SKILL_INTERNAL_ERROR.
func TestResolve_ExportedWrapper_NilPackageDB(t *testing.T) {
	// Confirm: package-level db was never set in this test binary.
	// (SetDB is never called in any test; db starts as nil.)
	require.Nil(t, db, "package-level db must be nil for this test to be meaningful")

	c := newTestContext(t)
	user := enabledUser(60)
	setContextUser(c, user) // user resolved from context; skill lookup hits nil db

	ctx, code := Resolve(c, "any-skill-id")
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillInternalError, code)
}

// ---- return invariant ----

// TestResolveReturnInvariant asserts the hard contract of resolve():
// exactly one of the following is always true for every code path:
//
//	(ctx == nil  AND errCode != "") - failure
//	(ctx != nil  AND errCode == "") - success
//
// This mirrors the DR-72 lesson where a non-nil result was returned with a
// misleading zero-value field. A future change that returns (nil, "") would
// cause the caller to call skillrelay.Set(c, nil), and any downstream handler
// doing ctx.UserID would panic.
func TestResolveReturnInvariant(t *testing.T) {
	database := newTestDB(t)
	validSkill, _ := insertRunnableSkill(t, database, defaultSkill())

	type testCase struct {
		name    string
		setupFn func() (*gin.Context, *gorm.DB, string)
	}

	cases := []testCase{
		{
			name: "anonymous user",
			setupFn: func() (*gin.Context, *gorm.DB, string) {
				c := newTestContext(t)
				// no userID -> anonymous
				return c, database, validSkill.ID
			},
		},
		{
			name: "nil db, no context user",
			setupFn: func() (*gin.Context, *gorm.DB, string) {
				c := newTestContext(t)
				common.SetContextKey(c, constant.ContextKeyUserId, 5)
				return c, nil, validSkill.ID
			},
		},
		{
			name: "disabled user",
			setupFn: func() (*gin.Context, *gorm.DB, string) {
				c := newTestContext(t)
				u := enabledUser(70)
				u.Status = common.UserStatusDisabled
				setContextUser(c, u)
				return c, database, validSkill.ID
			},
		},
		{
			name: "skill not found",
			setupFn: func() (*gin.Context, *gorm.DB, string) {
				c := newTestContext(t)
				setContextUser(c, enabledUser(71))
				return c, database, "00000000-0000-0000-0000-000000000000"
			},
		},
		{
			name: "nil db after user resolved",
			setupFn: func() (*gin.Context, *gorm.DB, string) {
				c := newTestContext(t)
				setContextUser(c, enabledUser(72))
				return c, nil, validSkill.ID
			},
		},
		{
			name: "success path",
			setupFn: func() (*gin.Context, *gorm.DB, string) {
				c := newTestContext(t)
				setContextUser(c, enabledUser(73))
				enableSkillRow(t, database, 73, validSkill.ID)
				return c, database, validSkill.ID
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, db, skillID := tc.setupFn()
			ctx, errCode := resolve(c, db, skillID)

			// Invariant A: failure -> ctx nil, errCode non-empty
			// Invariant B: success -> ctx non-nil, errCode empty
			if errCode != "" {
				assert.Nil(t, ctx,
					"when errCode=%q, ctx MUST be nil (storing nil via Set causes downstream panic)", errCode)
			} else {
				assert.NotNil(t, ctx,
					"when errCode is empty (success), ctx MUST be non-nil")
				assert.Equal(t, errcodes.ErrorCode(""), errCode)
			}
			// The two outcomes must be mutually exclusive.
			assert.Equal(t, ctx == nil, errCode != "",
				"(ctx==nil) must equal (errCode!='') - invariant violated")
		})
	}
}

// ---- SetDB wiring ----

// TestSetDB_Wiring confirms that SetDB stores exactly the supplied *gorm.DB in
// the package-level var and that the var is nil before SetDB is called (ensuring
// no earlier test accidentally initialised it).
func TestSetDB_Wiring(t *testing.T) {
	require.Nil(t, db, "package-level db must be nil before SetDB - earlier test must not have called SetDB")

	database := newTestDB(t)
	SetDB(database)
	t.Cleanup(func() { db = nil }) // restore so no state leaks if tests are ever reordered

	assert.NotNil(t, db, "package-level db must be non-nil after SetDB")
	assert.Same(t, database, db, "SetDB must store exactly the supplied *gorm.DB instance")
}
