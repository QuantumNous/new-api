package handler

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	appmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// testDownloadDB migrates skills + user_enabled_skills + skill_usage_events for download handler tests.
func testDownloadDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := testSkillDB(t)
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(db))
	return db
}

// testDownloadCtx builds a gin.Context pre-loaded with authenticated user fields
// (id, group) to simulate a user that has passed SkillUserAuth middleware.
func testDownloadCtx(skillID string, userID int, group string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := testContext("/api/v1/marketplace/skills/" + skillID + "/download")
	c.Params = gin.Params{{Key: "id", Value: skillID}}
	c.Set("id", userID)
	c.Set("group", group)
	return c, w
}

// TestDownloadSkillPackage_HappyPath verifies that a free skill can be downloaded
// by a free user: HTTP 200, Content-Type application/zip, UES row upserted.
func TestDownloadSkillPackage_HappyPath(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("cool-skill", "published"))).Error)

	c, w := testDownloadCtx("cool-skill", 42, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/zip", w.Header().Get("Content-Type"))
	assert.Contains(t, w.Header().Get("Content-Disposition"), "cool-skill.zip")
	assert.NotEmpty(t, w.Body.Bytes())

	// Fresh download-created UES row must use source=skill_package.
	var ues skillmodel.UserEnabledSkill
	err := db.Where("user_id = ? AND skill_id IN (SELECT id FROM skills WHERE slug = ?)", 42, "cool-skill").
		First(&ues).Error
	require.NoError(t, err, "user_enabled_skills row must be created on download")
	assert.True(t, ues.Enabled)
	assert.Equal(t, "skill_package", ues.Source, "UES source must be skill_package, not marketplace")
}

