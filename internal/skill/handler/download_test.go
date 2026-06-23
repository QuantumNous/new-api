package handler

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
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
	require.NoError(t, skillmodel.MigrateSkillVersions(db))
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
	createPublishedSkillWithActiveVersion(t, db, "cool-skill", "Use the cool skill safely.")

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
	s = createPublishedSkillWithActiveVersionFromSkill(t, db, s, "System template for zip skill.")

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
	require.Contains(t, files, "instruction_template.md", "zip must contain instruction_template.md")
	require.Contains(t, files, "runtime/deeprouter_skill_runner.py", "zip must contain runtime client")
	require.Contains(t, files, "runtime/README.md", "zip must contain runtime README")

	var m skillManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	assert.Equal(t, "1.0", m.SchemaVersion)
	assert.Equal(t, "zip-skill", m.Slug)
	assert.Equal(t, "Zip Skill", m.Name)
	assert.True(t, m.RequiresDeepRouterKey, "manifest must advertise requires_deeprouter_key: true")
	assert.NotEmpty(t, m.SkillVersionID, "skill_version_id must be present in runnable packages")

	skillMD := string(files["SKILL.md"])
	assert.Contains(t, skillMD, "name: zip-skill")
	assert.Contains(t, skillMD, "Zip Skill")
	assert.Contains(t, skillMD, "A full description.")
	assert.Equal(t, "System template for zip skill.", string(files["instruction_template.md"]))
	assert.Contains(t, skillMD, "### Work Step")
	assert.Contains(t, skillMD, "https://api.deeprouter.co/v1/routing/chat/completions")
}

func TestDownloadSkillPackage_SKILLMDIsRuntimeWrapper(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("wrapper-skill", "published")
	s.Name = "Wrapper Skill"
	s.Description = "Wrapper description."
	s.ShortDescription = "Wrapper short description"
	s = createPublishedSkillWithActiveVersionFromSkill(t, db, s, "Wrapper template")

	c, w := testDownloadCtx("wrapper-skill", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	require.NoError(t, err)

	var skillMD string
	for _, f := range zr.File {
		if f.Name != "SKILL.md" {
			continue
		}
		rc, err := f.Open()
		require.NoError(t, err)
		body, err := io.ReadAll(rc)
		rc.Close()
		require.NoError(t, err)
		skillMD = string(body)
	}

	require.NotEmpty(t, skillMD)
	assert.Contains(t, skillMD, "runtime/deeprouter_skill_runner.py")
	assert.Contains(t, skillMD, "DEEPROUTER_API_KEY")
	assert.Contains(t, skillMD, "DEEPROUTER_EXECUTION_API_URL")
	assert.Contains(t, skillMD, "DeepRouter")
	assert.Contains(t, skillMD, "Do not execute this package as a standalone local-only prompt")
	assert.Contains(t, skillMD, "### Work Step")
	assert.Contains(t, skillMD, "https://api.deeprouter.co/v1/routing/chat/completions")
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
	require.NoError(t, db.Create(&skillmodel.SkillVersion{
		ID:                        versionID,
		SkillID:                   s.ID,
		VersionNumber:             1,
		Status:                    enums.SkillVersionStatusActive,
		InstructionTemplate:       "Pinned template",
		InstructionTemplateSHA256: strings.Repeat("a", 64),
		ModelWhitelistSnapshot:    skillmodel.SkillJSONB(`["smart-tier"]`),
		RequiredPlanSnapshot:      enums.RequiredPlanFree,
		MonetizationSnapshot:      skillmodel.SkillJSONB(`{}`),
		RolloutPercentage:         100,
		CreatedBy:                 1,
	}).Error)

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
		assert.Equal(t, versionID, m.SkillVersionID)
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
	s = createPublishedSkillWithActiveVersionFromSkill(t, db, s, "Pro template")

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
	s = createPublishedSkillWithActiveVersionFromSkill(t, db, s, "Enterprise template")

	c, w := testDownloadCtx("pro-skill-2", 8, "enterprise")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)
}

