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

func TestResolve_ActiveVersionRecordMissing_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(102))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())

	ctx, code := resolve(c, database, skill.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}

func TestResolve_DraftActiveVersionRecord_ReturnsNotPublished(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(103))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
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

	ctx, code := resolve(c, database, skillA.ID)
	assert.Nil(t, ctx)
	assert.Equal(t, errcodes.ErrSkillNotPublished, code)
}
func TestResolve_EmptyInstructionTemplate_ReturnsInternalError(t *testing.T) {
	c := newTestContext(t)
	setContextUser(c, enabledUser(106))

	database := newTestDB(t)
	skill := insertSkill(t, database, defaultSkill())
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