// TestDownloadSkillPackage_ZipContainsManifestAndSkillMD verifies that the zip
// includes both manifest.json and SKILL.md with the expected fields.
func TestDownloadSkillPackage_ZipContainsManifestAndSkillMD(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("zip-skill", "published")
	s.Name = "Zip Skill"
	s.ShortDescription = "Does zip things"
	s.Description = "A full description."
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("zip-skill", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	require.NoError(t, err)

	files := map[string][]byte{}
	for _, f := range zr.File {
		rc, err := f.Open()
		require.NoError(t, err)
		buf := new(bytes.Buffer)
		buf.ReadFrom(rc)
		rc.Close()
		files[f.Name] = buf.Bytes()
	}

	require.Contains(t, files, "manifest.json", "zip must contain manifest.json")
	require.Contains(t, files, "SKILL.md", "zip must contain SKILL.md")

	var m skillManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	assert.Equal(t, "1.0", m.SchemaVersion)
	assert.Equal(t, "zip-skill", m.Slug)
	assert.Equal(t, "Zip Skill", m.Name)
	assert.True(t, m.RequiresDeepRouterKey, "manifest must advertise requires_deeprouter_key: true")
	// skill_version_id is nil when active_version_id is not set (DR-41 not yet done).
	assert.Nil(t, m.SkillVersionID, "skill_version_id must be omitted when active_version_id is nil")

	skillMD := string(files["SKILL.md"])
	assert.Contains(t, skillMD, "name: zip-skill")
	assert.Contains(t, skillMD, `description: "Does zip things"`)
	assert.Contains(t, skillMD, "Zip Skill")
	assert.Contains(t, skillMD, "A full description.")
}

func TestBuildSkillMD_EscapesFrontMatterDescription(t *testing.T) {
	s := testSkill("frontmatter-skill", "published")
	s.ShortDescription = "quote \" slash \\ newline\n---"

	skillMD := buildSkillMD(s)

	assert.Contains(t, skillMD, `description: "quote \" slash \\ newline\n---"`)
	separatorLines := 0
	for _, line := range strings.Split(skillMD, "\n") {
		if line == "---" {
			separatorLines++
		}
	}
	assert.Equal(t, 2, separatorLines, "description must not create extra YAML document separator lines")
}

// TestDownloadSkillPackage_ManifestIncludesSkillVersionID verifies that when a skill
// has active_version_id set, the manifest includes skill_version_id (DR-41 path).
func TestDownloadSkillPackage_ManifestIncludesSkillVersionID(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	versionID := "aaaabbbb-cccc-dddd-eeee-ffffffffffff"
	s := testSkill("versioned-skill", "published")
	s.ActiveVersionID = &versionID
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("versioned-skill", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)
	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	require.NoError(t, err)
	for _, f := range zr.File {
		if f.Name != "manifest.json" {
			continue
		}
		rc, _ := f.Open()
		buf := new(bytes.Buffer)
		buf.ReadFrom(rc)
		rc.Close()
		var m skillManifest
		require.NoError(t, json.Unmarshal(buf.Bytes(), &m))
		require.NotNil(t, m.SkillVersionID)
		assert.Equal(t, versionID, *m.SkillVersionID)
	}
}

// TestDownloadSkillPackage_NotFound verifies that a non-existent skill returns 404.
func TestDownloadSkillPackage_NotFound(t *testing.T) {
	SetDB(testDownloadDB(t))

	c, w := testDownloadCtx("ghost-skill", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"SKILL_NOT_FOUND"`)
}

// TestDownloadSkillPackage_NonPublishedReturns404 verifies that draft, archived,
// and deprecated skills are not downloadable (handler query matches published only).
func TestDownloadSkillPackage_NonPublishedReturns404(t *testing.T) {
	for _, status := range []string{"draft", "archived", "deprecated"} {
		t.Run("status="+status, func(t *testing.T) {
			db := testDownloadDB(t)
			SetDB(db)
			require.NoError(t, db.Create(ptr(testSkill("hidden-"+status, status))).Error)

			c, w := testDownloadCtx("hidden-"+status, 1, "default")
			DownloadSkillPackage(c)

			require.Equal(t, http.StatusNotFound, w.Code)
			assert.Contains(t, w.Body.String(), `"code":"SKILL_NOT_FOUND"`)
		})
	}
}

// TestDownloadSkillPackage_PlanRequired verifies that a free user cannot download
// a pro skill: 403 SKILL_PLAN_REQUIRED.
func TestDownloadSkillPackage_PlanRequired(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("pro-skill", "published")
	s.RequiredPlan = enums.RequiredPlanPro
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("pro-skill", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusForbidden, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"SKILL_PLAN_REQUIRED"`)
}

// TestDownloadSkillPackage_ProUserCanDownloadProSkill verifies that a pro user
// can download a pro skill.
func TestDownloadSkillPackage_ProUserCanDownloadProSkill(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("pro-only", "published")
	s.RequiredPlan = enums.RequiredPlanPro
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("pro-only", 7, "pro")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/zip", w.Header().Get("Content-Type"))
}

// TestDownloadSkillPackage_EnterpriseUserCanDownloadProSkill verifies that
// enterprise satisfies the pro requirement (hierarchy: enterprise > pro > free).
func TestDownloadSkillPackage_EnterpriseUserCanDownloadProSkill(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("pro-skill-2", "published")
	s.RequiredPlan = enums.RequiredPlanPro
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("pro-skill-2", 8, "enterprise")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)
}

