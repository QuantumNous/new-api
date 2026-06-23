package middleware

// Skill-relay distributor tests (DR-68).
// Functions under test live in middleware/skill_distributor.go.
//
// Coverage (2026-06-21, post-DR-68 fourth-pass):
//   prepareSkillRelayForDistribution:  89.5%
//   replaceReusableRequestBody:        76.5%
//
// Coverage note: the TOCTOU guard in TextHelper's Resolve block
// is tested in relay/compatible_handler_skill_test.go
// (TestTextHelper_SkillRelay_TOCTOU_PinnedVersionIDPreserved).

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	skillrelay "github.com/QuantumNous/new-api/internal/skill/relay"
	"github.com/QuantumNous/new-api/internal/smart_router_client"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newSkillDistributionDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := database.AutoMigrate(&skillmodel.Skill{}, &skillmodel.SkillVersion{}, &skillmodel.UserEnabledSkill{}); err != nil {
		t.Fatalf("migrate skill tables: %v", err)
	}
	return database
}

func insertDistributionSkill(t *testing.T, db *gorm.DB, template string, whitelist []string) (*skillmodel.Skill, *skillmodel.SkillVersion) {
	t.Helper()
	skill := &skillmodel.Skill{
		Slug:             "distribution-skill",
		Status:           enums.SkillStatusPublished,
		Category:         "test",
		RequiredPlan:     enums.RequiredPlanFree,
		MonetizationType: enums.MonetizationTypeFree,
		Name:             "Distribution Skill",
		ShortDescription: "s",
		Description:      "d",
		CreatedBy:        1,
	}
	if err := db.Create(skill).Error; err != nil {
		t.Fatalf("create skill: %v", err)
	}
	wl, err := common.Marshal(whitelist)
	if err != nil {
		t.Fatalf("marshal whitelist: %v", err)
	}
	version := &skillmodel.SkillVersion{
		SkillID:                   skill.ID,
		VersionNumber:             1,
		Status:                    enums.SkillVersionStatusActive,
		InstructionTemplate:       template,
		InstructionTemplateSHA256: "aabbccdd00112233",
		ModelWhitelistSnapshot:    skillmodel.SkillJSONB(wl),
		RequiredPlanSnapshot:      enums.RequiredPlanFree,
		MonetizationSnapshot:      skillmodel.SkillJSONB("{}"),
		CreatedBy:                 1,
	}
	if err := db.Create(version).Error; err != nil {
		t.Fatalf("create skill version: %v", err)
	}
	if err := db.Model(skill).Update("active_version_id", version.ID).Error; err != nil {
		t.Fatalf("activate version: %v", err)
	}
	skill.ActiveVersionID = &version.ID
	// DR-66: published skills require the caller to be enabled before the gate lets
	// resolution proceed. All distribution-path tests act as user 7 (see
	// newSkillDistributionCtx), so seed an enabled row for (7, tenant=7, skill).
	if err := db.Create(&skillmodel.UserEnabledSkill{
		UserID: 7, TenantID: 7, SkillID: skill.ID, Enabled: true,
	}).Error; err != nil {
		t.Fatalf("seed enabled row: %v", err)
	}
	return skill, version
}

func newSkillDistributionCtx(t *testing.T, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	buf, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/routing/chat/completions", bytes.NewReader(buf))
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyAirbotixUser, &platformmodel.User{
		Id:     7,
		Group:  "default",
		Status: common.UserStatusEnabled,
	})
	return c, w
}

