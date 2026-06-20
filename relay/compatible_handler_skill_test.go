package relay

// Integration-light tests for the skill relay entry point wired into TextHelper
// (DR-64, tasks/05 §5.1 steps 1-6). These tests exercise TextHelper with a real
// gin context and an in-memory SQLite DB. They do NOT require a live upstream
// provider: the relay aborts early at the skill gate and we only verify that
// early-return behavior.

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillrelay "github.com/QuantumNous/new-api/internal/skill/relay"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ── test helpers ──────────────────────────────────────────────────────────────

// newSkillTestDB creates an in-memory SQLite DB with the Skill table migrated.
// Only the Skill table is created — the User is supplied via gin context (fast path)
// so no Users table is needed.
func newSkillTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&skillmodel.Skill{}))
	return database
}

// newSkillTestCtx creates a minimal gin.Context for skill-relay integration tests.
// When userID > 0, both ContextKeyUserId and ContextKeyAirbotixUser are set so the
// resolver takes the fast path (no DB user lookup). Pass userID=0 for anonymous.
//
// ContextKeyChannelType is always set to ChannelTypeAIProxyLibrary (21).
// ChannelType2APIType maps it to APITypeAIProxyLibrary, which is absent from
// GetAdaptor's switch and therefore returns nil. TextHelper then exits with
// ErrorCodeInvalidApiType before any live HTTP request, preventing nil-client panics.
func newSkillTestCtx(t *testing.T, userID int) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	// ChannelTypeAIProxyLibrary → APITypeAIProxyLibrary → GetAdaptor returns nil.
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeAIProxyLibrary)
	if userID != 0 {
		user := &platformmodel.User{
			Id:     userID,
			Status: common.UserStatusEnabled,
			Group:  "default",
		}
		common.SetContextKey(c, constant.ContextKeyUserId, userID)
		common.SetContextKey(c, constant.ContextKeyAirbotixUser, user)
	}
	return c
}

// newSkillRelayInfo wraps req in the minimal RelayInfo that TextHelper requires.
func newSkillRelayInfo(req *dto.GeneralOpenAIRequest) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{Request: req}
}

// ── TextHelper skill relay guard tests ───────────────────────────────────────

// TestTextHelper_SkillRelay_Anonymous_Returns401 verifies that an anonymous request
// carrying deeprouter.skill_id is rejected at relay entry (step 3 of tasks/05 §5.1)
// with HTTP 401 AUTH_REQUIRED, before any model mapping or adaptor lookup.
func TestTextHelper_SkillRelay_Anonymous_Returns401(t *testing.T) {
	c := newSkillTestCtx(t, 0) // userID=0 → anonymous

	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Deeprouter: &dto.DeepRouterExtension{SkillID: "any-skill-id"},
	}))

	require.NotNil(t, apiErr, "anonymous skill request must be rejected with an error")
	assert.Equal(t, http.StatusUnauthorized, apiErr.StatusCode,
		"anonymous caller must get HTTP 401")
	assert.Equal(t, "AUTH_REQUIRED", apiErr.Err.Error(),
		"error code must be AUTH_REQUIRED (not a generic relay error)")
}

// TestTextHelper_SkillRelay_SkillNotFound_Returns404 verifies HTTP 404 when an
// authenticated user presents a skill_id that does not exist in the DB.
func TestTextHelper_SkillRelay_SkillNotFound_Returns404(t *testing.T) {
	testDB := newSkillTestDB(t)
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 42)

	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Deeprouter: &dto.DeepRouterExtension{SkillID: "00000000-0000-0000-0000-000000000000"},
	}))

	require.NotNil(t, apiErr, "unknown skill_id must be rejected with an error")
	assert.Equal(t, http.StatusNotFound, apiErr.StatusCode,
		"unknown skill_id must return HTTP 404")
	assert.Equal(t, "SKILL_NOT_FOUND", apiErr.Err.Error())
}

// TestTextHelper_SkillRelay_SkillFound_ContextSet verifies that when a skill is found,
// TextHelper stores a non-nil SkillRelayContext in the gin context before the relay
// continues. TextHelper may fail downstream (no channel/provider in tests) — that is
// expected; we only assert the relay-entry contract here.
func TestTextHelper_SkillRelay_SkillFound_ContextSet(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug:             "test-skill",
		Status:           enums.SkillStatusPublished,
		Category:         "test",
		RequiredPlan:     enums.RequiredPlanFree,
		MonetizationType: enums.MonetizationTypeFree,
		Name:             "Test Skill",
		ShortDescription: "short",
		Description:      "A test skill",
		CreatedBy:        1,
	}
	require.NoError(t, testDB.Create(skill).Error)

	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 7)

	// TextHelper may return an error (no adaptor) — we don't assert on it here.
	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Deeprouter: &dto.DeepRouterExtension{SkillID: skill.ID},
	}))

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok, "SkillRelayContext must be stored in context after successful relay entry")
	require.NotNil(t, sCtx)
	assert.Equal(t, skill.ID, sCtx.SkillID)
	assert.Equal(t, 7, sCtx.UserID)
	assert.True(t, sCtx.SubActive, "SubActive must be true for V1")
	assert.NotEmpty(t, sCtx.RequestID, "RequestID must be populated")
}

