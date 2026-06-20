package handler

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
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

	// UES row must be upserted with source=skill_package on download.
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
	assert.Contains(t, skillMD, "Zip Skill")
	assert.Contains(t, skillMD, "A full description.")
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
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)

	var evt skillmodel.SkillUsageEvent
	err := db.Where("event_type = ? AND skill_id = ?", "skill_enabled", s.ID).First(&evt).Error
	require.NoError(t, err, "skill_usage_events must have a skill_enabled row after download")
	assert.Equal(t, "skill_package", evt.EntryPoint)
	require.NotNil(t, evt.UserID)
	assert.Equal(t, int64(99), *evt.UserID)
	require.NotNil(t, evt.Plan)
	assert.Equal(t, "free", *evt.Plan)
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
	err := db.Where("event_type = ? AND skill_id = ?", "skill_enabled", s.ID).First(&evt).Error
	require.NoError(t, err)
	require.NotNil(t, evt.Plan)
	assert.Equal(t, "pro", *evt.Plan,
		"analytics event.plan must be the user's plan, not the skill's required_plan")
}
