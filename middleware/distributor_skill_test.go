package middleware

// Skill-relay distributor tests (DR-68).
// Functions under test live in middleware/skill_distributor.go.
//
// Coverage note: this file focuses on distributor-side skill relay rewrite and
// blocked-path behavior. The TOCTOU guard in TextHelper's Resolve block
// is tested in relay/compatible_handler_skill_test.go
// (TestTextHelper_SkillRelay_TOCTOU_PinnedVersionIDPreserved).

import (
	"bytes"
	"errors"
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
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	skillrelay "github.com/QuantumNous/new-api/internal/skill/relay"
	"github.com/QuantumNous/new-api/internal/smart_router_client"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	if err := database.AutoMigrate(
		&skillmodel.Skill{},
		&skillmodel.SkillVersion{},
		&skillmodel.UserEnabledSkill{},
		&platformmodel.SubscriptionPlan{},
		&platformmodel.UserSubscription{},
	); err != nil {
		t.Fatalf("migrate skill tables: %v", err)
	}
	if err := skillmodel.MigrateSkillUsageEvents(database); err != nil {
		t.Fatalf("migrate skill usage events: %v", err)
	}
	return database
}

func enableDistributionSkillRow(t *testing.T, db *gorm.DB, userID int, skillID string) {
	t.Helper()
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:   int64(userID),
		TenantID: int64(userID),
		SkillID:  skillID,
		Enabled:  true,
	}).Error)
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
	return skill, version
}

func newSkillDistributionCtx(t *testing.T, body any) (*gin.Context, *httptest.ResponseRecorder) {
	return newSkillDistributionCtxWithPath(t, "/v1/routing/chat/completions", body)
}

func newSkillDistributionCtxWithPath(t *testing.T, path string, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	buf, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, path, bytes.NewReader(buf))
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyAirbotixUser, &platformmodel.User{
		Id:     7,
		Group:  "default",
		Status: common.UserStatusEnabled,
	})
	return c, w
}

func countBlockedEvents(t *testing.T, db *gorm.DB) []skillmodel.SkillUsageEvent {
	t.Helper()
	var events []skillmodel.SkillUsageEvent
	require.NoError(t, db.Where("event_type = ?", enums.SkillUsageEventTypeBlocked).Find(&events).Error)
	return events
}

func TestResolveAutoModel_SkillRelayUsesServerSnapshotBeforeSmartRouter(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, version := insertDistributionSkill(t, db, "server snapshot template", []string{VirtualModelAuto})
	enableDistributionSkillRow(t, db, 7, skill.ID)
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
	common.SetContextKey(c, constant.ContextKeySkillRelayEntryPoint, string(enums.EntryPointSkillPackage))
	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrSkillNotFound, errCode)

	events := countBlockedEvents(t, db)
	require.Len(t, events, 1, "route-derived entry_point must emit one skill_blocked event on distribute resolve failure")
	require.NotNil(t, events[0].BlockReason)
	assert.Equal(t, enums.BlockReasonSkillNotFound, *events[0].BlockReason)
	require.NotNil(t, events[0].ErrorCode)
	assert.Equal(t, string(errcodes.ErrSkillNotFound), *events[0].ErrorCode)
	assert.Equal(t, enums.EntryPointSkillPackage, events[0].EntryPoint)
	require.NotNil(t, events[0].SkillID)
	assert.Equal(t, "does-not-exist", *events[0].SkillID)
	require.NotNil(t, events[0].UserID)
	assert.Equal(t, int64(7), *events[0].UserID)
	require.NotNil(t, events[0].TenantID)
	assert.Equal(t, int64(7), *events[0].TenantID)
	assert.Nil(t, events[0].SkillVersionID)
	require.NotNil(t, events[0].RequestID)
	assert.NotEmpty(t, *events[0].RequestID)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled))
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedEmitted))
}