// TestDownloadSkillPackage_LookupByUUID verifies that the :id path parameter
// accepts a UUID as well as a slug.
func TestDownloadSkillPackage_LookupByUUID(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("uuid-lookup", "published")
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx(s.ID, 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Disposition"), "uuid-lookup.zip")
}

// TestDownloadSkillPackage_NoProviderCredentialsInZip verifies that no provider
// credential or server-internal fields appear in any file inside the zip.
// Checks each zip entry individually (not raw bytes) to avoid false negatives
// from zip metadata coincidentally containing the field names.
func TestDownloadSkillPackage_NoProviderCredentialsInZip(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	require.NoError(t, db.Create(ptr(testSkill("clean-skill", "published"))).Error)

	c, w := testDownloadCtx("clean-skill", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	require.NoError(t, err)

	forbidden := []string{"price_markup", "monetization_type", "model_whitelist", "instruction_template"}
	for _, f := range zr.File {
		rc, err := f.Open()
		require.NoError(t, err)
		buf := new(bytes.Buffer)
		buf.ReadFrom(rc)
		rc.Close()
		content := buf.String()
		for _, field := range forbidden {
			assert.NotContains(t, content, field,
				"file %s must not expose provider-internal field %q", f.Name, field)
		}
	}
}

// TestDownloadSkillPackage_EmitsSkillEnabledEvent verifies that a successful download
// writes a skill_enabled event to skill_usage_events with the correct entry_point,
// event_type, user_id, and skill_id.
func TestDownloadSkillPackage_EmitsSkillEnabledEvent(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("emit-skill", "published")
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("emit-skill", 99, "default")
	start := time.Now().UTC()
	DownloadSkillPackage(c)
	end := time.Now().UTC()

	require.Equal(t, http.StatusOK, w.Code)

	var evt skillmodel.SkillUsageEvent
	err := db.Where("event_type = ? AND skill_id = ?", enums.SkillUsageEventTypeEnabled, s.ID).First(&evt).Error
	require.NoError(t, err, "skill_usage_events must have a skill_enabled row after download")
	assert.Equal(t, enums.SkillUsageEventTypeEnabled, evt.EventType)
	assert.Equal(t, enums.EntryPointSkillPackage, evt.EntryPoint)
	assert.NotZero(t, evt.OccurredAt)
	assert.False(t, evt.OccurredAt.Before(start.Add(-time.Second)), "occurred_at must be near the download request")
	assert.False(t, evt.OccurredAt.After(end.Add(time.Second)), "occurred_at must be near the download request")
	_, err = uuid.Parse(evt.EventID)
	require.NoError(t, err, "event_id must be a valid UUID")
	require.NotNil(t, evt.UserID)
	assert.Equal(t, int64(99), *evt.UserID)
	require.NotNil(t, evt.Plan)
	assert.Equal(t, enums.RequiredPlanFree, *evt.Plan)
	require.NotNil(t, evt.Success)
	assert.True(t, *evt.Success)
}

func TestDownloadSkillPackage_KidsSessionEventUsesPseudoID(t *testing.T) {
	t.Setenv(kidsAnalyticsDailySaltEnv, "test-daily-salt")
	t.Setenv(kidsAnalyticsSaltVersionEnv, "2026-06-21")

	db := testDownloadDB(t)
	require.NoError(t, db.AutoMigrate(&appmodel.User{}))
	SetDB(db)
	s := testSkill("kids-emit-skill", "published")
	s.IsKidsSafe = true
	require.NoError(t, db.Create(&s).Error)
	require.NoError(t, db.Create(&appmodel.User{Id: 123, Username: "kids-user", Password: "password123", KidsMode: true}).Error)

	c, w := testDownloadCtx("kids-emit-skill", 123, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	var evt skillmodel.SkillUsageEvent
	err := db.Where("event_type = ? AND skill_id = ?", enums.SkillUsageEventTypeEnabled, s.ID).First(&evt).Error
	require.NoError(t, err)
	assert.True(t, evt.IsKidsSession)
	assert.Nil(t, evt.UserID, "Kids analytics must not persist the real child user_id")
	assert.Nil(t, evt.TenantID, "Kids analytics must not persist the real child tenant_id (V1: tenant_id == user_id)")
	require.NotNil(t, evt.SessionID)
	wantPseudoID, err := skillmodel.KidsSessionPseudoID(123, 123, "2026-06-21", []byte("test-daily-salt"))
	require.NoError(t, err)
	assert.Equal(t, wantPseudoID, *evt.SessionID)
	require.NotNil(t, evt.IsKidsSafeSkill)
	assert.True(t, *evt.IsKidsSafeSkill)
}

func TestDownloadSkillPackage_KidsSessionMissingSaltDoesNotPersistAnalytics(t *testing.T) {
	db := testDownloadDB(t)
	require.NoError(t, db.AutoMigrate(&appmodel.User{}))
	SetDB(db)
	s := testSkill("kids-no-salt-skill", "published")
	s.IsKidsSafe = true
	require.NoError(t, db.Create(&s).Error)
	require.NoError(t, db.Create(&appmodel.User{Id: 124, Username: "kids-nosalt", Password: "password123", KidsMode: true}).Error)

	c, w := testDownloadCtx("kids-no-salt-skill", 124, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code, "analytics failure must not block download")
	var evtCount int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND skill_id = ?", enums.SkillUsageEventTypeEnabled, s.ID).Count(&evtCount).Error)
	assert.Equal(t, int64(0), evtCount, "Kids analytics must fail closed when pseudonymization salt is unavailable")
}

// TestDownloadSkillPackage_EmitRecordsUserPlanNotSkillPlan verifies that when a pro user
// downloads a free skill, the analytics event.plan reflects the user's plan ("pro"),
// not the skill's required_plan ("free"). Prevents dashboard funnel distortion.
func TestDownloadSkillPackage_EmitRecordsUserPlanNotSkillPlan(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("free-skill-for-pro", "published")
	// s.RequiredPlan is "free" by default from testSkill
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("free-skill-for-pro", 55, "pro")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	var evt skillmodel.SkillUsageEvent
	err := db.Where("event_type = ? AND skill_id = ?", enums.SkillUsageEventTypeEnabled, s.ID).First(&evt).Error
	require.NoError(t, err)
	require.NotNil(t, evt.Plan)
	assert.Equal(t, enums.RequiredPlanPro, *evt.Plan,
		"analytics event.plan must be the user's plan, not the skill's required_plan")
}

// TestDownloadSkillPackage_GrantsNoExecutionRight is the DR-55 download-side proof
// for acceptance 2: a download writes a download/enablement state record only and
// does NOT issue any standalone runtime execution grant. Runtime rejection without
// a valid runner key + entitlement is enforced per call by DR-64/DR-68/M05 and is
// out of DR-55 scope.
//
// Goal of the negative assertion = "no execution-grant artifact is issued", NOT
// "the whole system writes only two tables". The test DB intentionally migrates
// only skills + user_enabled_skills + skill_usage_events; there is no runtime-grant
// / runner-token / entitlement-override / credential table in this schema, so we
// make targeted assertions rather than a cross-DB side-effect proof.
func TestDownloadSkillPackage_GrantsNoExecutionRight(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("ds-noexec", "published")
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("ds-noexec", 77, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	// (a) Exactly one enablement record for (user, skill), enabled, source=skill_package.
	var uesCount int64
	require.NoError(t, db.Model(&skillmodel.UserEnabledSkill{}).
		Where("user_id = ? AND skill_id = ?", 77, s.ID).Count(&uesCount).Error)
	assert.Equal(t, int64(1), uesCount, "download must write exactly one enablement row")
	var ues skillmodel.UserEnabledSkill
	require.NoError(t, db.Where("user_id = ? AND skill_id = ?", 77, s.ID).First(&ues).Error)
	assert.True(t, ues.Enabled)
	assert.Equal(t, "skill_package", ues.Source)

	// (b) Exactly one analytics event, and it is the canonical skill_enabled (DR-55 D-7),
	// not a separate skill_downloaded event.
	var enabledCount, downloadedCount int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND skill_id = ?", enums.SkillUsageEventTypeEnabled, s.ID).Count(&enabledCount).Error)
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND skill_id = ?", "skill_downloaded", s.ID).Count(&downloadedCount).Error)
	assert.Equal(t, int64(1), enabledCount, "download must emit exactly one skill_enabled event")
	assert.Equal(t, int64(0), downloadedCount, "skill_downloaded is not a separate V1 event (DR-55 D-7)")

	// (c) No execution-grant artifact in the structured outputs. Structured checks, NOT a
	// free-text blacklist scan of SKILL.md (which is author-controlled prose and would
	// false-positive on legitimate words):
	//   - response carries no auth/credential header,
	//   - the zip contains only whitelisted files,
	//   - manifest.json carries only allowlisted keys (no grant/token/credential/entitlement field).
	assert.Empty(t, w.Header().Get("Authorization"), "response must not carry an Authorization header")
	assert.Empty(t, w.Header().Get("Set-Cookie"), "response must not set a credential cookie")

	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	require.NoError(t, err)
	allowedFiles := map[string]bool{"manifest.json": true, "SKILL.md": true}
	var manifestRaw []byte
	for _, zf := range zr.File {
		assert.True(t, allowedFiles[zf.Name], "zip must contain only whitelisted files, found %q", zf.Name)
		if zf.Name == "manifest.json" {
			rc, err := zf.Open()
			require.NoError(t, err)
			buf := new(bytes.Buffer)
			buf.ReadFrom(rc)
			rc.Close()
			manifestRaw = buf.Bytes()
		}
	}
	require.NotNil(t, manifestRaw, "manifest.json must be present")

	var manifestKeys map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(manifestRaw, &manifestKeys))
	allowedKeys := map[string]bool{
		"schema_version": true, "skill_id": true, "skill_version_id": true,
		"slug": true, "name": true, "required_plan": true, "category": true,
		"requires_deeprouter_key": true,
	}
	for k := range manifestKeys {
		assert.Truef(t, allowedKeys[k], "manifest carries unexpected key %q (possible execution-grant artifact)", k)
	}
	for _, k := range []string{"grant", "token", "credential", "entitlement", "runner_token", "entitlement_override"} {
		_, present := manifestKeys[k]
		assert.Falsef(t, present, "manifest must not carry an execution-grant key %q", k)
	}

	// (d) The download path creates no other persistent state in this schema: skills is
	// unchanged (no new row), so the only writes are the enablement record (a) and the
	// analytics event (b). There is no runtime-grant/credential table to write to by design.
	var skillCount int64
	require.NoError(t, db.Model(&skillmodel.Skill{}).Count(&skillCount).Error)
	assert.Equal(t, int64(1), skillCount, "download must not create additional skill rows")
}

// TestDownloadSkillPackage_ReDownloadPreservesExistingSource documents the boundary for a
// pre-existing enablement row: download re-enables it but does NOT overwrite source.
// This matches the deliberate EnableSkillForUser contract ("source is NOT overwritten on
// re-enable", locked by TestEnableSkillForUser_Reenable_PreservesOriginalSource[_MySQL]).
// Only a *fresh* download-created row gets source=skill_package (see other tests). The
// download act itself is still recorded by the enabled_at update + the skill_enabled event.
func TestDownloadSkillPackage_ReDownloadPreservesExistingSource(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("redl-skill", "published")
	require.NoError(t, db.Create(&s).Error)

	// Pre-existing row from an earlier acquisition: source="marketplace", currently disabled.
	past := time.Now().UTC().Add(-24 * time.Hour)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID: 88, TenantID: 88, SkillID: s.ID,
		Enabled: false, EnabledAt: past, DisabledAt: &past, Source: "marketplace",
	}).Error)

	c, w := testDownloadCtx("redl-skill", 88, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	// Still exactly one row; re-enabled; disabled_at cleared; source PRESERVED (not skill_package).
	var rows int64
	require.NoError(t, db.Model(&skillmodel.UserEnabledSkill{}).
		Where("user_id = ? AND skill_id = ?", 88, s.ID).Count(&rows).Error)
	assert.Equal(t, int64(1), rows, "re-download must not create a duplicate enablement row")

	var ues skillmodel.UserEnabledSkill
	require.NoError(t, db.Where("user_id = ? AND skill_id = ?", 88, s.ID).First(&ues).Error)
	assert.True(t, ues.Enabled, "re-download must re-enable the row")
	assert.Nil(t, ues.DisabledAt, "re-download must clear disabled_at")
	assert.Equal(t, "marketplace", ues.Source,
		"existing row's source must be preserved (EnableSkillForUser does not overwrite source)")

	// The download act is still recorded by a skill_enabled event.
	var evtCount int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND skill_id = ?", enums.SkillUsageEventTypeEnabled, s.ID).Count(&evtCount).Error)
	assert.Equal(t, int64(1), evtCount, "re-download must still emit skill_enabled")
}
