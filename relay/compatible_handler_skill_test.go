package relay

// Integration-light tests for the skill relay entry point wired into TextHelper
// (DR-64 + DR-68, tasks/05 section 5.1 steps 1-6). These tests exercise
// TextHelper with a real gin context and an in-memory SQLite DB. They do not
// require a live upstream provider because the relay aborts before any real
// provider call and we only verify that early-return behavior.
//
// Coverage note:
// - skill relay paths in TextHelper are covered here
// - unrelated non-skill branches still require live channel setup

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	skillrelay "github.com/QuantumNous/new-api/internal/skill/relay"
	platformmodel "github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ---- test helpers ----

// newSkillTestDB creates an in-memory SQLite DB with Skill + SkillVersion tables.
// User is supplied via gin context (fast path) so no Users table is needed.
func newSkillTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&skillmodel.Skill{}, &skillmodel.SkillVersion{}))
	return database
}

// insertVersionForSkill creates a SkillVersion for skill and wires it as the active version.
// Returns the inserted version. Used by tests that reach LoadAndApply (DR-68).
func insertVersionForSkill(t *testing.T, db *gorm.DB, skill *skillmodel.Skill, template string, whitelist []string) *skillmodel.SkillVersion {
	t.Helper()
	wl, err := common.Marshal(whitelist)
	require.NoError(t, err)
	version := &skillmodel.SkillVersion{
		SkillID:                   skill.ID,
		VersionNumber:             1,
		Status:                    enums.SkillVersionStatusActive,
		InstructionTemplate:       template,
		InstructionTemplateSHA256: "aabb",
		ModelWhitelistSnapshot:    skillmodel.SkillJSONB(wl),
		RequiredPlanSnapshot:      enums.RequiredPlanFree,
		MonetizationSnapshot:      skillmodel.SkillJSONB("{}"),
		CreatedBy:                 1,
	}
	require.NoError(t, db.Create(version).Error)
	require.NoError(t, db.Model(skill).Update("active_version_id", version.ID).Error)
	skill.ActiveVersionID = &version.ID
	return version
}

// userMsg returns a dto.Message with role "user" and string content.
func userMsg(content string) dto.Message {
	m := dto.Message{Role: "user"}
	m.SetStringContent(content)
	return m
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
	// ChannelTypeAIProxyLibrary maps to APITypeAIProxyLibrary and GetAdaptor returns nil.
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

// ---- TextHelper skill relay guard tests ----

// TestTextHelper_SkillRelay_Anonymous_Returns401 verifies that an anonymous request
// carrying deeprouter.skill_id is rejected at relay entry (step 3 of tasks/05 section 5.1)
// with HTTP 401 AUTH_REQUIRED, before any model mapping or adaptor lookup.
func TestTextHelper_SkillRelay_Anonymous_Returns401(t *testing.T) {
	c := newSkillTestCtx(t, 0) // userID=0 means anonymous

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
// continues. TextHelper may fail downstream (no channel/provider in tests)  that is
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
	version := insertVersionForSkill(t, testDB, skill, "Be concise.", []string{"deeprouter-auto"})

	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 7)

	// TextHelper exits after LoadAndApply (no adaptor available in tests)  we don't assert the error.
	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Messages:   []dto.Message{userMsg("hello")},
		Deeprouter: &dto.DeepRouterExtension{SkillID: skill.ID},
	}))

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok, "SkillRelayContext must be stored in context after successful relay entry")
	require.NotNil(t, sCtx)
	assert.Equal(t, skill.ID, sCtx.SkillID)
	assert.Equal(t, 7, sCtx.UserID)
	assert.True(t, sCtx.SubActive, "SubActive must be true for V1")
	assert.NotEmpty(t, sCtx.RequestID, "RequestID must be populated")
	assert.Equal(t, version.ID, sCtx.SkillVersionID, "DR-68: SkillVersionID must be populated by LoadAndApply")
	require.NotNil(t, sCtx.SkillVersion, "DR-65: SkillVersion snapshot must be stored on context")
	assert.Equal(t, version.ID, sCtx.SkillVersion.ID, "DR-65: context must keep the selected version snapshot")
}