// TestDownloadSkillPackage_LookupByUUID verifies that the :id path parameter
// accepts a UUID as well as a slug.
func TestDownloadSkillPackage_LookupByUUID(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := createPublishedSkillWithActiveVersion(t, db, "uuid-lookup", "UUID lookup template")

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
	createPublishedSkillWithActiveVersion(t, db, "clean-skill", "Template without secrets")

	c, w := testDownloadCtx("clean-skill", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	require.NoError(t, err)

	allowedFiles := map[string]bool{
		"manifest.json":                      true,
		"SKILL.md":                           true,
		"instruction_template.md":            true,
		"runtime/deeprouter_skill_runner.py": true,
		"runtime/README.md":                  true,
	}
	forbiddenSecretLike := []string{"OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY"}
	for _, f := range zr.File {
		assert.True(t, allowedFiles[f.Name], "zip must contain only allowlisted files, found %q", f.Name)
		rc, err := f.Open()
		require.NoError(t, err)
		buf := new(bytes.Buffer)
		buf.ReadFrom(rc)
		rc.Close()
		content := buf.String()
		for _, field := range forbiddenSecretLike {
			assert.NotContains(t, content, field,
				"file %s must not expose provider-secret-like key %q", f.Name, field)
		}
		if f.Name == "manifest.json" {
			var manifestKeys map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(buf.Bytes(), &manifestKeys))
			for _, forbidden := range []string{"billing_user_id", "tenant_id", "user_id", "kids_mode", "is_kids_session"} {
				_, present := manifestKeys[forbidden]
				assert.False(t, present, "manifest must not contain forbidden field %q", forbidden)
			}
		}
	}
}

// TestDownloadSkillPackage_EmitsSkillEnabledEvent verifies that a successful download
// writes a skill_enabled event to skill_usage_events with the correct entry_point,
// event_type, user_id, and skill_id.
func TestDownloadSkillPackage_EmitsSkillEnabledEvent(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := createPublishedSkillWithActiveVersion(t, db, "emit-skill", "Emit template")

	c, w := testDownloadCtx("emit-skill", 99, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	var evt skillmodel.SkillUsageEvent
	err := db.Where("event_type = ? AND skill_id = ?", "skill_enabled", s.ID).First(&evt).Error
	require.NoError(t, err, "skill_usage_events must have a skill_enabled row after download")
	assert.Equal(t, enums.EntryPointSkillPackage, evt.EntryPoint)
	require.NotNil(t, evt.UserID)
	assert.Equal(t, int64(99), *evt.UserID)
	require.NotNil(t, evt.Plan)
	assert.Equal(t, enums.RequiredPlanFree, *evt.Plan)
}

func TestDownloadSkillPackage_RecommendedEntryPoint(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := createPublishedSkillWithActiveVersion(t, db, "recommended-download", "Recommended template")

	c, w := testDownloadCtx("recommended-download", 99, "default")
	c.Request.URL.RawQuery = "entry_point=recommended"
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	var evt skillmodel.SkillUsageEvent
	err := db.Where("event_type = ? AND skill_id = ?", "skill_enabled", s.ID).First(&evt).Error
	require.NoError(t, err)
	assert.Equal(t, enums.EntryPointRecommended, evt.EntryPoint)
}

// TestDownloadSkillPackage_EmitRecordsUserPlanNotSkillPlan verifies that when a pro user
// downloads a free skill, the analytics event.plan reflects the user's plan ("pro"),
// not the skill's required_plan ("free"). Prevents dashboard funnel distortion.
func TestDownloadSkillPackage_EmitRecordsUserPlanNotSkillPlan(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := createPublishedSkillWithActiveVersion(t, db, "free-skill-for-pro", "Free template")

	c, w := testDownloadCtx("free-skill-for-pro", 55, "pro")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	var evt skillmodel.SkillUsageEvent
	err := db.Where("event_type = ? AND skill_id = ?", "skill_enabled", s.ID).First(&evt).Error
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
	s := createPublishedSkillWithActiveVersion(t, db, "ds-noexec", "No exec grant template")

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
		Where("event_type = ? AND skill_id = ?", "skill_enabled", s.ID).Count(&enabledCount).Error)
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
	allowedFiles := map[string]bool{
		"manifest.json":                      true,
		"SKILL.md":                           true,
		"instruction_template.md":            true,
		"runtime/deeprouter_skill_runner.py": true,
		"runtime/README.md":                  true,
	}
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
	s := createPublishedSkillWithActiveVersion(t, db, "redl-skill", "Re-download template")

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
		Where("event_type = ? AND skill_id = ?", "skill_enabled", s.ID).Count(&evtCount).Error)
	assert.Equal(t, int64(1), evtCount, "re-download must still emit skill_enabled")
}

