package skillrelay

// Unit tests for executor.go.
//
// DR-65 regression coverage:
// - loadSnapshot consumes the request-entry-bound SkillVersion snapshot.
// - missing bound SkillVersion fails closed.
// - loadSnapshot does not re-read mutable Skill.ActiveVersionID.

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
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

// ---- helpers ----

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
	b, _ := common.Marshal(models)
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

func baseCtx(skill *skillmodel.Skill, version ...*skillmodel.SkillVersion) *SkillRelayContext {
	ctx := &SkillRelayContext{
		RequestID: "req-exec-test",
		SkillID:   skill.ID,
		UserID:    7,
		Plan:      enums.RequiredPlanFree,
		SubActive: true,
		Skill:     skill,
	}
	if len(version) > 0 {
		ctx.SkillVersion = version[0]
	}
	return ctx
}

func userOnlyRequest(userText string) *dto.GeneralOpenAIRequest {
	msg := dto.Message{Role: "user"}
	msg.SetStringContent(userText)
	return &dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{msg},
	}
}

// ---- loadSnapshot tests ----

func TestLoadSnapshot_HappyPath(t *testing.T) {
	db := newExecutorTestDB(t)
	skill, version := insertSkillAndVersion(t, db, "You are a helpful assistant.", []string{"deeprouter-auto"})

	snap, errCode := loadSnapshot(db, baseCtx(skill, version))

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

func TestLoadSnapshot_UsesBoundSnapshotWithoutReadingSkillActiveVersionID(t *testing.T) {
	db := newExecutorTestDB(t)
	_, version := insertSkillAndVersion(t, db, "You are bound.", []string{"deeprouter-auto"})

	ctx := &SkillRelayContext{
		Skill: &skillmodel.Skill{
			ID:              version.SkillID,
			ActiveVersionID: nil,
		},
		SkillVersion: version,
	}

	snap, errCode := loadSnapshot(db, ctx)

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	require.NotNil(t, snap)
	assert.Equal(t, version.ID, snap.SkillVersionID)
}

func TestLoadSnapshot_MissingBoundSnapshot_ReturnsInternalError(t *testing.T) {
	db := newExecutorTestDB(t)
	versionID := "00000000-0000-0000-0000-000000000099"
	skill := &skillmodel.Skill{ID: "skill-x", ActiveVersionID: &versionID}
	_, errCode := loadSnapshot(db, baseCtx(skill))
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

// ---- selectModel tests ----

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

// ---- rewriteForSingleTurn tests ----

func TestRewriteForSingleTurn_InjectsTemplateAndModel(t *testing.T) {
	req := userOnlyRequest("what is Go-")
	got, errCode := rewriteForSingleTurn(req, "You are a Go expert.", "deeprouter-auto")

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	require.NotNil(t, got)
	assert.Equal(t, "deeprouter-auto", got.Model)
	require.Len(t, got.Messages, 2)
	assert.Equal(t, "system", got.Messages[0].Role)
	assert.Equal(t, "You are a Go expert.", got.Messages[0].StringContent())
	assert.Equal(t, "user", got.Messages[1].Role)
	assert.Equal(t, "what is Go-", got.Messages[1].StringContent())
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

func TestRewriteForSingleTurn_StripsClientControlledProviderFields(t *testing.T) {
	stream := true
	includeUsage := &dto.StreamOptions{IncludeUsage: true}
	temperature := 0.9
	maxTokens := uint(99)
	req := userOnlyRequest("hello")
	req.Stream = &stream
	req.StreamOptions = includeUsage
	req.Temperature = &temperature
	req.MaxTokens = &maxTokens
	req.ToolChoice = "required"
	req.ResponseFormat = &dto.ResponseFormat{Type: "json_object"}
	req.User = []byte(`{"user_id":999,"tenant_id":"evil"}`)
	req.Metadata = []byte(`{"route_hint":"expensive"}`)

	got, errCode := rewriteForSingleTurn(req, "server template", "server-model")

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	assert.Equal(t, "server-model", got.Model)
	assert.Same(t, req.Stream, got.Stream, "stream flag is an execution transport option and should survive")
	// StreamOptions must be deep-copied: same value, different pointer (no shared aliasing).
	require.NotNil(t, got.StreamOptions, "stream usage option must survive rewrite")
	assert.Equal(t, *req.StreamOptions, *got.StreamOptions, "stream usage option value must be preserved")
	assert.NotSame(t, req.StreamOptions, got.StreamOptions, "StreamOptions must be deep-copied, not shared by pointer")
	assert.Nil(t, got.Temperature, "client generation params must not be forwarded for skill relay")
	assert.Nil(t, got.MaxTokens, "client token cap must not override server execution snapshot")
	assert.Nil(t, got.ToolChoice, "client tool routing hints must not be forwarded")
	assert.Nil(t, got.ResponseFormat, "client response format hints must not be forwarded")
	assert.Empty(t, got.User, "package-supplied user identity must not reach provider payload")
	assert.Empty(t, got.Metadata, "package-supplied metadata/routing hints must not reach provider payload")
}

// ---- loadAndApply integration tests ----

func TestLoadAndApply_HappyPath(t *testing.T) {
	testDB := newExecutorTestDB(t)
	skill, version := insertSkillAndVersion(t, testDB, "Be concise.", []string{"deeprouter-auto"})
	ctx := baseCtx(skill, version)
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
	skill, version := insertSkillAndVersion(t, testDB, "template", []string{})
	ctx := baseCtx(skill, version)
	_, errCode := loadAndApply(testDB, ctx, userOnlyRequest("hi"))
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

func TestLoadAndApply_NoUserMessage_ReturnsInvalidRequest(t *testing.T) {
	testDB := newExecutorTestDB(t)
	skill, version := insertSkillAndVersion(t, testDB, "template", []string{"deeprouter-auto"})
	ctx := baseCtx(skill, version)

	sys := dto.Message{Role: "system"}
	sys.SetStringContent("system only")
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{sys}}

	_, errCode := loadAndApply(testDB, ctx, req)
	assert.Equal(t, errcodes.ErrInvalidRequest, errCode)
}

func TestLoadAndApply_MissingBoundSnapshot_ReturnsInternalError(t *testing.T) {
	testDB := newExecutorTestDB(t)
	// LoadAndApply must fail closed when Resolve did not bind a SkillVersion snapshot.
	vID := "00000000-0000-0000-0000-deadbeef0001"
	skill := &skillmodel.Skill{ID: "orphan-skill", ActiveVersionID: &vID}
	ctx := baseCtx(skill)
	_, errCode := loadAndApply(testDB, ctx, userOnlyRequest("hi"))
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode)
}

// ---- parseModelWhitelist tests ----

func TestParseModelWhitelist_ValidArray(t *testing.T) {
	raw := skillmodel.SkillJSONB(`["deeprouter-auto","gpt-4o-mini"]`)
	models, err := parseModelWhitelist(raw)
	require.NoError(t, err)
	assert.Equal(t, []string{"deeprouter-auto", "gpt-4o-mini"}, models)
}

func TestParseModelWhitelist_EmptyArray(t *testing.T) {
	raw := skillmodel.SkillJSONB(`[]`)
	models, err := parseModelWhitelist(raw)
	require.NoError(t, err)
	assert.Empty(t, models, "empty JSON array must result in zero-length slice")
}

func TestParseModelWhitelist_MalformedJSON_ReturnsError(t *testing.T) {
	raw := skillmodel.SkillJSONB(`not-valid-json`)
	_, err := parseModelWhitelist(raw)
	assert.Error(t, err, "malformed JSON must return an error")
}

func TestParseModelWhitelist_ZeroLength_ReturnsNil(t *testing.T) {
	// Defensive guard: len(raw)==0 is unreachable after a DB round-trip
	// (normalizeSkillJSONB guarantees minimum "[]") but protects direct callers
	// in tests that bypass BeforeCreate.
	models, err := parseModelWhitelist(skillmodel.SkillJSONB(""))
	require.NoError(t, err, "zero-length raw must not error")
	assert.Nil(t, models, "zero-length raw must return nil, not an error")
}

// ---- rewriteForSingleTurn tests ----

func TestRewriteForSingleTurn_EmptyTemplate_IsAllowed(t *testing.T) {
	// An empty instruction_template is valid and produces an empty system message.
	// Whitelist / template validation is the publisher's job; executor accepts any string.
	got, errCode := rewriteForSingleTurn(userOnlyRequest("hello"), "", "deeprouter-auto")

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	require.Len(t, got.Messages, 2)
	assert.Equal(t, "system", got.Messages[0].Role)
	assert.Equal(t, "", got.Messages[0].StringContent(), "empty template produces an empty system message")
	assert.Equal(t, "hello", got.Messages[1].StringContent())
}

func TestRewriteForSingleTurn_AssistantOnlyMessages_ReturnsInvalidRequest(t *testing.T) {
	a := dto.Message{Role: "assistant"}
	a.SetStringContent("I can help you.")
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{a}}

	_, errCode := rewriteForSingleTurn(req, "template", "deeprouter-auto")
	assert.Equal(t, errcodes.ErrInvalidRequest, errCode,
		"messages with no user role must return INVALID_REQUEST")
}

func TestRewriteForSingleTurn_ContentPartTextExtracted(t *testing.T) {
	// Mixed text+image ContentPart: V1 extracts text content; image is silently
	// dropped (documented text-only limitation; see comment in rewriteForSingleTurn).
	msg := dto.Message{Role: "user"}
	msg.Content = []any{
		map[string]any{"type": "text", "text": "describe this image"},
		map[string]any{"type": "image_url", "image_url": map[string]any{"url": "data:image/png;base64,abc"}},
	}
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{msg}}

	got, errCode := rewriteForSingleTurn(req, "You are a vision assistant.", "deeprouter-auto")

	require.Equal(t, errcodes.ErrorCode(""), errCode)
	require.Len(t, got.Messages, 2)
	assert.Equal(t, "describe this image", got.Messages[1].StringContent(),
		"text part must be extracted; image_url is dropped in V1")
}