// TestTextHelper_SkillRelay_NilDeepRouter_NotAffected verifies that a standard
// request (no deeprouter field) bypasses the skill relay gate entirely:
// no SkillRelayContext is stored, and any downstream failure is unrelated to
// the skill gate (not 401/403/404 from skill relay).
func TestTextHelper_SkillRelay_NilDeepRouter_NotAffected(t *testing.T) {
	c := newSkillTestCtx(t, 1)

	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		// Deeprouter: nil — normal request
	}))

	_, hasCtx := skillrelay.Get(c)
	assert.False(t, hasCtx, "non-skill request must not set SkillRelayContext")

	// Any error must come from the relay infrastructure, NOT the skill gate.
	if apiErr != nil {
		assert.NotEqual(t, http.StatusUnauthorized, apiErr.StatusCode,
			"relay infra error must not be 401 AUTH_REQUIRED")
		assert.NotEqual(t, http.StatusForbidden, apiErr.StatusCode,
			"relay infra error must not be 403 from skill gate")
		assert.NotEqual(t, http.StatusNotFound, apiErr.StatusCode,
			"relay infra error must not be 404 SKILL_NOT_FOUND")
	}
}

// TestTextHelper_SkillRelay_EmptySkillID_NotAffected verifies that a request with
// deeprouter: {"skill_id": ""} is treated as a normal relay request — the guard
// condition `request.Deeprouter != nil && request.Deeprouter.SkillID != ""` must
// correctly ignore the empty-string case.
func TestTextHelper_SkillRelay_EmptySkillID_NotAffected(t *testing.T) {
	c := newSkillTestCtx(t, 1)

	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Deeprouter: &dto.DeepRouterExtension{SkillID: ""},
	}))

	_, hasCtx := skillrelay.Get(c)
	assert.False(t, hasCtx, "empty skill_id must not activate skill relay (guard must check SkillID != \"\")")
}

// TestTextHelper_SkillRelay_EntryPoint_DefaultIsPlaygroundPicker verifies that
// when deeprouter.entry_point is absent, SkillRelayContext.EntryPoint defaults
// to "playground_picker" per tasks/03 §9 V1 spec (Playground-only execution).
func TestTextHelper_SkillRelay_EntryPoint_DefaultIsPlaygroundPicker(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "ep-default", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "EP Default", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 8)
	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Deeprouter: &dto.DeepRouterExtension{SkillID: skill.ID},
		// EntryPoint intentionally absent
	}))

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok)
	assert.Equal(t, string(enums.EntryPointPlaygroundPicker), sCtx.EntryPoint,
		"missing entry_point must default to playground_picker per §9")
}

// TestTextHelper_SkillRelay_InvalidEntryPoint_Returns400 verifies that an unknown
// entry_point value is rejected with HTTP 400 before SkillRelayContext is stored.
// This prevents arbitrary strings from poisoning downstream analytics events.
func TestTextHelper_SkillRelay_InvalidEntryPoint_Returns400(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "ep-invalid", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "EP Invalid", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 10)
	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		Deeprouter: &dto.DeepRouterExtension{
			SkillID:    skill.ID,
			EntryPoint: "not_a_real_entry_point",
		},
	}))

	require.NotNil(t, apiErr, "invalid entry_point must be rejected")
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode,
		"invalid entry_point must return HTTP 400")

	_, hasCtx := skillrelay.Get(c)
	assert.False(t, hasCtx, "SkillRelayContext must NOT be stored when entry_point is invalid")
}

// TestTextHelper_SkillRelay_EntryPoint_FromDeepRouterField verifies that when
// deeprouter.entry_point is set (e.g. "skill_package" by an external package client),
// SkillRelayContext.EntryPoint carries that value through for analytics.
func TestTextHelper_SkillRelay_EntryPoint_FromDeepRouterField(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "ep-explicit", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "EP Explicit", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 9)
	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		Deeprouter: &dto.DeepRouterExtension{
			SkillID:    skill.ID,
			EntryPoint: string(enums.EntryPointSkillPackage),
		},
	}))

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok)
	assert.Equal(t, string(enums.EntryPointSkillPackage), sCtx.EntryPoint,
		"explicit entry_point from deeprouter field must be preserved in SkillRelayContext")
}