func TestDownloadSkillPackage_NoActiveVersionBuildFails(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := testSkill("no-active-version", "published")
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("no-active-version", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"SKILL_INTERNAL_ERROR"`)
	assert.NotEqual(t, "application/zip", w.Header().Get("Content-Type"))
	assertNoDownloadSideEffects(t, db, s.ID, 1)
}

func TestDownloadSkillPackage_ActiveVersionRecordMissingBuildFails(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	versionID := uuid.New().String()
	s := testSkill("missing-version-record", "published")
	s.ActiveVersionID = &versionID
	require.NoError(t, db.Create(&s).Error)

	c, w := testDownloadCtx("missing-version-record", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"SKILL_INTERNAL_ERROR"`)
	assert.NotEqual(t, "application/zip", w.Header().Get("Content-Type"))
	assertNoDownloadSideEffects(t, db, s.ID, 1)
}

func TestDownloadSkillPackage_NonActiveVersionBuildFails(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	versionID := uuid.New().String()
	s := testSkill("non-active-version", "published")
	s.ActiveVersionID = &versionID
	require.NoError(t, db.Create(&s).Error)
	require.NoError(t, db.Create(&skillmodel.SkillVersion{
		ID:                        versionID,
		SkillID:                   s.ID,
		VersionNumber:             1,
		Status:                    enums.SkillVersionStatusDraft,
		InstructionTemplate:       "Draft template",
		InstructionTemplateSHA256: strings.Repeat("a", 64),
		ModelWhitelistSnapshot:    skillmodel.SkillJSONB(`["smart-tier"]`),
		RequiredPlanSnapshot:      enums.RequiredPlanFree,
		MonetizationSnapshot:      skillmodel.SkillJSONB(`{}`),
		RolloutPercentage:         100,
		CreatedBy:                 1,
	}).Error)

	c, w := testDownloadCtx("non-active-version", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"SKILL_INTERNAL_ERROR"`)
	assert.NotEqual(t, "application/zip", w.Header().Get("Content-Type"))
	assertNoDownloadSideEffects(t, db, s.ID, 1)
}

func TestDownloadSkillPackage_EmptyInstructionTemplateBuildFails(t *testing.T) {
	db := testDownloadDB(t)
	SetDB(db)
	s := createPublishedSkillWithActiveVersion(t, db, "empty-template", "")

	c, w := testDownloadCtx("empty-template", 1, "default")
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), `"code":"SKILL_INTERNAL_ERROR"`)
	assert.NotEqual(t, "application/zip", w.Header().Get("Content-Type"))
	assertNoDownloadSideEffects(t, db, s.ID, 1)

	// ensure the failure is from package building, not lookup/auth/plan gating
	var fetched skillmodel.Skill
	require.NoError(t, db.Where("id = ?", s.ID).First(&fetched).Error)
	assert.NotNil(t, fetched.ActiveVersionID)
}

func TestDownloadedPackageRunner_MissingKeyFailsBeforeHTTP(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-missing-key", "Runtime template")

	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"text":"unexpected"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-missing-key", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(), "DEEPROUTER_EXECUTION_API_URL="+server.URL)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	t.Logf("runner out: %s", string(out))
	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "AUTH_REQUIRED", errPayload["code"])
	assert.Equal(t, "Register or add your API key.", errPayload["cta"])
	assert.Equal(t, int32(0), callCount.Load(), "missing key must fail before any HTTP call")
}

func TestDownloadedPackageRunner_MissingExecutionAPIURLFailsBeforeHTTP(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-missing-url", "Runtime template")

	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"text":"unexpected"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-missing-url", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(), "DEEPROUTER_API_KEY=test-runner-key")
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	t.Logf("runner out: %s", string(out))
	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "CONFIG_REQUIRED", errPayload["code"])
	assert.Equal(t, int32(0), callCount.Load(), "missing execution URL must fail before any HTTP call")
}

func TestDownloadedPackageRunner_MissingInstructionTemplateFailsBeforeHTTP(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-missing-template", "Runtime template")

	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"text":"unexpected"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-missing-template", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	require.NoError(t, os.Remove(filepath.Join(pkgDir, "instruction_template.md")))
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL="+server.URL,
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	t.Logf("runner out: %s", string(out))
	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "PACKAGE_INVALID", errPayload["code"])
	assert.Equal(t, int32(0), callCount.Load(), "missing instruction_template.md must fail before any HTTP call")
}

func TestDownloadedPackageRunner_InvalidManifestJSONFailsBeforeHTTP(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-invalid-manifest-json", "Runtime template")

	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"text":"unexpected"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-invalid-manifest-json", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	writeManifestRaw(t, pkgDir, []byte(`{"broken":`))
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL="+server.URL,
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)

	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "PACKAGE_INVALID", errPayload["code"])
	assert.NotContains(t, string(out), "Traceback")
	assert.Equal(t, int32(0), callCount.Load(), "invalid manifest JSON must fail before any HTTP call")
}

func TestDownloadedPackageRunner_InvalidManifestUTF8FailsBeforeHTTP(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-invalid-manifest-utf8", "Runtime template")

	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"text":"unexpected"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-invalid-manifest-utf8", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	writeManifestRaw(t, pkgDir, []byte{0xff, 0xfe, 0xfd})
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL="+server.URL,
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)

	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "PACKAGE_INVALID", errPayload["code"])
	assert.NotContains(t, string(out), "Traceback")
	assert.Equal(t, int32(0), callCount.Load(), "invalid manifest UTF-8 must fail before any HTTP call")
}

func TestDownloadedPackageRunner_ManifestRootMustBeObject(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-manifest-root-array", "Runtime template")

	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"text":"unexpected"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-manifest-root-array", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	writeManifestRaw(t, pkgDir, []byte(`[]`))
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL="+server.URL,
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)

	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "PACKAGE_INVALID", errPayload["code"])
	assert.NotContains(t, string(out), "Traceback")
	assert.Equal(t, int32(0), callCount.Load(), "non-object manifest root must fail before any HTTP call")
}

func TestDownloadedPackageRunner_InvalidExecutionAPIURLFailsFast(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-invalid-url", "Runtime template")

	c, w := testDownloadCtx("runner-invalid-url", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL=not-a-url",
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	t.Logf("runner out: %s", string(out))
	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "CONFIG_INVALID", errPayload["code"])
}

func TestDownloadedPackageRunner_InvalidTimeoutEnvFailsFast(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-invalid-timeout", "Runtime template")

	c, w := testDownloadCtx("runner-invalid-timeout", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL=http://127.0.0.1:1/mock",
		"DEEPROUTER_EXECUTION_TIMEOUT_SECONDS=abc",
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	t.Logf("runner out: %s", string(out))
	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "CONFIG_INVALID", errPayload["code"])
}

func TestDownloadedPackageRunner_TamperedManifestForbiddenFieldFailsBeforeHTTP(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-tampered-manifest", "Runtime template")

	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"text":"unexpected"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-tampered-manifest", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	tamperManifestJSON(t, pkgDir, func(manifest map[string]any) {
		manifest["user_id"] = 123
	})
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL="+server.URL,
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	t.Logf("runner out: %s", string(out))
	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "PACKAGE_INVALID", errPayload["code"])
	assert.Equal(t, int32(0), callCount.Load(), "tampered forbidden manifest field must fail before any HTTP call")
}

func TestDownloadedPackageRunner_TamperedManifestRequiresDeepRouterKeyFalseFailsBeforeHTTP(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-tampered-key-flag", "Runtime template")

	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"text":"unexpected"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-tampered-key-flag", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	tamperManifestJSON(t, pkgDir, func(manifest map[string]any) {
		manifest["requires_deeprouter_key"] = false
	})
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL="+server.URL,
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	t.Logf("runner out: %s", string(out))
	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "PACKAGE_INVALID", errPayload["code"])
	assert.Equal(t, int32(0), callCount.Load(), "tampered requires_deeprouter_key flag must fail before any HTTP call")
}

func TestDownloadedPackageRunner_MockSuccessFromExtractedZip(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-success", "Runtime template")

	var authHeader, requestBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		body, _ := io.ReadAll(r.Body)
		requestBody = string(body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"text":"mock success"}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-success", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL="+server.URL,
	)
	out, err := cmd.CombinedOutput()
	require.NoError(t, err, string(out))
	assert.Equal(t, "Bearer test-runner-key", authHeader)
	assert.Equal(t, "mock success", strings.TrimSpace(string(out)))
	assert.Contains(t, requestBody, `"messages"`)
	assert.Contains(t, requestBody, `"skill_id"`)
	assert.Contains(t, requestBody, `"skill_version_id"`)
	assert.NotContains(t, requestBody, `"user_id"`)
	assert.NotContains(t, requestBody, `"tenant_id"`)
	assert.NotContains(t, requestBody, `"kids_mode"`)
	assert.NotContains(t, requestBody, `"is_kids_session"`)
	assert.NotContains(t, requestBody, "instruction_template")
}

func TestDownloadedPackageRunner_MockAuthRequiredErrorMapping(t *testing.T) {
	python := requirePython(t)
	db := testDownloadDB(t)
	SetDB(db)
	createPublishedSkillWithActiveVersion(t, db, "runner-auth-error", "Runtime template")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"error":{"code":"AUTH_REQUIRED","message":"Need key","cta":"Register or add your API key."}}`)
	}))
	defer server.Close()

	c, w := testDownloadCtx("runner-auth-error", 1, "default")
	DownloadSkillPackage(c)
	require.Equal(t, http.StatusOK, w.Code)

	pkgDir := unzipPackageToTempDir(t, w.Body.Bytes())
	script := filepath.Join(pkgDir, "runtime", "deeprouter_skill_runner.py")
	cmd := exec.Command(python, script, "--input", "hello")
	cmd.Dir = filepath.Join(pkgDir, "runtime")
	cmd.Env = append(os.Environ(),
		"DEEPROUTER_API_KEY=test-runner-key",
		"DEEPROUTER_EXECUTION_API_URL="+server.URL,
	)
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	t.Logf("runner out: %s", string(out))
	var errPayload map[string]string
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(out), &errPayload))
	assert.Equal(t, "AUTH_REQUIRED", errPayload["code"])
	assert.Equal(t, "Register or add your API key.", errPayload["cta"])
	assert.NotContains(t, string(out), "test-runner-key")
}