func TestRewriteForSingleTurn_ContentPartOnlyImage_ReturnsInvalidRequest(t *testing.T) {
	// Pure-image ContentPart: StringContent() returns "" (no text type found).
	// V1 skills are text-only; this is treated identically to a missing user message.
	msg := dto.Message{Role: "user"}
	msg.Content = []any{
		map[string]any{"type": "image_url", "image_url": map[string]any{"url": "data:image/png;base64,abc"}},
	}
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{msg}}

	_, errCode := rewriteForSingleTurn(req, "template", "deeprouter-auto")
	assert.Equal(t, errcodes.ErrInvalidRequest, errCode,
		"V1 skills must reject pure-image messages (StringContent() returns \"\" for ContentPart-only arrays)")
}

// ---- loadSnapshot edge-case tests ----

func TestLoadSnapshot_MalformedWhitelist_ReturnsInternalError(t *testing.T) {
	db := newExecutorTestDB(t)
	vID := "00000000-0000-0000-0000-000000000042"
	skill := &skillmodel.Skill{
		ID:               "malformed-wl-skill",
		ActiveVersionID:  &vID,
		Status:           enums.SkillStatusPublished,
		Category:         "test",
		RequiredPlan:     enums.RequiredPlanFree,
		MonetizationType: enums.MonetizationTypeFree,
		Name:             "Malformed WL",
		ShortDescription: "s",
		Description:      "d",
		CreatedBy:        1,
	}
	require.NoError(t, db.Create(skill).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO skill_versions
		    (id, skill_id, version_number, status, instruction_template,
		     instruction_template_sha256, download_instructions, usage_instructions,
		     prerequisites, quickstart, example_io, model_whitelist_snapshot,
		     required_plan_snapshot, monetization_snapshot, created_by, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		vID, skill.ID, 1, string(enums.SkillVersionStatusActive),
		"template", "aabbccdd",
		"Download this Skill.", "Use this Skill through DeepRouter.", "[]", "[]", "[]",
		`not-valid-json`,
		string(enums.RequiredPlanFree), "{}", 1,
	).Error)

	version := &skillmodel.SkillVersion{
		ID:                     vID,
		SkillID:                skill.ID,
		InstructionTemplate:    "template",
		ModelWhitelistSnapshot: skillmodel.SkillJSONB(`not-valid-json`),
	}
	_, errCode := loadSnapshot(db, baseCtx(skill, version))
	assert.Equal(t, errcodes.ErrSkillInternalError, errCode,
		"malformed JSON in model_whitelist_snapshot must return SKILL_INTERNAL_ERROR")
}