// TestTextHelper_SkillRelay_NilDeepRouter_NotAffected verifies that a standard
// request (no deeprouter field) bypasses the skill relay gate entirely:
// no SkillRelayContext is stored, and any downstream failure is unrelated to
// the skill gate (not 401/403/404 from skill relay).
func TestTextHelper_SkillRelay_NilDeepRouter_NotAffected(t *testing.T) {
	c := newSkillTestCtx(t, 1)

	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		// Deeprouter: nil  normal request
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
// deeprouter: {"skill_id": ""} is treated as a normal relay request  the guard
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
// to "playground_picker" per tasks/03 9 V1 spec (Playground-only execution).
func TestTextHelper_SkillRelay_EntryPoint_DefaultIsPlaygroundPicker(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "ep-default", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "EP Default", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	insertVersionForSkill(t, testDB, skill, "template", []string{"deeprouter-auto"})
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 8)
	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Messages:   []dto.Message{userMsg("hello")},
		Deeprouter: &dto.DeepRouterExtension{SkillID: skill.ID},
		// EntryPoint intentionally absent
	}))

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok)
	assert.Equal(t, string(enums.EntryPointPlaygroundPicker), sCtx.EntryPoint,
		"missing entry_point must default to playground_picker per 9")
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
	insertVersionForSkill(t, testDB, skill, "template", []string{"deeprouter-auto"})
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 10)
	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{userMsg("hello")},
		Deeprouter: &dto.DeepRouterExtension{
			SkillID:    skill.ID,
			EntryPoint: "not_a_real_entry_point",
		},
	}))

	require.NotNil(t, apiErr, "invalid entry_point must be rejected")
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode,
		"invalid entry_point must return HTTP 400")

	_, hasCtx := skillrelay.Get(c)
	assert.False(t, hasCtx, "SkillRelayContext must not be stored when entry_point is invalid")
}

// TestTextHelper_SkillRelay_PartialExtension_NoSkillIDStripped verifies that a partial
// deeprouter extension (no skill_id) does NOT activate the skill gate and does NOT store
// a SkillRelayContext in the normal (non-pass-through) relay path. The vendor extension
// is stripped from the Go struct (request.Deeprouter = nil) before the request is
// serialised for upstream. The pass-through path is covered by
// TestTextHelper_SkillRelay_PartialExtension_PassThrough_Rejected.
func TestTextHelper_SkillRelay_PartialExtension_NoSkillIDStripped(t *testing.T) {
	for _, ext := range []*dto.DeepRouterExtension{
		{},                                // {"deeprouter": {}}
		{EntryPoint: "skill_package"},     // {"deeprouter": {"entry_point": "skill_package"}}
		{EntryPoint: "playground_picker"}, // valid enum, no skill_id
	} {
		c := newSkillTestCtx(t, 1)
		apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
			Model:      "gpt-4o",
			Deeprouter: ext,
		}))

		_, hasCtx := skillrelay.Get(c)
		assert.False(t, hasCtx, "partial deeprouter (no skill_id) must not set SkillRelayContext")

		// Must not return a skill-gate error (401/403/404).
		if apiErr != nil {
			assert.NotEqual(t, http.StatusUnauthorized, apiErr.StatusCode)
			assert.NotEqual(t, http.StatusForbidden, apiErr.StatusCode)
			assert.NotEqual(t, http.StatusNotFound, apiErr.StatusCode)
		}
	}
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
	insertVersionForSkill(t, testDB, skill, "template", []string{"deeprouter-auto"})
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 9)
	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{userMsg("hello")},
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

// TestTextHelper_SkillRelay_PartialExtension_PassThrough_Rejected verifies that
// pass-through mode is rejected when the original request carried any deeprouter
// extension, even a partial one without a skill_id. This prevents the vendor
// extension from leaking to upstream providers via the raw BodyStorage path that
// bypasses the Go struct sanitisation.
func TestTextHelper_SkillRelay_PartialExtension_PassThrough_Rejected(t *testing.T) {
	rawBody := []byte(`{"model":"gpt-4o","messages":[],"deeprouter":{"entry_point":"skill_package"}}`)
	bs, err := common.CreateBodyStorage(rawBody)
	require.NoError(t, err)
	defer bs.Close()

	c := newSkillTestCtx(t, 1)
	c.Set(common.KeyBodyStorage, bs)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: true})

	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Deeprouter: &dto.DeepRouterExtension{EntryPoint: string(enums.EntryPointSkillPackage)},
	}))

	require.NotNil(t, apiErr, "deeprouter extension with pass-through must be rejected")
	assert.Equal(t, http.StatusInternalServerError, apiErr.StatusCode,
		"must reject with 500 to prevent vendor extension leak in pass-through mode")

	_, hasCtx := skillrelay.Get(c)
	assert.False(t, hasCtx, "no SkillRelayContext should be stored when pass-through is rejected")
}

