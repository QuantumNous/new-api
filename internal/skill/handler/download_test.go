package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/seed"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func downloadTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "dl.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, skillmodel.MigrateSkills(db))
	require.NoError(t, skillmodel.MigrateSkillVersions(db))
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

func downloadContext(slug string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/marketplace/skills/"+slug+"/download", nil)
	c.Params = gin.Params{{Key: "id", Value: slug}}
	return c, w
}

func TestDownloadSkillPackage_Success(t *testing.T) {
	db := downloadTestDB(t)
	SetDB(db)
	_, err := seed.SeedDemoSkills(db, 1)
	require.NoError(t, err)

	c, w := downloadContext("polished-writer")
	c.Set("id", 1) // authenticated user (set by SkillUserAuth in production)
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "application/zip", w.Header().Get("Content-Type"))
	require.Contains(t, w.Header().Get("Content-Disposition"), "polished-writer-v1.zip")
	body := w.Body.Bytes()
	require.GreaterOrEqual(t, len(body), 2)
	require.Equal(t, "PK", string(body[:2]), "body should be a zip archive")

	// Download recorded an entitlement row.
	var count int64
	db.Model(&skillmodel.UserEnabledSkill{}).Where("user_id = ? AND skill_id IS NOT NULL", 1).Count(&count)
	require.Equal(t, int64(1), count)
}

func TestDownloadSkillPackage_AuthRequired(t *testing.T) {
	db := downloadTestDB(t)
	SetDB(db)
	_, err := seed.SeedDemoSkills(db, 1)
	require.NoError(t, err)

	c, w := downloadContext("polished-writer")
	// No "id" set → unauthenticated.
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusUnauthorized, w.Code)
	var env struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &env))
	require.Equal(t, "AUTH_REQUIRED", env.Error.Code)
}

func TestDownloadSkillPackage_NotFound(t *testing.T) {
	db := downloadTestDB(t)
	SetDB(db)

	c, w := downloadContext("does-not-exist")
	c.Set("id", 1)
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusNotFound, w.Code)
}

func TestDownloadSkillPackage_DraftNotDownloadable(t *testing.T) {
	db := downloadTestDB(t)
	SetDB(db)
	// A draft skill (not published) must not be downloadable.
	require.NoError(t, db.Create(&skillmodel.Skill{
		Slug:                 "draft-only",
		Status:               enums.SkillStatusDraft,
		Category:             "writing",
		Name:                 "Draft Only",
		ShortDescription:     "s",
		Description:          "d",
		RequiredPlan:         enums.RequiredPlanFree,
		MonetizationType:     enums.MonetizationTypeFree,
		KidsApprovalStatus:   enums.KidsApprovalStatusNotRequired,
		AIDisclosureRequired: true,
		CreatedBy:            1,
	}).Error)

	c, w := downloadContext("draft-only")
	c.Set("id", 1)
	DownloadSkillPackage(c)

	require.Equal(t, http.StatusNotFound, w.Code)
}