func TestPrepareSkillRelay_UnknownSkillID_RequestBodyEntryPoint_EmitsBlocked(t *testing.T) {
	db := newSkillDistributionDB(t)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": "does-not-exist", "entry_point": string(enums.EntryPointAdminPreview)},
	})

	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrSkillNotFound, errCode)

	events := countBlockedEvents(t, db)
	require.Len(t, events, 1, "request-derived entry_point must emit one skill_blocked event on distribute resolve failure")
	assert.Equal(t, enums.EntryPointAdminPreview, events[0].EntryPoint)
	require.NotNil(t, events[0].BlockReason)
	assert.Equal(t, enums.BlockReasonSkillNotFound, *events[0].BlockReason)
}

func TestPrepareSkillRelay_NormalChatCompletions_RequestBodyEntryPoint_EmitsBlocked(t *testing.T) {
	db := newSkillDistributionDB(t)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtxWithPath(t, "/v1/chat/completions", map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": "does-not-exist", "entry_point": string(enums.EntryPointAdminPreview)},
	})

	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrSkillNotFound, errCode)

	events := countBlockedEvents(t, db)
	require.Len(t, events, 1, "normal chat path must emit one skill_blocked event when body entry_point is valid")
	assert.Equal(t, enums.EntryPointAdminPreview, events[0].EntryPoint)
	require.NotNil(t, events[0].BlockReason)
	assert.Equal(t, enums.BlockReasonSkillNotFound, *events[0].BlockReason)
}

func TestPrepareSkillRelay_EmptyWhitelist_ReturnsInternalError(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, version := insertDistributionSkill(t, db, "tmpl", []string{}) // empty whitelist
	enableDistributionSkillRow(t, db, 7, skill.ID)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": skill.ID},
	})
	common.SetContextKey(c, constant.ContextKeySkillRelayEntryPoint, string(enums.EntryPointSkillPackage))
	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrSkillInternalError, errCode)
	assert.Empty(t, countBlockedEvents(t, db), "SKILL_INTERNAL_ERROR must stay outside DR-70 skill_blocked on distribute path")

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok, "post-resolve LoadAndApply failure must preserve SkillRelayContext for later blocked helper reads")
	assert.Equal(t, skill.ID, sCtx.SkillID)
	assert.Equal(t, version.ID, sCtx.SkillVersionID, "post-resolve failure must keep the already bound SkillVersionID on context")
	require.NotNil(t, sCtx.SkillVersion)
	assert.Equal(t, version.ID, sCtx.SkillVersion.ID, "post-resolve failure must keep the bound SkillVersion snapshot on context")
	assert.Equal(t, string(enums.EntryPointSkillPackage), sCtx.EntryPoint)
}

func TestPrepareSkillRelay_NoUserMessage_ReturnsInvalidRequest(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, _ := insertDistributionSkill(t, db, "tmpl", []string{"gpt-4o-mini"})
	enableDistributionSkillRow(t, db, 7, skill.ID)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "system", "content": "sys"}},
		"deeprouter": map[string]any{"skill_id": skill.ID},
	})
	common.SetContextKey(c, constant.ContextKeySkillRelayEntryPoint, string(enums.EntryPointSkillPackage))
	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrInvalidRequest, errCode)
	assert.Empty(t, countBlockedEvents(t, db), "INVALID_REQUEST must not emit skill_blocked on distribute LoadAndApply path")

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok, "post-resolve INVALID_REQUEST must still keep SkillRelayContext on context")
	assert.Equal(t, skill.ID, sCtx.SkillID)
	assert.NotEmpty(t, sCtx.SkillVersionID, "resolved version binding must stay on context even when LoadAndApply rejects the request")
	require.NotNil(t, sCtx.SkillVersion)
	assert.Equal(t, string(enums.EntryPointSkillPackage), sCtx.EntryPoint)
}

func TestPrepareSkillRelay_UnknownSkillID_NoRealEntryPoint_OmitsBlocked(t *testing.T) {
	db := newSkillDistributionDB(t)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": "does-not-exist"},
	})
	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrSkillNotFound, errCode)
	assert.Empty(t, countBlockedEvents(t, db), "missing real route-derived entry_point must omit skill_blocked on distribute path")
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled))
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedEmitted))
}

