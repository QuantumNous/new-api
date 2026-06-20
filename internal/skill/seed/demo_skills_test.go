package seed

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/packaging"
	"github.com/QuantumNous/new-api/internal/skill/tiers"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func seedTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "seed.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	if err := skillmodel.MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := skillmodel.MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions: %v", err)
	}
	return db
}

func TestSeedDemoSkills_CreatesFourPublishedPackagedSkills(t *testing.T) {
	db := seedTestDB(t)

	result, err := SeedDemoSkills(db, 1)
	if err != nil {
		t.Fatalf("SeedDemoSkills: %v", err)
	}
	if len(result.Outcomes) != 4 {
		t.Fatalf("expected 4 outcomes, got %d", len(result.Outcomes))
	}
	for _, o := range result.Outcomes {
		if o.Action != "created" {
			t.Fatalf("%s: expected created on first run, got %s", o.Slug, o.Action)
		}
	}

	var published int64
	db.Model(&skillmodel.Skill{}).Where("status = ?", enums.SkillStatusPublished).Count(&published)
	if published != 4 {
		t.Fatalf("expected 4 published skills, got %d", published)
	}

	wantSlugs := map[string]bool{"polished-writer": false, "faithful-translator": false, "code-helper": false, "data-analyst": false}
	var skills []skillmodel.Skill
	if err := db.Find(&skills).Error; err != nil {
		t.Fatalf("load skills: %v", err)
	}
	for _, s := range skills {
		if _, ok := wantSlugs[s.Slug]; !ok {
			t.Fatalf("unexpected slug %q", s.Slug)
		}
		wantSlugs[s.Slug] = true

		// Published + has an active version.
		if s.Status != enums.SkillStatusPublished {
			t.Fatalf("%s: not published", s.Slug)
		}
		if s.ActiveVersionID == nil {
			t.Fatalf("%s: missing active_version_id", s.Slug)
		}
		if s.PublishedAt == nil {
			t.Fatalf("%s: missing published_at", s.Slug)
		}

		// model_whitelist must be valid platform tiers (D-09 rule 2 / DR-110).
		var wl []string
		if err := json.Unmarshal(s.ModelWhitelist, &wl); err != nil {
			t.Fatalf("%s: whitelist json: %v", s.Slug, err)
		}
		if _, ok := tiers.ValidateWhitelist(wl); !ok {
			t.Fatalf("%s: whitelist %v contains a non-tier alias", s.Slug, wl)
		}

		// Active version exists, is active, has a sha, and packages cleanly.
		var v skillmodel.SkillVersion
		if err := db.Where("id = ?", *s.ActiveVersionID).First(&v).Error; err != nil {
			t.Fatalf("%s: load active version: %v", s.Slug, err)
		}
		if v.Status != enums.SkillVersionStatusActive {
			t.Fatalf("%s: active version status is %q", s.Slug, v.Status)
		}
		if v.InstructionTemplateSHA256 != skillmodel.ComputeTemplateSHA256(v.InstructionTemplate) {
			t.Fatalf("%s: sha mismatch", s.Slug)
		}
		if _, err := packaging.BuildPackage(s, v); err != nil {
			t.Fatalf("%s: BuildPackage failed (guard or build): %v", s.Slug, err)
		}
	}
	for slug, seen := range wantSlugs {
		if !seen {
			t.Fatalf("missing seeded slug %q", slug)
		}
	}
}

func TestSeedDemoSkills_Idempotent(t *testing.T) {
	db := seedTestDB(t)

	if _, err := SeedDemoSkills(db, 1); err != nil {
		t.Fatalf("first seed: %v", err)
	}
	result, err := SeedDemoSkills(db, 1)
	if err != nil {
		t.Fatalf("second seed: %v", err)
	}
	for _, o := range result.Outcomes {
		if o.Action != "up-to-date" {
			t.Fatalf("%s: re-run should be up-to-date, got %s", o.Slug, o.Action)
		}
	}

	// No duplicate skills or versions created.
	var skillCount, versionCount int64
	db.Model(&skillmodel.Skill{}).Count(&skillCount)
	db.Model(&skillmodel.SkillVersion{}).Count(&versionCount)
	if skillCount != 4 {
		t.Fatalf("expected 4 skills after re-seed, got %d", skillCount)
	}
	if versionCount != 4 {
		t.Fatalf("expected 4 versions after re-seed (no churn), got %d", versionCount)
	}
}

func TestSeedDemoSkills_NewVersionOnTemplateChange(t *testing.T) {
	db := seedTestDB(t)
	if _, err := SeedDemoSkills(db, 1); err != nil {
		t.Fatalf("first seed: %v", err)
	}

	// Mutate the active version's template so the next seed must create v2.
	var s skillmodel.Skill
	if err := db.Where("slug = ?", "code-helper").First(&s).Error; err != nil {
		t.Fatalf("load skill: %v", err)
	}
	if err := db.Model(&skillmodel.SkillVersion{}).
		Where("id = ?", *s.ActiveVersionID).
		Update("instruction_template_sha256", "deadbeef").Error; err != nil {
		t.Fatalf("mutate sha: %v", err)
	}

	result, err := SeedDemoSkills(db, 1)
	if err != nil {
		t.Fatalf("re-seed: %v", err)
	}
	for _, o := range result.Outcomes {
		if o.Slug == "code-helper" {
			if o.Action != "updated" || o.VersionNumber != 2 {
				t.Fatalf("code-helper should become updated v2, got %s v%d", o.Action, o.VersionNumber)
			}
		}
	}

	// Exactly one active version remains for code-helper.
	var activeCount int64
	db.Model(&skillmodel.SkillVersion{}).
		Where("skill_id = ? AND status = ?", s.ID, enums.SkillVersionStatusActive).
		Count(&activeCount)
	if activeCount != 1 {
		t.Fatalf("expected exactly 1 active version, got %d", activeCount)
	}
}
