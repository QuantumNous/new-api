package skillrelay

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolve_LoadsImmutableExecutionSnapshot(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(101)
	user.Group = "pro"
	user.KidsMode = true
	setContextUser(c, user)

	database := newTestDB(t)
	skill, version := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 101, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	require.NotNil(t, skillCtx.SkillVersion)

	assert.Equal(t, skill.ID, skillCtx.SkillID)
	assert.Equal(t, version.ID, skillCtx.SkillVersionID)
	assert.Equal(t, version.ID, skillCtx.SkillVersion.ID)
	assert.Equal(t, version.InstructionTemplate, skillCtx.SkillVersion.InstructionTemplate)
	assert.Equal(t, version.RequiredPlanSnapshot, skillCtx.SkillVersion.RequiredPlanSnapshot)
	assert.Equal(t, string(version.ModelWhitelistSnapshot), string(skillCtx.SkillVersion.ModelWhitelistSnapshot))
	assert.Equal(t, string(version.MonetizationSnapshot), string(skillCtx.SkillVersion.MonetizationSnapshot))
	require.NotNil(t, skillCtx.SkillVersion.MaxInputTokensSnapshot)
	assert.Equal(t, *version.MaxInputTokensSnapshot, *skillCtx.SkillVersion.MaxInputTokensSnapshot)
}

func TestResolveVersion_UsesExplicitActiveVersionPin(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(109))

	database := newTestDB(t)
	skill, versionV1 := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 109, skill.ID)
	versionV2ID := "aaaaaaaa-bbbb-cccc-dddd-000000000022"
	versionV2 := defaultSkillVersion(skill.ID, versionV2ID)
	versionV2.VersionNumber = 2
	versionV2.InstructionTemplate = "Pinned package snapshot."
	versionV2.ModelWhitelistSnapshot = skillmodel.SkillJSONB(`["gpt-4.1-mini"]`)
	insertSkillVersion(t, database, versionV2)

	skillCtx, code := resolveVersion(c, database, skill.ID, versionV2.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	require.NotNil(t, skillCtx.SkillVersion)

	assert.Equal(t, versionV2.ID, skillCtx.SkillVersionID)
	assert.Equal(t, versionV2.ID, skillCtx.SkillVersion.ID)
	assert.Equal(t, versionV2.InstructionTemplate, skillCtx.SkillVersion.InstructionTemplate)
	assert.NotEqual(t, versionV1.ID, skillCtx.SkillVersionID)
}

func TestResolveVersion_CrossSkillPinReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(110))

	database := newTestDB(t)
	skillA, _ := insertRunnableSkill(t, database, defaultSkill())
	skillB := defaultSkill()
	skillB.Slug = "other-skill"
	skillB.Name = "Other Skill"
	skillB.ActiveVersionID = ptrString("aaaaaaaa-bbbb-cccc-dddd-0000000000b1")
	skillB, versionB := insertRunnableSkill(t, database, skillB)
	require.NotEqual(t, skillA.ID, skillB.ID)
	enableSkillRow(t, database, 110, skillA.ID)

	ctx, code := resolveVersion(c, database, skillA.ID, versionB.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}

func TestResolveVersion_InactivePinReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(111))

	database := newTestDB(t)
	skill, _ := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 111, skill.ID)
	inactiveID := "aaaaaaaa-bbbb-cccc-dddd-000000000033"
	inactive := defaultSkillVersion(skill.ID, inactiveID)
	inactive.VersionNumber = 2
	inactive.Status = enums.SkillVersionStatusInactive
	insertSkillVersion(t, database, inactive)

	ctx, code := resolveVersion(c, database, skill.ID, inactive.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}

func TestResolve_ActiveVersionRecordMissing_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(102))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 102, skill.ID)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}

func TestResolve_DraftActiveVersionRecord_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(103))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 103, skill.ID)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.Status = enums.SkillVersionStatusDraft
	insertSkillVersion(t, database, version)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}

func TestResolve_InactiveActiveVersionRecord_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(104))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 104, skill.ID)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.Status = enums.SkillVersionStatusInactive
	insertSkillVersion(t, database, version)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}

func TestResolve_ArchivedActiveVersionRecord_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(105))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 105, skill.ID)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.Status = enums.SkillVersionStatusArchived
	insertSkillVersion(t, database, version)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}