func TestPrepareSkillRelay_InvalidRequestEntryPoint_ReturnsInvalidRequestWithoutEmit(t *testing.T) {
	db := newSkillDistributionDB(t)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": "does-not-exist", "entry_point": "not_a_real_entry_point"},
	})

	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrInvalidRequest, errCode)
	assert.Empty(t, countBlockedEvents(t, db), "invalid request-provided entry_point must not emit skill_blocked on distribute path")
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled))
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedEmitted))
}

func TestPrepareSkillRelay_UnknownSkillID_KidsSession_UsesPseudonymousIdentity(t *testing.T) {
	t.Setenv("SKILL_KIDS_ANALYTICS_SALT_VERSION", "2026-06-24")
	t.Setenv("SKILL_KIDS_ANALYTICS_DAILY_SALT", "test-daily-salt")

	db := newSkillDistributionDB(t)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c, _ := newSkillDistributionCtxWithPath(t, "/v1/chat/completions", map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": "does-not-exist", "entry_point": string(enums.EntryPointAdminPreview)},
	})
	common.SetContextKey(c, constant.ContextKeyAirbotixUser, &platformmodel.User{
		Id:       7,
		Group:    "default",
		Status:   common.UserStatusEnabled,
		KidsMode: true,
	})

	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrSkillNotFound, errCode)

	events := countBlockedEvents(t, db)
	require.Len(t, events, 1, "kids-session distribute resolve-time block must still emit")
	assert.Equal(t, enums.EntryPointAdminPreview, events[0].EntryPoint)
	assert.Nil(t, events[0].UserID, "kids blocked event must not persist real user_id")
	assert.Nil(t, events[0].TenantID, "kids blocked event must not persist real tenant_id")
	assert.True(t, events[0].IsKidsSession)
	require.NotNil(t, events[0].SessionID)
	assert.NotEmpty(t, *events[0].SessionID)
	require.NotNil(t, events[0].BlockReason)
	assert.Equal(t, enums.BlockReasonSkillNotFound, *events[0].BlockReason)
}

func TestPrepareSkillRelay_UnknownSkillID_WriterFailurePreservesErrcode(t *testing.T) {
	db := newSkillDistributionDB(t)
	skillrelay.SetDB(db)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	writeErr := errors.New("skill_blocked write failed")
	var writeCalls int
	restore := skillrelay.SetBlockedEventWriterForTest(func(_ *gin.Context, event *skillmodel.SkillUsageEvent) error {
		writeCalls++
		return writeErr
	})
	t.Cleanup(restore)

	c, _ := newSkillDistributionCtx(t, map[string]any{
		"model":      "gpt-4o",
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
		"deeprouter": map[string]any{"skill_id": "does-not-exist"},
	})
	common.SetContextKey(c, constant.ContextKeySkillRelayEntryPoint, string(enums.EntryPointSkillPackage))

	errCode := prepareSkillRelayForDistribution(c, &ModelRequest{Model: "gpt-4o"})
	require.Equal(t, errcodes.ErrSkillNotFound, errCode)
	assert.Equal(t, 1, writeCalls, "writer failure path must attempt exactly one blocked-event write and must not retry")
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedHandled))
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeySkillBlockedEmitted))
	assert.Empty(t, countBlockedEvents(t, db), "writer failure path must not persist a partial skill_blocked row")
}

// TestPrepareSkillRelay_SetsSkillVersionID verifies that prepareSkillRelayForDistribution
// populates SkillVersionID on the gin context after a successful LoadAndApply.
func TestPrepareSkillRelay_SetsSkillVersionID(t *testing.T) {
	db := newSkillDistributionDB(t)
	skill, version := insertDistributionSkill(t, db, "tmpl", []string{"gpt-4o-mini"})
	enableDistributionSkillRow(t, db, 7, skill.ID)
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