func TestBuildSkillPackageZip_RejectsOfflineCapabilityWorkStep(t *testing.T) {
	_, err := buildSkillPackageZip(skillPackageKindCapability, []skillPackageFile{
		{Name: "manifest.json", Content: []byte(`{"schema_version":"1.0"}`)},
		{Name: "SKILL.md", Content: []byte(`# Offline Skill

### Work Step

Read the local files, summarize them, and produce the final answer without any network call.
`)},
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "D-09")
	assert.Contains(t, err.Error(), "no DeepRouter public routing API call")
}

func TestBuildSkillPackageZip_AllowsDeepRouterCapabilityWorkStep(t *testing.T) {
	zipBytes, err := buildSkillPackageZip(skillPackageKindCapability, []skillPackageFile{
		{Name: "manifest.json", Content: []byte(`{"schema_version":"1.0"}`)},
		{Name: "SKILL.md", Content: []byte(`# Routed Skill

### Work Step

Call DeepRouter at POST https://api.deeprouter.co/v1/routing/chat/completions with the runner's own key, then base the final answer on the routed response.
`)},
	})

	require.NoError(t, err)
	assert.NotEmpty(t, zipBytes)
}

func TestValidateSkillPackageRuntimeDependency_Regressions(t *testing.T) {
	cases := []struct {
		name    string
		kind    skillPackageKind
		skillMD string
		wantErr string
	}{
		{
			name: "deeprouter marker outside work step is rejected",
			kind: skillPackageKindCapability,
			skillMD: `# Misleading Skill

Mentions https://api.deeprouter.co/v1/chat/completions in setup text.

### Work Step

Summarize local files without making any network call.
`,
			wantErr: "no DeepRouter public routing API call",
		},
		{
			name: "missing work step is rejected",
			kind: skillPackageKindCapability,
			skillMD: `# No Work Step

Call DeepRouter at https://api.deeprouter.co/v1/chat/completions somewhere in prose.
`,
			wantErr: "no DeepRouter public routing API call",
		},
		{
			name:    "empty skill md is rejected",
			kind:    skillPackageKindCapability,
			skillMD: "  \n\t",
			wantErr: "missing SKILL.md work step",
		},
		{
			name: "non capability package skips guard",
			kind: skillPackageKind("reference"),
			skillMD: `# Reference Package

No runtime work step.
`,
			wantErr: "",
		},
		{
			name: "responses endpoint in work step is accepted",
			kind: skillPackageKindCapability,
			skillMD: `# Responses Skill

### Work Step

Call DeepRouter with POST https://api.deeprouter.co/v1/responses using the runner key.
`,
			wantErr: "",
		},
		{
			name: "routing chat completions endpoint in work step is accepted",
			kind: skillPackageKindCapability,
			skillMD: `# Routing Skill

### Work Step

Call DeepRouter with POST https://api.deeprouter.co/v1/routing/chat/completions using the runner key.
`,
			wantErr: "",
		},
		{
			name: "parenthetical work step heading is accepted",
			kind: skillPackageKindCapability,
			skillMD: `# D09 Skill

### Work Step (D-09)

Call DeepRouter with POST https://api.deeprouter.co/v1/chat/completions using the runner key.
`,
			wantErr: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateSkillPackageRuntimeDependency(tc.kind, []skillPackageFile{
				{Name: "SKILL.md", Content: []byte(tc.skillMD)},
			})
			if tc.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), "D-09")
			assert.Contains(t, err.Error(), tc.wantErr)
		})
	}
}

