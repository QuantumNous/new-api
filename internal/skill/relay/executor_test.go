package skillrelay

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ── helpers ───────────────────────────────────────────────────────────────────

func newExecutorTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&skillmodel.Skill{}, &skillmodel.SkillVersion{}))
	return database
}

func makeWhitelistJSON(models []string) skillmodel.SkillJSONB {
	if len(models) == 0 {
		return skillmodel.SkillJSONB("[]")
	}
	b, _ := json.Marshal(models)
	return skillmodel.SkillJSONB(b)
}

func insertSkillAndVersion(t *testing.T, db *gorm.DB, template string, whitelist []string) (*skillmodel.Skill, *skillmodel.SkillVersion) {
	t.Helper()
	skill := &skillmodel.Skill{
		Slug:             "ex-skill",
		Status:           enums.SkillStatusPublished,
		Category:         "test",
		RequiredPlan:     enums.RequiredPlanFree,
		MonetizationType: enums.MonetizationTypeFree,
		Name:             "Exec Skill",
		ShortDescription: "s",
		Description:      "d",
		CreatedBy:        1,
	}
	require.NoError(t, db.Create(skill).Error)

	version := &skillmodel.SkillVersion{
		SkillID:                   skill.ID,
		VersionNumber:             1,
		Status:                    enums.SkillVersionStatusActive,
		InstructionTemplate:       template,
		InstructionTemplateSHA256: "aabbccdd00112233",
		ModelWhitelistSnapshot:    makeWhitelistJSON(whitelist),
		RequiredPlanSnapshot:      enums.RequiredPlanFree,
		MonetizationSnapshot:      skillmodel.SkillJSONB("{}"),
		CreatedBy:                 1,
	}
	require.NoError(t, db.Create(version).Error)
	require.NoError(t, db.Model(skill).Update("active_version_id", version.ID).Error)
	skill.ActiveVersionID = &version.ID
	return skill, version
}

func baseCtx(skill *skillmodel.Skill) *SkillRelayContext {
	return &SkillRelayContext{
		RequestID: "req-exec-test",
		SkillID:   skill.ID,
		UserID:    7,
		Plan:      enums.RequiredPlanFree,
		SubActive: true,
		Skill:     skill,
	}
}

func userOnlyRequest(userText string) *dto.GeneralOpenAIRequest {
	msg := dto.Message{Role: "user"}
	msg.SetStringContent(userText)
	return &dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{msg},
	}
}

// ── loadSnapshot tests ────────────────────────────────────────────────────────

func TestLoadSnapshot_HappyPath(t *testing.T) {
	db := newExecutorTestDB(t)
	skill, version := insertSkillAndVersion(t, db, "You are a helpful assistant.", []string{"deeprouter-auto"})

	snap, errCode := loadSnapshot(db, skill)

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	require.NotNil(t, snap)
	assert.Equal(t, version.ID, snap.SkillVersionID)
	assert.Equal(t, "You are a helpful assistant.", snap.InstructionTemplate)
	assert.Equal(t, []string{"deeprouter-auto"}, snap.ModelWhitelist)
}

