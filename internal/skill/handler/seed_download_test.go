package handler

import (
	"archive/zip"
	"bytes"
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/seed"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// seededDownloadDB uses a file-based SQLite DB (not :memory:) because the seeder
// runs inside a transaction; a file DB guarantees migrated tables are visible on
// the transaction's connection. Migrates the full set the download path touches.
func seededDownloadDB(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "seed_dl.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, skillmodel.MigrateSkills(db))
	require.NoError(t, skillmodel.MigrateSkillVersions(db))
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	require.NoError(t, skillmodel.MigrateSkillPurchases(db))
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(db))
	t.Cleanup(func() {
		if sq, err := db.DB(); err == nil {
			sq.Close()
		}
	})
	return db
}

// TestDownloadSkillPackage_SeededDemoSkills is the DR-51 "downloadable" acceptance:
// each seeded demo Skill must download end-to-end through main's DR-81 handler,
// which means passing main's D-09 runtime-dependency guard
// (validateSkillPackageRuntimeDependency) — a capability package whose SKILL.md
// has a "## Work step" calling the DeepRouter routing API. This is the integration
// proof that the seeder's Work-step Description survives main's packager.
func TestDownloadSkillPackage_SeededDemoSkills(t *testing.T) {
	db := seededDownloadDB(t)
	SetDB(db)
	if _, err := seed.SeedDemoSkills(db, 1); err != nil {
		t.Fatalf("seed: %v", err)
	}

	for _, slug := range []string{"polished-writer", "faithful-translator", "code-helper", "data-analyst"} {
		// userID 1, group "default" → free plan; demo skills are free → entitled.
		c, w := testDownloadCtx(slug, 1, "default")
		DownloadSkillPackage(c)

		require.Equalf(t, http.StatusOK, w.Code, "%s: download failed, body=%s", slug, w.Body.String())
		require.Equalf(t, "application/zip", w.Header().Get("Content-Type"), "%s: content-type", slug)

		zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
		require.NoErrorf(t, err, "%s: open zip", slug)
		files := map[string]string{}
		for _, f := range zr.File {
			rc, err := f.Open()
			require.NoError(t, err)
			buf := new(bytes.Buffer)
			_, _ = buf.ReadFrom(rc)
			rc.Close()
			files[f.Name] = buf.String()
		}

		require.Containsf(t, files, "manifest.json", "%s: manifest", slug)
		require.Containsf(t, files, "SKILL.md", "%s: SKILL.md", slug)
		// D-09 guard inputs: SKILL.md routes through DeepRouter (the work step).
		require.Containsf(t, strings.ToLower(files["SKILL.md"]), "deeprouter", "%s: SKILL.md mentions DeepRouter", slug)
		// Must reference the PUBLIC ROUTING endpoint, which is the only path wired to
		// the DR-82 abuse gate (markSkillPublicRoutingAPI + PublicRoutingAbuseControl).
		require.Containsf(t, files["SKILL.md"], "/v1/routing/chat/completions", "%s: SKILL.md must reference the public routing endpoint", slug)
		// And must NOT point at the ordinary chat endpoint, which bypasses that gate.
		require.NotContainsf(t, files["SKILL.md"], "/v1/chat/completions", "%s: SKILL.md must not reference the ordinary chat endpoint (bypasses the abuse gate)", slug)
		// Capability package: manifest pins the published version.
		require.Containsf(t, files["manifest.json"], "skill_version_id", "%s: manifest pins version", slug)
		require.Containsf(t, files["manifest.json"], "requires_deeprouter_key", "%s: manifest flags runner key", slug)
	}

	// Download recorded entitlement rows (download == enable, DR-55).
	var enabled int64
	db.Model(&skillmodel.UserEnabledSkill{}).Where("user_id = ?", 1).Count(&enabled)
	require.Equal(t, int64(4), enabled, "each download should upsert a user_enabled_skills row")
}