func TestResolveAutoModel_SkillRelayUsesServerSnapshotBeforeSmartRouter(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, version := insertDistributionSkill(t, db, "server snapshot template", []string{VirtualModelAuto})
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model": "client-picked-expensive-model",
		"messages": []map[string]string{
			{"role": "system", "content": "client tries to steer routing"},
			{"role": "user", "content": "first user turn"},
			{"role": "assistant", "content": "old assistant turn"},
			{"role": "user", "content": "last user turn"},
		},
		"deeprouter": map[string]any{"skill_id": skill.ID},
	})
	modelRequest := &ModelRequest{Model: "client-picked-expensive-model"}

	if errCode := prepareSkillRelayForDistribution(c, modelRequest); errCode != "" {
		t.Fatalf("prepareSkillRelayForDistribution error = %s", errCode)
	}
	if modelRequest.Model != VirtualModelAuto {
		t.Fatalf("modelRequest.Model = %q, want server snapshot model %q", modelRequest.Model, VirtualModelAuto)
	}

	var rewritten dto.GeneralOpenAIRequest
	if err := common.UnmarshalBodyReusable(c, &rewritten); err != nil {
		t.Fatalf("unmarshal rewritten body: %v", err)
	}
	if rewritten.Model != VirtualModelAuto {
		t.Fatalf("rewritten.Model = %q, want %q", rewritten.Model, VirtualModelAuto)
	}
	if len(rewritten.Messages) != 2 {
		t.Fatalf("rewritten messages len = %d, want 2", len(rewritten.Messages))
	}
	if got := rewritten.Messages[0].StringContent(); got != "server snapshot template" {
		t.Fatalf("system message = %q, want server template", got)
	}
	if got := rewritten.Messages[1].StringContent(); got != "last user turn" {
		t.Fatalf("user message = %q, want last user turn", got)
	}
	if rewritten.Deeprouter == nil || rewritten.Deeprouter.SkillID != skill.ID {
		t.Fatalf("deeprouter skill extension must survive until TextHelper strips it")
	}
	sCtx, ok := skillrelay.Get(c)
	if !ok {
		t.Fatal("SkillRelayContext was not set")
	}
	if sCtx.SkillVersionID != version.ID {
		t.Fatalf("SkillVersionID = %q, want %q", sCtx.SkillVersionID, version.ID)
	}

	url, cleanup := stubServer(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		payload := string(body)
		if strings.Contains(payload, "client tries to steer routing") || strings.Contains(payload, "first user turn") {
			t.Fatalf("smart-router received client-controlled routing context: %s", payload)
		}
		if !strings.Contains(payload, "server snapshot template") || !strings.Contains(payload, "last user turn") {
			t.Fatalf("smart-router did not receive server snapshot context: %s", payload)
		}
		data, _ := common.Marshal(map[string]any{
			"primary":        "server-routed-model",
			"fallback_chain": []string{"gpt-4o-mini"},
			"reason":         "skill_snapshot_context",
		})
		_, _ = w.Write(data)
	})
	defer cleanup()

	if resolved := resolveAutoModel(c, modelRequest.Model, smart_router_client.NewClient(url, time.Second)); resolved != "" {
		modelRequest.Model = resolved
	}
	if modelRequest.Model != "server-routed-model" {
		t.Fatalf("modelRequest.Model after smart-router = %q, want server-routed-model", modelRequest.Model)
	}
}

// ── prepareSkillRelayForDistribution error-branch tests ──────────────────────

func TestPrepareSkillRelay_NilModelRequest_ReturnsEmpty(t *testing.T) {
	c, _ := newSkillDistributionCtx(t, map[string]any{"model": "gpt-4o", "messages": []map[string]string{{"role": "user", "content": "hi"}}})
	if errCode := prepareSkillRelayForDistribution(c, nil); errCode != "" {
		t.Fatalf("nil modelRequest must return empty, got %s", errCode)
	}
}

func TestPrepareSkillRelay_NonChatPath_ReturnsEmpty(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	// /v1/completions is not RelayModeChatCompletions
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/completions", bytes.NewReader([]byte(`{"model":"gpt-4o"}`)))
	c.Request.Header.Set("Content-Type", "application/json")
	if errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"}); errCode != "" {
		t.Fatalf("non-chat path must return empty, got %s", errCode)
	}
}

func TestPrepareSkillRelay_NoSkillID_ReturnsEmpty(t *testing.T) {
	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":    "gpt-4o",
		"messages": []map[string]string{{"role": "user", "content": "hi"}},
	})
	if errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"}); errCode != "" {
		t.Fatalf("no skill_id must return empty, got %s", errCode)
	}
}

func TestPrepareSkillRelay_UnknownSkillID_ReturnsError(t *testing.T) {
	db := newSkillDistributionDB(t)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": "does-not-exist"},
	})
	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	if errCode == "" {
		t.Fatal("unknown skill_id must return an error code")
	}
}