func TestLoadSnapshot_NilSkill_ReturnsInternalError(t *testing.T) {
	db := newExecutorTestDB(t)
	_, errCode := loadSnapshot(db, nil)
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

func TestLoadSnapshot_NilActiveVersionID_ReturnsInternalError(t *testing.T) {
	db := newExecutorTestDB(t)
	skill := &skillmodel.Skill{ID: "some-id", ActiveVersionID: nil}
	_, errCode := loadSnapshot(db, skill)
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

func TestLoadSnapshot_VersionNotFound_ReturnsInternalError(t *testing.T) {
	db := newExecutorTestDB(t)
	versionID := "00000000-0000-0000-0000-000000000099"
	skill := &skillmodel.Skill{ID: "skill-x", ActiveVersionID: &versionID}
	_, errCode := loadSnapshot(db, skill)
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

// ── selectModel tests ─────────────────────────────────────────────────────────

func TestSelectModel_ReturnsFirstNonEmpty(t *testing.T) {
	m, errCode := selectModel([]string{"deeprouter-auto", "gpt-4o"})
	require.Equal(t, errcodes.ErrorCode(""), errCode)
	assert.Equal(t, "deeprouter-auto", m)
}

func TestSelectModel_EmptyWhitelist_ReturnsInternalError(t *testing.T) {
	_, errCode := selectModel([]string{})
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

func TestSelectModel_NilWhitelist_ReturnsInternalError(t *testing.T) {
	_, errCode := selectModel(nil)
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

func TestSelectModel_SkipsEmptyStrings(t *testing.T) {
	m, errCode := selectModel([]string{"", "gpt-4o-mini"})
	require.Equal(t, errcodes.ErrorCode(""), errCode)
	assert.Equal(t, "gpt-4o-mini", m)
}

// ── rewriteForSingleTurn tests ────────────────────────────────────────────────

func TestRewriteForSingleTurn_InjectsTemplateAndModel(t *testing.T) {
	req := userOnlyRequest("what is Go?")
	got, errCode := rewriteForSingleTurn(req, "You are a Go expert.", "deeprouter-auto")

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	require.NotNil(t, got)
	assert.Equal(t, "deeprouter-auto", got.Model)
	require.Len(t, got.Messages, 2)
	assert.Equal(t, "system", got.Messages[0].Role)
	assert.Equal(t, "You are a Go expert.", got.Messages[0].StringContent())
	assert.Equal(t, "user", got.Messages[1].Role)
	assert.Equal(t, "what is Go?", got.Messages[1].StringContent())
}

func TestRewriteForSingleTurn_StripsHistory_KeepsLastUserMessage(t *testing.T) {
	sys := dto.Message{Role: "system"}
	sys.SetStringContent("original system")
	u1 := dto.Message{Role: "user"}
	u1.SetStringContent("first message")
	a1 := dto.Message{Role: "assistant"}
	a1.SetStringContent("first answer")
	u2 := dto.Message{Role: "user"}
	u2.SetStringContent("second message")

	req := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{sys, u1, a1, u2},
	}

	got, errCode := rewriteForSingleTurn(req, "skill template", "gpt-4o-mini")

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	require.Len(t, got.Messages, 2, "must strip history to exactly [system, user]")
	assert.Equal(t, "skill template", got.Messages[0].StringContent(), "system must be instruction_template")
	assert.Equal(t, "second message", got.Messages[1].StringContent(), "user must be the LAST user message")
	assert.Equal(t, "gpt-4o-mini", got.Model, "model must be server-selected, not client-supplied")
}

func TestRewriteForSingleTurn_NoUserMessage_ReturnsInvalidRequest(t *testing.T) {
	sys := dto.Message{Role: "system"}
	sys.SetStringContent("some system")
	req := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{sys},
	}

	_, errCode := rewriteForSingleTurn(req, "template", "deeprouter-auto")
	assert.Equal(t, errcodes.ErrInvalidRequest, errCode)
}

func TestRewriteForSingleTurn_EmptyMessages_ReturnsInvalidRequest(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	_, errCode := rewriteForSingleTurn(req, "template", "deeprouter-auto")
	assert.Equal(t, errcodes.ErrInvalidRequest, errCode)
}

func TestRewriteForSingleTurn_DoesNotMutateOriginalRequest(t *testing.T) {
	req := userOnlyRequest("original")
	origModel := req.Model
	origMsgs := len(req.Messages)

	_, _ = rewriteForSingleTurn(req, "template", "new-model")

	assert.Equal(t, origModel, req.Model, "original request must not be mutated")
	assert.Equal(t, origMsgs, len(req.Messages), "original messages must not be mutated")
}

// ── loadAndApply integration tests ───────────────────────────────────────────

func TestLoadAndApply_HappyPath(t *testing.T) {
	testDB := newExecutorTestDB(t)
	skill, version := insertSkillAndVersion(t, testDB, "Be concise.", []string{"deeprouter-auto"})
	ctx := baseCtx(skill)
	req := userOnlyRequest("summarize Go")

	got, errCode := loadAndApply(testDB, ctx, req)

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	require.NotNil(t, got)
	assert.Equal(t, version.ID, ctx.SkillVersionID, "SkillVersionID must be populated on ctx")
	assert.Equal(t, "deeprouter-auto", got.Model)
	require.Len(t, got.Messages, 2)
	assert.Equal(t, "Be concise.", got.Messages[0].StringContent())
	assert.Equal(t, "summarize Go", got.Messages[1].StringContent())
}

func TestLoadAndApply_NilDB_ReturnsInternalError(t *testing.T) {
	skill := &skillmodel.Skill{ID: "x"}
	vID := "vid"
	skill.ActiveVersionID = &vID
	ctx := baseCtx(skill)
	_, errCode := loadAndApply(nil, ctx, userOnlyRequest("hi"))
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

func TestLoadAndApply_EmptyWhitelist_ReturnsInternalError(t *testing.T) {
	testDB := newExecutorTestDB(t)
	skill, _ := insertSkillAndVersion(t, testDB, "template", []string{})
	ctx := baseCtx(skill)
	_, errCode := loadAndApply(testDB, ctx, userOnlyRequest("hi"))
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

func TestLoadAndApply_NoUserMessage_ReturnsInvalidRequest(t *testing.T) {
	testDB := newExecutorTestDB(t)
	skill, _ := insertSkillAndVersion(t, testDB, "template", []string{"deeprouter-auto"})
	ctx := baseCtx(skill)

	sys := dto.Message{Role: "system"}
	sys.SetStringContent("system only")
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{sys}}

	_, errCode := loadAndApply(testDB, ctx, req)
	assert.Equal(t, errcodes.ErrInvalidRequest, errCode)
}

func TestLoadAndApply_VersionNotInDB_ReturnsInternalError(t *testing.T) {
	testDB := newExecutorTestDB(t)
	// Skill points to a version that was never inserted
	vID := "00000000-0000-0000-0000-deadbeef0001"
	skill := &skillmodel.Skill{ID: "orphan-skill", ActiveVersionID: &vID}
	ctx := baseCtx(skill)
	_, errCode := loadAndApply(testDB, ctx, userOnlyRequest("hi"))
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}