func TestTextHelper_SkillRelay_PublicRoutingAPI_RequiresSkillID(t *testing.T) {
	c := newSkillTestCtx(t, 12)
	common.SetContextKey(c, constant.ContextKeySkillPublicRoutingAPI, true)
	common.SetContextKey(c, constant.ContextKeySkillRelayEntryPoint, string(enums.EntryPointSkillPackage))

	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Deeprouter: &dto.DeepRouterExtension{EntryPoint: string(enums.EntryPointSkillPackage)},
	}))

	require.NotNil(t, apiErr, "public routing API must require deeprouter.skill_id")
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Contains(t, apiErr.Err.Error(), "deeprouter.skill_id")

	_, hasCtx := skillrelay.Get(c)
	assert.False(t, hasCtx, "missing skill_id must not create SkillRelayContext")
}

func TestTextHelper_SkillRelay_PublicRoutingAPI_ForcePackageEntryAndCredentialIdentity(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "public-routing", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "Public Routing", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	version := insertVersionForSkill(t, testDB, skill, "template", []string{"deeprouter-auto"})
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 13)
	common.SetContextKey(c, constant.ContextKeySkillPublicRoutingAPI, true)
	common.SetContextKey(c, constant.ContextKeySkillRelayEntryPoint, string(enums.EntryPointSkillPackage))

	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{userMsg("hello")},
		User:     []byte(`{"user_id":999,"tenant_id":"evil"}`),
		Deeprouter: &dto.DeepRouterExtension{
			SkillID:        skill.ID,
			SkillVersionID: version.ID,
			EntryPoint:     string(enums.EntryPointAdminPreview),
		},
	}))

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok)
	assert.Equal(t, 13, sCtx.UserID, "identity must come from the verified credential context")
	assert.Equal(t, version.ID, sCtx.SkillVersionID, "valid package-supplied skill_version_id must pin the server-verified execution version")
	require.NotNil(t, sCtx.SkillVersion, "DR-65: SkillVersion snapshot must be stored on context")
	assert.Equal(t, version.ID, sCtx.SkillVersion.ID, "DR-65: context must keep the selected version snapshot")
	assert.Equal(t, string(enums.EntryPointSkillPackage), sCtx.EntryPoint,
		"public routing API must force package entry point over package-provided values")
}

func TestTextHelper_SkillRelay_PublicRoutingAPI_InvalidVersionPinRejected(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "public-routing-bad-pin", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "Public Routing Bad Pin", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	insertVersionForSkill(t, testDB, skill, "template", []string{"deeprouter-auto"})
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 14)
	common.SetContextKey(c, constant.ContextKeySkillPublicRoutingAPI, true)
	common.SetContextKey(c, constant.ContextKeySkillRelayEntryPoint, string(enums.EntryPointSkillPackage))

	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:    "gpt-4o",
		Messages: []dto.Message{userMsg("hello")},
		Deeprouter: &dto.DeepRouterExtension{
			SkillID:        skill.ID,
			SkillVersionID: "00000000-0000-0000-0000-000000000000",
		},
	}))

	require.NotNil(t, apiErr, "invalid package version pin must be rejected")
	assert.Equal(t, http.StatusForbidden, apiErr.StatusCode)
	assert.Equal(t, "SKILL_NOT_PUBLISHED", apiErr.Err.Error())
	_, hasCtx := skillrelay.Get(c)
	assert.False(t, hasCtx, "invalid pin must not store SkillRelayContext")
}

//  DR-68 specific integration tests

// TestTextHelper_SkillRelay_DR68_EmptyWhitelist_Returns500 verifies that a skill
// whose active version has an empty model_whitelist_snapshot causes LoadAndApply to
// fail with SKILL_INTERNAL_ERROR (HTTP 500). An empty whitelist means selectModel has
// nothing to return  the request must be aborted, not forwarded with a blank model.
func TestTextHelper_SkillRelay_DR68_EmptyWhitelist_Returns500(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "empty-wl", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "Empty WL Skill", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	insertVersionForSkill(t, testDB, skill, "template", []string{}) // empty whitelist
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 5)
	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Messages:   []dto.Message{userMsg("hello")},
		Deeprouter: &dto.DeepRouterExtension{SkillID: skill.ID},
	}))

	require.NotNil(t, apiErr, "empty whitelist must abort with an error")
	assert.Equal(t, http.StatusInternalServerError, apiErr.StatusCode,
		"empty whitelist must return HTTP 500 SKILL_INTERNAL_ERROR")
	assert.Equal(t, "SKILL_INTERNAL_ERROR", apiErr.Err.Error())
}