func TestValidateSkillPackageRuntimeDependency_RejectsMissingSkillMD(t *testing.T) {
	err := validateSkillPackageRuntimeDependency(skillPackageKindCapability, []skillPackageFile{
		{Name: "manifest.json", Content: []byte(`{"schema_version":"1.0"}`)},
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "D-09")
	assert.Contains(t, err.Error(), "missing SKILL.md work step")
}
func createPublishedSkillWithActiveVersion(t *testing.T, db *gorm.DB, slug string, template string) skillmodel.Skill {
	t.Helper()
	return createPublishedSkillWithActiveVersionFromSkill(t, db, testSkill(slug, "published"), template)
}

func createPublishedSkillWithActiveVersionFromSkill(t *testing.T, db *gorm.DB, s skillmodel.Skill, template string) skillmodel.Skill {
	t.Helper()
	versionID := uuid.New().String()
	s.ActiveVersionID = &versionID
	require.NoError(t, db.Create(&s).Error)
	require.NoError(t, db.Create(&skillmodel.SkillVersion{
		ID:                        versionID,
		SkillID:                   s.ID,
		VersionNumber:             1,
		Status:                    enums.SkillVersionStatusActive,
		InstructionTemplate:       template,
		InstructionTemplateSHA256: strings.Repeat("a", 64),
		ModelWhitelistSnapshot:    skillmodel.SkillJSONB(`["smart-tier"]`),
		RequiredPlanSnapshot:      s.RequiredPlan,
		MonetizationSnapshot:      skillmodel.SkillJSONB(`{}`),
		RolloutPercentage:         100,
		CreatedBy:                 1,
	}).Error)
	return s
}

func unzipPackageToTempDir(t *testing.T, zipBytes []byte) string {
	t.Helper()
	dir := t.TempDir()
	zr, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	require.NoError(t, err)
	for _, f := range zr.File {
		target := filepath.Join(dir, filepath.FromSlash(f.Name))
		require.NoError(t, os.MkdirAll(filepath.Dir(target), 0o755))
		rc, err := f.Open()
		require.NoError(t, err)
		data, err := io.ReadAll(rc)
		rc.Close()
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(target, data, 0o644))
	}
	return dir
}