func TestResolve_ActiveVersionRecordBelongsToAnotherSkill_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(1035))

	database := newTestDB(t)
	versionBID := "aaaaaaaa-bbbb-cccc-dddd-0000000000bb"

	skillA := defaultSkill()
	skillA.Slug = "test-skill-a"
	skillA.Name = "Test Skill A"
	skillA.ActiveVersionID = &versionBID
	insertSkill(t, database, skillA)

	skillB := defaultSkill()
	skillB.Slug = "test-skill-b"
	skillB.Name = "Test Skill B"
	skillB.ActiveVersionID = &versionBID
	skillB = insertSkill(t, database, skillB)
	insertSkillVersion(t, database, defaultSkillVersion(skillB.ID, versionBID))
	enableSkillRow(t, database, 1035, skillA.ID)

	ctx, code := resolve(c, database, skillA.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}
func TestResolve_EmptyInstructionTemplate_ReturnsInternalError(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(106))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 106, skill.ID)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.InstructionTemplate = ""
	insertSkillVersion(t, database, version)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillInternalError, code)
}

func TestResolve_WhitespaceInstructionTemplate_ReturnsInternalError(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(107))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 107, skill.ID)
	require.NotNil(t, skill.ActiveVersionID)
	version := defaultSkillVersion(skill.ID, *skill.ActiveVersionID)
	version.InstructionTemplate = "  \n\t  "
	insertSkillVersion(t, database, version)

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillInternalError, code)
}

func TestResolve_BindsSnapshotAtEntryEvenIfActiveVersionChangesMidFlight(t *testing.T) {
	c := newTestContext(t)
	user := enabledUser(108)
	user.Group = "pro"
	setContextUser(c, user)

	database := newTestDB(t)
	skill, versionV1 := insertRunnableSkill(t, database, defaultSkill())
	enableSkillRow(t, database, 108, skill.ID)

	skillCtx, code := resolve(c, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), code)
	require.NotNil(t, skillCtx)
	require.NotNil(t, skillCtx.SkillVersion)

	versionV2ID := "aaaaaaaa-bbbb-cccc-dddd-000000000002"
	maxTokensV2 := 8192
	versionV2 := &skillmodel.SkillVersion{
		ID:                        versionV2ID,
		SkillID:                   skill.ID,
		VersionNumber:             2,
		Status:                    enums.SkillVersionStatusActive,
		InstructionTemplate:       "You are the second immutable snapshot.",
		InstructionTemplateSHA256: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
		ModelWhitelistSnapshot:    skillmodel.SkillJSONB(`["gpt-4.1"]`),
		RequiredPlanSnapshot:      enums.RequiredPlanEnterprise,
		MonetizationSnapshot:      skillmodel.SkillJSONB(`{"mode":"token_markup"}`),
		MaxInputTokensSnapshot:    &maxTokensV2,
		CreatedBy:                 1,
	}
	require.NoError(t, database.Create(versionV2).Error)
	require.NoError(t, database.Model(&skillmodel.Skill{}).
		Where("id = ?", skill.ID).
		Update("active_version_id", versionV2ID).Error)

	assert.Equal(t, versionV1.ID, skillCtx.SkillVersionID)
	assert.Equal(t, versionV1.ID, skillCtx.SkillVersion.ID)
	assert.Equal(t, versionV1.InstructionTemplate, skillCtx.SkillVersion.InstructionTemplate)
	assert.Equal(t, versionV1.RequiredPlanSnapshot, skillCtx.SkillVersion.RequiredPlanSnapshot)
	assert.Equal(t, string(versionV1.ModelWhitelistSnapshot), string(skillCtx.SkillVersion.ModelWhitelistSnapshot))
	assert.Equal(t, string(versionV1.MonetizationSnapshot), string(skillCtx.SkillVersion.MonetizationSnapshot))
	require.NotNil(t, skillCtx.SkillVersion.MaxInputTokensSnapshot)
	assert.Equal(t, *versionV1.MaxInputTokensSnapshot, *skillCtx.SkillVersion.MaxInputTokensSnapshot)

	freshRequestCtx := newTestContext(t)
	setContextUser(freshRequestCtx, user)
	freshCtx, freshCode := resolve(freshRequestCtx, database, skill.ID)
	require.Equal(t, errcodes.ErrorCode(""), freshCode)
	require.NotNil(t, freshCtx)
	require.NotNil(t, freshCtx.SkillVersion)
	assert.Equal(t, versionV2ID, freshCtx.SkillVersionID)
	assert.Equal(t, versionV2ID, freshCtx.SkillVersion.ID)
	assert.Equal(t, versionV2.InstructionTemplate, freshCtx.SkillVersion.InstructionTemplate)
}