// TestTextHelper_SkillRelay_DR68_NoUserMessage_Returns400 verifies that a skill relay
// request whose message array contains no user-role message is rejected with HTTP 400
// INVALID_REQUEST. FR-G19 requires a user message to form the stateless single-turn pair.
func TestTextHelper_SkillRelay_DR68_NoUserMessage_Returns400(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "no-user-msg", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "No User Msg", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	insertVersionForSkill(t, testDB, skill, "template", []string{"deeprouter-auto"})
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	sys := dto.Message{Role: "system"}
	sys.SetStringContent("system only  no user message")
	c := newSkillTestCtx(t, 5)
	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Messages:   []dto.Message{sys}, // no user role
		Deeprouter: &dto.DeepRouterExtension{SkillID: skill.ID},
	}))

	require.NotNil(t, apiErr, "missing user message must abort with an error")
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode,
		"no user message must return HTTP 400 INVALID_REQUEST")
	assert.Equal(t, "INVALID_REQUEST", apiErr.Err.Error())
}

// TestApplySystemPromptIfNeeded_SkippedForSkillRelay verifies D4 fix (Responses path):
// applySystemPromptIfNeeded must be a no-op when a SkillRelayContext is active.
// The channel-level SystemPrompt must not prepend or override instruction_template.
func TestApplySystemPromptIfNeeded_SkippedForSkillRelay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
	skillrelay.Set(c, &skillrelay.SkillRelayContext{SkillID: "skill-x"})

	info := &relaycommon.RelayInfo{}
	info.ChannelMeta = &relaycommon.ChannelMeta{}
	info.ChannelSetting.SystemPrompt = "DO NOT INJECT THIS"
	info.ChannelSetting.SystemPromptOverride = true

	// Simulate the post-LoadAndApply state: [system: instruction_template, user: msg]
	sysMsg := dto.Message{Role: "system"}
	sysMsg.SetStringContent("skill instruction_template")
	uMsg := dto.Message{Role: "user"}
	uMsg.SetStringContent("user question")
	req := &dto.GeneralOpenAIRequest{Messages: []dto.Message{sysMsg, uMsg}}

	applySystemPromptIfNeeded(c, info, req)

	require.Len(t, req.Messages, 2,
		"D4 (Responses path): channel SystemPrompt must not be injected for skill relay")
	assert.Equal(t, "skill instruction_template", req.Messages[0].StringContent(),
		"instruction_template must be preserved unchanged")
}

// TestApplySystemPromptIfNeeded_InjectsForNonSkillRelay verifies that the D4 guard
// does not break normal (non-skill) requests: channel SystemPrompt must still be
// injected when there is no SkillRelayContext in the gin context.
func TestApplySystemPromptIfNeeded_InjectsForNonSkillRelay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
	// No skillrelay.Set call here: this is a non-skill relay request.

	info := &relaycommon.RelayInfo{}
	info.ChannelMeta = &relaycommon.ChannelMeta{}
	info.ChannelSetting.SystemPrompt = "Be concise."

	req := &dto.GeneralOpenAIRequest{Messages: []dto.Message{userMsg("hello")}}

	applySystemPromptIfNeeded(c, info, req)

	require.Len(t, req.Messages, 2,
		"channel SystemPrompt must be prepended for non-skill relay")
	assert.Equal(t, "system", req.Messages[0].Role)
	assert.Equal(t, "Be concise.", req.Messages[0].StringContent())
	assert.Equal(t, "hello", req.Messages[1].StringContent())
}