func TestPrepareSkillRelay_EmptyWhitelist_ReturnsInternalError(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, _ := insertDistributionSkill(t, db, "tmpl", []string{}) // empty whitelist
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": skill.ID},
	})
	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	if errCode == "" {
		t.Fatal("empty whitelist must return an error code")
	}
}

func TestPrepareSkillRelay_NoUserMessage_ReturnsInvalidRequest(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, _ := insertDistributionSkill(t, db, "tmpl", []string{"gpt-4o-mini"})
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "system", "content": "sys"}},
		"deeprouter": map[string]any{"skill_id": skill.ID},
	})
	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	if errCode == "" {
		t.Fatal("no user message must return an error code")
	}
}

// TestPrepareSkillRelay_DR66_NotEnabled_NoSnapshotNoRewrite is the Distribute-path
// no-snapshot regression for DR-66: a published skill the caller has not enabled is
// rejected before the version snapshot is queried, and the request body is left
// unrewritten (client model preserved, no instruction_template injected).
func TestPrepareSkillRelay_DR66_NotEnabled_NoSnapshotNoRewrite(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, _ := insertDistributionSkill(t, db, "SENTINEL_DR66_TEMPLATE", []string{VirtualModelAuto})
	// Disable the enabled row seeded for user 7 (see insertDistributionSkill) so the gate fails.
	if err := db.Model(&skillmodel.UserEnabledSkill{}).
		Where("user_id = ? AND skill_id = ?", 7, skill.ID).
		Update("enabled", false).Error; err != nil {
		t.Fatalf("disable enabled row: %v", err)
	}

	var snapshotSelects int
	if err := db.Callback().Query().After("gorm:query").Register("dr66_count", func(d *gorm.DB) {
		if strings.Contains(strings.ToLower(d.Statement.SQL.String()), "skill_versions") {
			snapshotSelects++
		}
	}); err != nil {
		t.Fatalf("register counter: %v", err)
	}

	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "client-model",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": skill.ID},
	})
	modelRequest := &ModelRequest{Model: "client-model"}

	errCode := prepareSkillRelayForDistribution(c, modelRequest)
	if string(errCode) != "SKILL_NOT_ENABLED" {
		t.Fatalf("errCode = %q, want SKILL_NOT_ENABLED", errCode)
	}
	if snapshotSelects != 0 {
		t.Fatalf("skill_versions SELECT count = %d, want 0 (no snapshot on gate failure)", snapshotSelects)
	}
	if modelRequest.Model != "client-model" {
		t.Fatalf("modelRequest.Model = %q, must be unchanged on gate failure", modelRequest.Model)
	}

	// Body must be untouched: still the client model, no injected sentinel template.
	var body dto.GeneralOpenAIRequest
	if err := common.UnmarshalBodyReusable(c, &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body.Model != "client-model" {
		t.Fatalf("rewritten body model = %q, must be unchanged", body.Model)
	}
	for _, m := range body.Messages {
		if strings.Contains(m.StringContent(), "SENTINEL_DR66_TEMPLATE") {
			t.Fatalf("instruction template must not be injected on gate failure")
		}
	}
}

// TestPrepareSkillRelay_SetsSkillVersionID verifies that prepareSkillRelayForDistribution
// populates SkillVersionID on the gin context after a successful LoadAndApply.
func TestPrepareSkillRelay_SetsSkillVersionID(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, version := insertDistributionSkill(t, db, "tmpl", []string{"gpt-4o-mini"})
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": skill.ID},
	})
	if errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"}); errCode != "" {
		t.Fatalf("prepareSkillRelayForDistribution error: %s", errCode)
	}
	sCtx, ok := skillrelay.Get(c)
	if !ok || sCtx.SkillVersionID != version.ID {
		t.Fatalf("SkillVersionID = %q, want %q", sCtx.SkillVersionID, version.ID)
	}
}

// Note: the TOCTOU guard (preventing re-Resolve when SkillVersionID is already pinned)
// lives in TextHelper's Resolve block (relay/compatible_handler.go:74).
// It is tested by TestTextHelper_SkillRelay_TOCTOU_PinnedVersionIDPreserved
// in relay/compatible_handler_skill_test.go.
