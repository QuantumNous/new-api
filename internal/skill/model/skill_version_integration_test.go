package skillmodel

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestMigrateSkillVersions_SQLite_SucceedsFromEmptyDB(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions on empty SQLite DB: %v", err)
	}
	if !db.Migrator().HasTable(&SkillVersion{}) {
		t.Fatal("skill_versions table must exist after MigrateSkillVersions")
	}
}

func TestSkillVersions_InstructionTemplateOnlyHere_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions: %v", err)
	}
	if db.Migrator().HasColumn(&Skill{}, "instruction_template") {
		t.Fatal("skills table must not contain instruction_template")
	}
	if !db.Migrator().HasColumn(&SkillVersion{}, "instruction_template") {
		t.Fatal("skill_versions table must contain instruction_template")
	}
}

func TestSkillVersions_AcceptanceColumnsPresent_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions: %v", err)
	}

	for _, col := range []string{
		"instruction_template_sha256",
		"download_instructions",
		"usage_instructions",
		"prerequisites",
		"quickstart",
		"example_io",
		"model_whitelist_snapshot",
		"required_plan_snapshot",
		"monetization_snapshot",
		"max_input_tokens_snapshot",
		"package_zip",
		"package_sha256",
		"package_built_at",
	} {
		if !db.Migrator().HasColumn(&SkillVersion{}, col) {
			t.Fatalf("skill_versions missing required column %s", col)
		}
	}
}

func TestSkillVersions_InsertRequiredFieldsAndNormalizeJSON_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	skill := createSkillForVersionTest(t, db, "version-json")
	version := validSkillVersion(skill.ID, 1)
	version.OutputSchema = nil           // nil → NULL in DB (PRD §4.2: no schema = NULL)
	version.Prerequisites = nil          // nil → normalized to []
	version.Quickstart = nil             // nil → normalized to []
	version.ExampleIO = nil              // nil → normalized to []
	version.ModelWhitelistSnapshot = nil // nil → normalized to []
	version.MonetizationSnapshot = nil   // nil → normalized to {}

	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create skill version: %v", err)
	}
	if version.ID == "" {
		t.Fatal("ID must be set after create")
	}

	var got SkillVersion
	if err := db.First(&got, "id = ?", version.ID).Error; err != nil {
		t.Fatal(err)
	}

	// output_schema: nullable — nil input stays NULL in DB.
	if got.OutputSchema != nil {
		t.Errorf("OutputSchema: expected nil (NULL in DB), got %q", string(*got.OutputSchema))
	}
	// model_whitelist_snapshot: array shape, normalized to [].
	if string(got.ModelWhitelistSnapshot) != "[]" {
		t.Errorf("ModelWhitelistSnapshot: expected '[]', got %q", string(got.ModelWhitelistSnapshot))
	}
	if string(got.Prerequisites) != "[]" {
		t.Errorf("Prerequisites: expected '[]', got %q", string(got.Prerequisites))
	}
	if string(got.Quickstart) != "[]" {
		t.Errorf("Quickstart: expected '[]', got %q", string(got.Quickstart))
	}
	if string(got.ExampleIO) != "[]" {
		t.Errorf("ExampleIO: expected '[]', got %q", string(got.ExampleIO))
	}
	// monetization_snapshot: object shape, normalized to {} (NOT []).
	if string(got.MonetizationSnapshot) != "{}" {
		t.Errorf("MonetizationSnapshot: expected '{}', got %q", string(got.MonetizationSnapshot))
	}
}

func TestSkillVersions_UniqueSkillVersionNumber_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	skill := createSkillForVersionTest(t, db, "version-unique")
	v1 := validSkillVersion(skill.ID, 1)
	v2 := validSkillVersion(skill.ID, 1)
	v2.Status = "inactive"

	if err := db.Create(&v1).Error; err != nil {
		t.Fatalf("create first version: %v", err)
	}
	if err := db.Create(&v2).Error; err == nil {
		t.Fatal("expected unique constraint violation for duplicate (skill_id, version_number)")
	}
}

func TestSkillVersions_OneActiveVersion_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	skill := createSkillForVersionTest(t, db, "one-active")
	v1 := validSkillVersion(skill.ID, 1)
	v1.Status = "active"
	v2 := validSkillVersion(skill.ID, 2)
	v2.Status = "active"
	v3 := validSkillVersion(skill.ID, 3)
	v3.Status = "inactive"

	if err := db.Create(&v1).Error; err != nil {
		t.Fatalf("create active v1: %v", err)
	}
	if err := db.Create(&v3).Error; err != nil {
		t.Fatalf("create inactive v3 alongside active v1: %v", err)
	}
	if err := db.Create(&v2).Error; err == nil {
		t.Fatal("expected one-active unique index violation for second active version")
	}
}

func TestSkillVersions_ParentDeleteRestricted_SQLite(t *testing.T) {
	db := openSQLiteFKDB(t)
	skill := createSkillForVersionTest(t, db, "delete-restricted")
	version := validSkillVersion(skill.ID, 1)

	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create skill version: %v", err)
	}
	if err := db.Delete(&skill).Error; err == nil {
		t.Fatal("expected parent skill delete to be restricted while skill_versions rows exist")
	}

	var count int64
	if err := db.Model(&SkillVersion{}).Where("skill_id = ?", skill.ID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("skill_versions row must remain after restricted parent delete, got %d", count)
	}
}

func TestSkillVersions_CheckConstraints_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	skill := createSkillForVersionTest(t, db, "version-checks")

	badStatus := validSkillVersion(skill.ID, 1)
	badStatus.Status = "published"
	if err := db.Create(&badStatus).Error; err == nil {
		t.Error("expected CHECK violation for invalid skill_versions.status")
	}

	badRollout := validSkillVersion(skill.ID, 2)
	badRollout.RolloutPercentage = 101
	if err := db.Create(&badRollout).Error; err == nil {
		t.Error("expected CHECK violation for rollout_percentage=101")
	}

	badMaxInput := validSkillVersion(skill.ID, 3)
	zero := 0
	badMaxInput.MaxInputTokensSnapshot = &zero
	if err := db.Create(&badMaxInput).Error; err == nil {
		t.Error("expected CHECK violation for max_input_tokens_snapshot=0")
	}
}

func openSQLiteFKDB(t *testing.T) *gorm.DB {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "test_skill_versions_fk.db") + "?_pragma=foreign_keys(1)"
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite with FK enforcement: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

func createSkillForVersionTest(t *testing.T, db *gorm.DB, slug string) Skill {
	t.Helper()
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions: %v", err)
	}
	skill := validSkill(slug)
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("create parent skill: %v", err)
	}
	return skill
}

func validSkillVersion(skillID string, versionNumber int) SkillVersion {
	maxInput := 4000
	schema := SkillJSONB(`{"type":"object"}`)
	return SkillVersion{
		SkillID:                   skillID,
		VersionNumber:             versionNumber,
		Status:                    "draft",
		InstructionTemplate:       "You are a helpful skill executor.",
		InstructionTemplateSHA256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		OutputSchema:              &schema, // *SkillJSONB: nullable per PRD §4.2
		ModelWhitelistSnapshot:    SkillJSONB(`["gpt-4o-mini"]`),
		RequiredPlanSnapshot:      "free",
		MonetizationSnapshot:      SkillJSONB(`{"type":"free"}`),
		MaxInputTokensSnapshot:    &maxInput,
		RolloutPercentage:         100,
		CreatedBy:                 1,
	}
}