// TestTextHelper_SkillRelay_DR68_LoadAndApply_Executed verifies the DR-68 integration
// end-to-end within TextHelper: LoadAndApply must be called, must succeed (SkillVersionID
// populated on ctx), and the relay must NOT abort with a skill-gate error (401/403/404/500
// from skill machinery). The relay exits later due to a missing adaptor, which is expected.
func TestTextHelper_SkillRelay_DR68_LoadAndApply_Executed(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "dr68-skill", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "DR68 Skill", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	version := insertVersionForSkill(t, testDB, skill, "You are a math tutor.", []string{"deeprouter-auto"})
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 5)

	// Multi-turn history: LoadAndApply must strip to [system, last-user] only.
	a1 := dto.Message{Role: "assistant"}
	a1.SetStringContent("Hello!")
	apiErr := TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o", // must be overridden by server-selected "deeprouter-auto"
		Messages:   []dto.Message{userMsg("first question"), a1, userMsg("second question")},
		Deeprouter: &dto.DeepRouterExtension{SkillID: skill.ID},
	}))

	// The test proves LoadAndApply ran by checking SkillVersionID on the context.
	// We do not assert on apiErr.StatusCode because TextHelper exits later with a
	// nil-adaptor error that is unrelated to skill correctness.
	if apiErr != nil {
		// Skill-gate errors (401, 403, 404) would mean LoadAndApply was never reached.
		assert.NotEqual(t, http.StatusUnauthorized, apiErr.StatusCode, "must not be skill AUTH_REQUIRED")
		assert.NotEqual(t, http.StatusForbidden, apiErr.StatusCode, "must not be skill gate 403")
		assert.NotEqual(t, http.StatusNotFound, apiErr.StatusCode, "must not be SKILL_NOT_FOUND")
	}

	sCtx, ok := skillrelay.Get(c)
	require.True(t, ok)
	assert.Equal(t, version.ID, sCtx.SkillVersionID,
		"DR-68: SkillVersionID must be populated by LoadAndApply to prove version snapshot was loaded")
}

// TestTextHelper_SkillRelay_TOCTOU_PinnedVersionIDPreserved verifies the TOCTOU guard
// in TextHelper's Resolve block (compatible_handler.go): when the Distribute path has
// already pinned a SkillVersionID on the gin context, TextHelper must NOT call Resolve
// again (which could return a different active_version_id if the skill was updated
// between Distribute and TextHelper, breaking server-authoritative routing).
//
// Guard under test (compatible_handler.go):
//
//	if existing, alreadyLoaded := skillrelay.Get(c); alreadyLoaded && existing.SkillVersionID != ""
//	    skillCtx = existing   // reuse pinned context; skip Resolve
//
// Coverage: relay/compatible_handler.go - Distribute fast-path in hadDeeprouterExtension
func TestTextHelper_SkillRelay_TOCTOU_PinnedVersionIDPreserved(t *testing.T) {
	testDB := newSkillTestDB(t)
	skill := &skillmodel.Skill{
		Slug: "toctou-skill", Status: enums.SkillStatusPublished, Category: "test",
		RequiredPlan: enums.RequiredPlanFree, MonetizationType: enums.MonetizationTypeFree,
		Name: "TOCTOU Skill", ShortDescription: "s", Description: "d", CreatedBy: 1,
	}
	require.NoError(t, testDB.Create(skill).Error)
	version := insertVersionForSkill(t, testDB, skill, "You are a tutor.", []string{"gpt-4o-mini"})
	skillrelay.SetDB(testDB)
	t.Cleanup(func() { skillrelay.SetDB(nil) })

	c := newSkillTestCtx(t, 5)

	// Simulate the Distribute path: context is pre-seeded with a SkillVersionID that
	// differs from the real DB version.ID (as if active_version_id changed between calls).
	// If the TOCTOU guard is absent, Resolve would return the real version.ID and
	// LoadAndApply would overwrite the context - the assertions below would fail.
	const pinnedID = "distribute-pinned-version-id"
	skillrelay.Set(c, &skillrelay.SkillRelayContext{
		SkillID:        skill.ID,
		SkillVersionID: pinnedID,
		Skill:          skill,
	})

	// TextHelper will fail downstream (nil adaptor for AIProxyLibrary channel type)
	//  that is expected and irrelevant. We only assert on context state.
	TextHelper(c, newSkillRelayInfo(&dto.GeneralOpenAIRequest{
		Model:      "gpt-4o",
		Messages:   []dto.Message{userMsg("hello")},
		Deeprouter: &dto.DeepRouterExtension{SkillID: skill.ID},
	}))

	ctx, ok := skillrelay.Get(c)
	require.True(t, ok, "SkillRelayContext must still be set after TextHelper")
	assert.Equal(t, pinnedID, ctx.SkillVersionID,
		"DR-68 TOCTOU: Distribute-pinned SkillVersionID must not be overwritten by TextHelper's Resolve block")
	assert.NotEqual(t, version.ID, ctx.SkillVersionID,
		"DR-68 TOCTOU: context must hold the Distribute-pinned value, not the DB-resolved version.ID")
}
