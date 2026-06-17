package skillmodel

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// openSQLiteDB opens a file-based SQLite DB in a temp directory.
// Uses file DB (not :memory:) so PRAGMA sqlite_master reflects DDL from CREATE TABLE.
// Registers a t.Cleanup to close the connection before TempDir removal (Windows file lock).
func openSQLiteDB(t *testing.T) *gorm.DB {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "test.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

// Phase 5: SQLite integration tests.

func TestMigrateSkills_SQLite_SucceedsFromEmptyDB(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills on empty SQLite DB: %v", err)
	}
}

func TestMigrateSkillsConstraints_SQLite_NoOp(t *testing.T) {
	db := openSQLiteDB(t)
	// migrateSkillsConstraints on SQLite must return nil without doing anything
	if err := migrateSkillsConstraints(db); err != nil {
		t.Fatalf("migrateSkillsConstraints on SQLite must be a no-op, got error: %v", err)
	}
}

func TestAutoMigrate_TableExists(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	if !db.Migrator().HasTable(&Skill{}) {
		t.Fatal("skills table must exist after MigrateSkills")
	}
}

func TestInsert_RequiredFields(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	skill := validSkill("test-insert")
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("insert valid skill: %v", err)
	}
	if skill.ID == "" {
		t.Fatal("ID must be set after create")
	}
}

func TestUniqueIndex_Slug(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	s1 := validSkill("dup-slug")
	s2 := validSkill("dup-slug")
	if err := db.Create(&s1).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&s2).Error; err == nil {
		t.Fatal("expected unique constraint violation on duplicate slug, got nil")
	}
}

const testTS = "2026-01-01 00:00:00"