func tamperManifestJSON(t *testing.T, pkgDir string, mutate func(manifest map[string]any)) {
	t.Helper()
	manifestPath := filepath.Join(pkgDir, "manifest.json")
	body, err := os.ReadFile(manifestPath)
	require.NoError(t, err)

	var manifest map[string]any
	require.NoError(t, json.Unmarshal(body, &manifest))
	mutate(manifest)

	updated, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(manifestPath, updated, 0o644))
}

func writeManifestRaw(t *testing.T, pkgDir string, body []byte) {
	t.Helper()
	manifestPath := filepath.Join(pkgDir, "manifest.json")
	require.NoError(t, os.WriteFile(manifestPath, body, 0o644))
}

func requirePython(t *testing.T) string {
	t.Helper()
	for _, name := range []string{"python3", "python"} {
		python, err := exec.LookPath(name)
		if err != nil {
			continue
		}
		versionOut, versionErr := exec.Command(python, "--version").CombinedOutput()
		if versionErr == nil && strings.HasPrefix(strings.TrimSpace(string(versionOut)), "Python 3.") {
			return python
		}
	}
	t.Skip("python3/python not found in PATH; skipping runtime client smoke test")
	return ""
}

func assertNoDownloadSideEffects(t *testing.T, db *gorm.DB, skillID string, userID int64) {
	t.Helper()

	var uesCount int64
	require.NoError(t, db.Model(&skillmodel.UserEnabledSkill{}).
		Where("user_id = ? AND skill_id = ?", userID, skillID).
		Count(&uesCount).Error)
	assert.Equal(t, int64(0), uesCount, "package build failure must not create enablement rows")

	var evtCount int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND skill_id = ?", "skill_enabled", skillID).
		Count(&evtCount).Error)
	assert.Equal(t, int64(0), evtCount, "package build failure must not emit skill_enabled")
}