func TestCheck_Status(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	s := validSkill("bad-status")
	if err := db.Exec(
		`INSERT INTO skills (id, slug, status, category, tags, default_locale, name, short_description, description, input_hints, example_inputs, example_outputs, required_plan, monetization_type, price_markup, model_whitelist, timeout_seconds, timeout_risk, is_kids_safe, is_kids_exclusive, kids_approval_status, ai_disclosure_required, featured_flag, created_by, created_at, updated_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"id-bad-status", s.Slug+"x", "invalid", s.Category, "[]", s.DefaultLocale, s.Name, s.ShortDescription, s.Description, "[]", "[]", "[]", "free", "free", 0, "[]", 45, 0, 0, 0, "not_required", 1, 0, 1, testTS, testTS,
	).Error; err == nil {
		t.Fatal("expected CHECK violation for status='invalid', got nil")
	}
}

func TestCheck_Status_FeaturedInvalid(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	s := validSkill("featured-status")
	if err := db.Exec(
		`INSERT INTO skills (id, slug, status, category, tags, default_locale, name, short_description, description, input_hints, example_inputs, example_outputs, required_plan, monetization_type, price_markup, model_whitelist, timeout_seconds, timeout_risk, is_kids_safe, is_kids_exclusive, kids_approval_status, ai_disclosure_required, featured_flag, created_by, created_at, updated_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"id-featured-status", s.Slug+"y", "featured", s.Category, "[]", s.DefaultLocale, s.Name, s.ShortDescription, s.Description, "[]", "[]", "[]", "free", "free", 0, "[]", 45, 0, 0, 0, "not_required", 1, 0, 1, testTS, testTS,
	).Error; err == nil {
		t.Fatal("expected CHECK violation for status='featured', got nil")
	}
}

func TestCheck_TimeoutSeconds(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	insertWithTimeout := func(id string, timeout int) error {
		s := validSkill(id)
		return db.Exec(
			`INSERT INTO skills (id, slug, status, category, tags, default_locale, name, short_description, description, input_hints, example_inputs, example_outputs, required_plan, monetization_type, price_markup, model_whitelist, timeout_seconds, timeout_risk, is_kids_safe, is_kids_exclusive, kids_approval_status, ai_disclosure_required, featured_flag, created_by, created_at, updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			id, s.Slug+id, "draft", s.Category, "[]", s.DefaultLocale, s.Name, s.ShortDescription, s.Description, "[]", "[]", "[]", "free", "free", 0, "[]", timeout, 0, 0, 0, "not_required", 1, 0, 1, testTS, testTS,
		).Error
	}
	if err := insertWithTimeout("t0", 0); err == nil {
		t.Error("expected CHECK violation for timeout_seconds=0")
	}
	if err := insertWithTimeout("t121", 121); err == nil {
		t.Error("expected CHECK violation for timeout_seconds=121")
	}
	if err := insertWithTimeout("t45", 45); err != nil {
		t.Errorf("timeout_seconds=45 must succeed: %v", err)
	}
}

func TestCheck_KidsExclusiveRequiresSafe(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	err := db.Exec(
		`INSERT INTO skills (id, slug, status, category, tags, default_locale, name, short_description, description, input_hints, example_inputs, example_outputs, required_plan, monetization_type, price_markup, model_whitelist, timeout_seconds, timeout_risk, is_kids_safe, is_kids_exclusive, kids_approval_status, ai_disclosure_required, featured_flag, created_by, created_at, updated_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"id-kids", "kids-excl-no-safe", "draft", "cat", "[]", "en", "N", "S", "D", "[]", "[]", "[]", "free", "free", 0, "[]", 45, 0,
		0, // is_kids_safe = false
		1, // is_kids_exclusive = true
		"not_required", 1, 0, 1, testTS, testTS,
	).Error
	if err == nil {
		t.Fatal("expected CHECK violation: is_kids_exclusive=true + is_kids_safe=false")
	}
}

func TestCheck_FreeQuota(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	insertFQ := func(id string, fq interface{}) error {
		return db.Exec(
			`INSERT INTO skills (id, slug, status, category, tags, default_locale, name, short_description, description, input_hints, example_inputs, example_outputs, required_plan, monetization_type, price_markup, model_whitelist, timeout_seconds, timeout_risk, is_kids_safe, is_kids_exclusive, kids_approval_status, ai_disclosure_required, featured_flag, created_by, created_at, updated_at, free_quota_per_month)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			id, id+"-slug", "draft", "cat", "[]", "en", "N", "S", "D", "[]", "[]", "[]", "free", "free", 0, "[]", 45, 0, 0, 0, "not_required", 1, 0, 1, testTS, testTS, fq,
		).Error
	}
	if err := insertFQ("fq-neg", -1); err == nil {
		t.Error("expected CHECK violation for free_quota_per_month=-1")
	}
	if err := insertFQ("fq-null", nil); err != nil {
		t.Errorf("free_quota_per_month=NULL must succeed: %v", err)
	}
	if err := insertFQ("fq-zero", 0); err != nil {
		t.Errorf("free_quota_per_month=0 must succeed: %v", err)
	}
}

func TestFeaturedFlag(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	s := validSkill("featured-flag-test")
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	var got Skill
	if err := db.First(&got, "id = ?", s.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.FeaturedFlag != false {
		t.Error("FeaturedFlag default must be false")
	}
	s2 := validSkill("featured-flag-true")
	s2.FeaturedFlag = true
	if err := db.Create(&s2).Error; err != nil {
		t.Fatalf("insert with FeaturedFlag=true: %v", err)
	}
	var got2 Skill
	if err := db.First(&got2, "id = ?", s2.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !got2.FeaturedFlag {
		t.Error("FeaturedFlag must read back as true")
	}
}

func TestAIDisclosure_Default(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	// Use Omit to skip the Go zero value (false) and rely on DB default (true).
	s := validSkill("ai-disclosure-default")
	if err := db.Omit("AIDisclosureRequired").Create(&s).Error; err != nil {
		t.Fatalf("create with Omit(AIDisclosureRequired): %v", err)
	}
	var got Skill
	if err := db.First(&got, "id = ?", s.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !got.AIDisclosureRequired {
		t.Error("AIDisclosureRequired DB default must be true")
	}
}

func TestNoInstructionTemplateColumn(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	if db.Migrator().HasColumn(&Skill{}, "instruction_template") {
		t.Fatal("instruction_template column must NOT exist in skills table")
	}
}

func TestCreateSkill_EmptyJSONFieldsBecomeArrays_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	// Create with zero-value JSON fields (BeforeCreate will normalize them)
	s := validSkill("json-norm")
	s.Tags = nil
	s.InputHints = nil
	s.ExampleInputs = nil
	s.ExampleOutputs = nil
	s.ModelWhitelist = nil
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	var got Skill
	if err := db.First(&got, "id = ?", s.ID).Error; err != nil {
		t.Fatal(err)
	}
	for name, field := range map[string]SkillJSONB{
		"Tags":           got.Tags,
		"InputHints":     got.InputHints,
		"ExampleInputs":  got.ExampleInputs,
		"ExampleOutputs": got.ExampleOutputs,
		"ModelWhitelist": got.ModelWhitelist,
	} {
		if string(field) != "[]" {
			t.Errorf("%s: expected '[]', got %q", name, string(field))
		}
	}
}

func TestCheckConstraints_SQLite_EnforcedByCreateTableCheckTags(t *testing.T) {
	// Verifies that SQLite CHECK constraints are present from struct check: tags (AutoMigrate).
	// This test subsumes the individual CHECK tests above for SQLite.
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}

	// status CHECK
	if err := db.Exec(`INSERT INTO skills (id,slug,status,category,tags,default_locale,name,short_description,description,input_hints,example_inputs,example_outputs,required_plan,monetization_type,price_markup,model_whitelist,timeout_seconds,timeout_risk,is_kids_safe,is_kids_exclusive,kids_approval_status,ai_disclosure_required,featured_flag,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"x1", "s1", "invalid", "c", "[]", "en", "n", "s", "d", "[]", "[]", "[]", "free", "free", 0, "[]", 45, 0, 0, 0, "not_required", 1, 0, 1, testTS, testTS).Error; err == nil {
		t.Error("status CHECK not enforced on SQLite")
	}
	// timeout CHECK
	if err := db.Exec(`INSERT INTO skills (id,slug,status,category,tags,default_locale,name,short_description,description,input_hints,example_inputs,example_outputs,required_plan,monetization_type,price_markup,model_whitelist,timeout_seconds,timeout_risk,is_kids_safe,is_kids_exclusive,kids_approval_status,ai_disclosure_required,featured_flag,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"x2", "s2", "draft", "c", "[]", "en", "n", "s", "d", "[]", "[]", "[]", "free", "free", 0, "[]", 0, 0, 0, 0, "not_required", 1, 0, 1, testTS, testTS).Error; err == nil {
		t.Error("timeout_seconds CHECK not enforced on SQLite")
	}
	// kids_exclusive CHECK
	if err := db.Exec(`INSERT INTO skills (id,slug,status,category,tags,default_locale,name,short_description,description,input_hints,example_inputs,example_outputs,required_plan,monetization_type,price_markup,model_whitelist,timeout_seconds,timeout_risk,is_kids_safe,is_kids_exclusive,kids_approval_status,ai_disclosure_required,featured_flag,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"x3", "s3", "draft", "c", "[]", "en", "n", "s", "d", "[]", "[]", "[]", "free", "free", 0, "[]", 45, 0, 0, 1, "not_required", 1, 0, 1, testTS, testTS).Error; err == nil {
		t.Error("kids_exclusive CHECK not enforced on SQLite")
	}
}

func TestFeaturedIndex_SQLite_IsPartial(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	var sql string
	err := db.Raw(
		`SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_skills_featured'`,
	).Scan(&sql).Error
	if err != nil {
		t.Fatal(err)
	}
	if sql == "" {
		t.Fatal("idx_skills_featured not found in sqlite_master")
	}
	upper := strings.ToUpper(sql)
	if !strings.Contains(upper, "WHERE") {
		t.Errorf("idx_skills_featured DDL must contain WHERE clause, got: %s", sql)
	}
	if !strings.Contains(sql, "featured_flag = 1") && !strings.Contains(sql, "featured_flag=1") {
		t.Errorf("idx_skills_featured WHERE clause must reference featured_flag = 1, got: %s", sql)
	}
}

// TestMigrateSkills_SQLite_Idempotent verifies the DR-40-controlled sub-steps
// are idempotent on SQLite (HasConstraint no-op, JSONB no-op, HasIndex guard).
// Full MigrateSkills(db) twice is not tested on SQLite because glebarez/sqlite
// v1.9.0 AutoMigrate on existing tables with IN(...) CHECK constraints triggers
// a table-rebuild path that fails with "invalid DDL, unbalanced brackets" — a
// known driver bug outside DR-40's control. PG/MySQL cover the full two-call test.
func TestMigrateSkills_SQLite_Idempotent(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("first MigrateSkills: %v", err)
	}
	if err := migrateSkillsConstraints(db); err != nil {
		t.Fatalf("migrateSkillsConstraints second run (SQLite no-op): %v", err)
	}
	if err := createSkillsJSONBColumns(db); err != nil {
		t.Fatalf("createSkillsJSONBColumns second run (SQLite no-op): %v", err)
	}
	if err := createSkillsIndexes(db); err != nil {
		t.Fatalf("createSkillsIndexes second run (HasIndex guard): %v", err)
	}
}

// TestTimestampBehavior_SQLite_GoHookFillsTimestamps asserts the D8 approved deviation for SQLite:
// SQLite has no DB-level DEFAULT CURRENT_TIMESTAMP; GORM autoCreateTime/autoUpdateTime fills
// created_at / updated_at on every GORM-managed insert. Raw SQL inserts must supply values explicitly.
// This is the approved behavior documented in DR-40-PR-description.md §D8.
func TestTimestampBehavior_SQLite_GoHookFillsTimestamps(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	// Verify SQLite schema has NO default for created_at / updated_at (D8 known deviation).
	for _, col := range []string{"created_at", "updated_at"} {
		var dflt *string
		db.Raw(
			`SELECT dflt_value FROM pragma_table_info('skills') WHERE name = ?`, col,
		).Scan(&dflt)
		if dflt != nil {
			t.Errorf("SQLite column %s has unexpected DB-level default %q (D8 deviation: no DB default expected)", col, *dflt)
		}
	}
	// GORM-managed insert fills timestamps via autoCreateTime / autoUpdateTime.
	s := validSkill("ts-sqlite-hook")
	if err := db.Create(&s).Error; err != nil {
		t.Fatalf("Create: %v", err)
	}
	if s.CreatedAt.IsZero() {
		t.Error("CreatedAt is zero after GORM Create — autoCreateTime hook not firing")
	}
	if s.UpdatedAt.IsZero() {
		t.Error("UpdatedAt is zero after GORM Create — autoUpdateTime hook not firing")
	}
}

// validSkill returns a minimal valid Skill fixture with the given slug suffix.
func validSkill(slugSuffix string) Skill {
	return Skill{
		Slug:             slugSuffix,
		Status:           "draft",
		Category:         "productivity",
		DefaultLocale:    "en",
		Name:             "Test Skill " + slugSuffix,
		ShortDescription: "A test skill",
		Description:      "This is a test skill for DR-40 integration tests.",
		RequiredPlan:     "free",
		MonetizationType: "free",
		TimeoutSeconds:   45,
		CreatedBy:        1,
	}
}
