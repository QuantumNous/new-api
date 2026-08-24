package skillmodel

import (
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/skill/enums"
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

// --- Creator marketplace columns (Module3 P1, docs/tasks/skill-creator-data-model-prd.md) ---

// TestMigrateSkills_SQLite_CreatorColumnsExist covers the 8 columns added for the
// creator workflow. A fresh SQLite DB gets them straight from AutoMigrate.
func TestMigrateSkills_SQLite_CreatorColumnsExist(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	for _, col := range []string{
		"source", "creator_id", "review_status", "review_actor_id",
		"reviewed_at", "review_note", "scan_report", "scanned_at",
	} {
		if !db.Migrator().HasColumn(&Skill{}, col) {
			t.Errorf("expected skills.%s to exist after MigrateSkills", col)
		}
	}
}

// TestSkill_SourceDefaultsToOfficial pins the DB-level default. It must Omit the
// column: a Go zero-value struct would send "" and override the default, the same
// trap documented on AIDisclosureRequired.
func TestSkill_SourceDefaultsToOfficial(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	s := validSkill("source-default")
	if err := db.Omit("Source").Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	var got Skill
	if err := db.First(&got, "id = ?", s.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.Source != SkillSourceOfficial {
		t.Errorf("expected source to default to %q, got %q", SkillSourceOfficial, got.Source)
	}
	if got.CreatorID != nil || got.ReviewStatus != nil || got.ScanReport != nil {
		t.Errorf("expected creator_id/review_status/scan_report to stay NULL on an official skill, got %v/%v/%v",
			got.CreatorID, got.ReviewStatus, got.ScanReport)
	}
}

// TestCheck_Status_AcceptsCreatorStatuses proves the widened chk_skills_status
// expression actually reached CREATE TABLE on a fresh SQLite database. The
// constraint NAME is unchanged, so gorm writes the new expression on a fresh
// table but leaves an existing one alone — see PRD D2 for that degradation.
func TestCheck_Status_AcceptsCreatorStatuses(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	for i, status := range []string{"submitted", "sandbox", "pending_launch"} {
		s := validSkill(fmt.Sprintf("creator-status-%d", i))
		if err := db.Exec(
			`INSERT INTO skills (id, slug, status, category, tags, default_locale, name, short_description, description, input_hints, example_inputs, example_outputs, required_plan, monetization_type, price_markup, model_whitelist, timeout_seconds, timeout_risk, is_kids_safe, is_kids_exclusive, kids_approval_status, ai_disclosure_required, featured_flag, source, created_by, created_at, updated_at)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			fmt.Sprintf("id-creator-status-%d", i), s.Slug, status, s.Category, "[]", s.DefaultLocale, s.Name, s.ShortDescription, s.Description, "[]", "[]", "[]", "free", "free", 0, "[]", 45, 0, 0, 0, "not_required", 1, 0, "creator", 1, testTS, testTS,
		).Error; err != nil {
			t.Errorf("expected status=%q to be accepted after the creator-workflow widening, got %v", status, err)
		}
	}
}

// TestSkillStatusCheckTagCoversEveryEnumValue is the drift guard that was missing.
// TestEnumDBValues_MatchCheckConstraints only compares each constant against a
// hardcoded literal — it never reads the constraint, so "added an enum value but
// forgot the CHECK" passes it silently. This reads the real struct tag instead.
func TestSkillStatusCheckTagCoversEveryEnumValue(t *testing.T) {
	field, ok := reflect.TypeOf(Skill{}).FieldByName("Status")
	if !ok {
		t.Fatal("Skill.Status field not found")
	}
	tag := field.Tag.Get("gorm")
	if !strings.Contains(tag, "check:chk_skills_status,") {
		t.Fatalf("Skill.Status no longer declares chk_skills_status: %s", tag)
	}
	for _, v := range []enums.SkillStatus{
		enums.SkillStatusDraft, enums.SkillStatusSubmitted, enums.SkillStatusSandbox,
		enums.SkillStatusPendingLaunch, enums.SkillStatusPublished,
		enums.SkillStatusDeprecated, enums.SkillStatusArchived,
	} {
		if !strings.Contains(tag, "'"+string(v)+"'") {
			t.Errorf("enums.SkillStatus %q is not in the chk_skills_status CHECK expression — "+
				"adding an enum value without widening the constraint makes it unwritable", v)
		}
	}
	// Values the creator workflow deliberately does NOT have (PRD D3).
	for _, v := range []string{"pending_review", "suspended"} {
		if strings.Contains(tag, "'"+v+"'") {
			t.Errorf("%q must not be a skills.status value — PRD D3 maps it onto "+
				"submitted+review_status / deprecated instead", v)
		}
	}
}

// legacySkill mirrors the skills table as it existed before the creator
// workflow: no source/creator_id/review_* /scan_* columns, and the original
// four-value chk_skills_status. Built as a struct so gorm generates the DDL —
// a hand-written CREATE TABLE is not parseable by the glebarez/sqlite migrator.
type legacySkill struct {
	ID                   string     `gorm:"column:id;type:char(36);primaryKey;not null"`
	Slug                 string     `gorm:"column:slug;type:varchar(128);not null;uniqueIndex"`
	Status               string     `gorm:"column:status;type:varchar(32);not null;default:draft;check:chk_skills_status,status IN ('draft','published','deprecated','archived')"`
	Category             string     `gorm:"column:category;type:varchar(64);not null"`
	Tags                 SkillJSONB `gorm:"column:tags;type:text;not null"`
	DefaultLocale        string     `gorm:"column:default_locale;type:varchar(16);not null;default:en"`
	Name                 string     `gorm:"column:name;type:varchar(160);not null"`
	ShortDescription     string     `gorm:"column:short_description;type:varchar(280);not null"`
	Description          string     `gorm:"column:description;type:text;not null"`
	InputHints           SkillJSONB `gorm:"column:input_hints;type:text;not null"`
	ExampleInputs        SkillJSONB `gorm:"column:example_inputs;type:text;not null"`
	ExampleOutputs       SkillJSONB `gorm:"column:example_outputs;type:text;not null"`
	RequiredPlan         string     `gorm:"column:required_plan;type:varchar(32);not null"`
	MonetizationType     string     `gorm:"column:monetization_type;type:varchar(32);not null"`
	PriceMarkup          float64    `gorm:"column:price_markup;type:decimal(10,4);not null;default:0"`
	ModelWhitelist       SkillJSONB `gorm:"column:model_whitelist;type:text;not null"`
	TimeoutSeconds       int        `gorm:"column:timeout_seconds;not null;default:45"`
	TimeoutRisk          bool       `gorm:"column:timeout_risk;not null;default:false"`
	IsKidsSafe           bool       `gorm:"column:is_kids_safe;not null;default:false"`
	IsKidsExclusive      bool       `gorm:"column:is_kids_exclusive;not null;default:false"`
	KidsApprovalStatus   string     `gorm:"column:kids_approval_status;type:varchar(32);not null;default:not_required"`
	AIDisclosureRequired bool       `gorm:"column:ai_disclosure_required;not null;default:true"`
	FeaturedFlag         bool       `gorm:"column:featured_flag;not null;default:false"`
	CreatedBy            int64      `gorm:"column:created_by;type:bigint;not null"`
	CreatedAt            time.Time  `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt            time.Time  `gorm:"column:updated_at;not null;autoUpdateTime"`
}

func (legacySkill) TableName() string { return "skills" }

// TestMigrateSkills_SQLite_LegacyTableGetsCreatorColumns pins what actually
// happens to a SQLite database created before the creator workflow.
//
// ⚠️ Two pre-existing facts, both verified against e1c0d12 (before any Module3
// work) and neither introduced here:
//
//  1. AutoMigrate against an ALREADY-EXISTING skills table fails on
//     glebarez/sqlite v1.9.0 with "invalid DDL, unbalanced brackets" — the
//     driver rebuilds tables carrying IN(...) CHECK constraints and mis-parses
//     the result. This is why a SQLite dev database cannot survive a restart
//     today, and it is why the "migrates cleanly over existing data" acceptance
//     item is verifiable on PostgreSQL/MySQL only.
//  2. SQLite cannot ALTER a CHECK constraint, so such a database keeps the old
//     four-value status expression forever (PRD D2).
//
// What this test does guarantee is that migrateSkillsCreatorColumns runs BEFORE
// AutoMigrate and therefore still lands the eight columns and backfills source,
// leaving the row data intact. If (1) is ever fixed upstream this test goes red
// on the error assertion, which is the point — it should be revisited, not
// silently kept passing.
func TestMigrateSkills_SQLite_LegacyTableGetsCreatorColumns(t *testing.T) {
	db := openSQLiteDB(t)
	if err := db.AutoMigrate(&legacySkill{}); err != nil {
		t.Fatalf("create legacy skills table: %v", err)
	}
	for i, status := range []string{"draft", "published"} {
		row := legacySkill{
			ID: fmt.Sprintf("legacy-%d", i), Slug: fmt.Sprintf("legacy-slug-%d", i),
			Status: status, Category: "productivity", DefaultLocale: "en",
			Name: "Legacy Skill", ShortDescription: "short", Description: "description",
			RequiredPlan: "free", MonetizationType: "free", TimeoutSeconds: 45, CreatedBy: 1,
		}
		if err := db.Create(&row).Error; err != nil {
			t.Fatalf("seed legacy row %d: %v", i, err)
		}
	}

	err := MigrateSkills(db)
	if err == nil {
		t.Error("expected the pre-existing glebarez/sqlite AutoMigrate failure on an " +
			"existing skills table; if this now succeeds the driver bug was fixed — " +
			"revisit PRD D2 and the PG/MySQL-only acceptance item")
	} else if !strings.Contains(err.Error(), "unbalanced brackets") {
		t.Fatalf("unexpected migration error (not the known driver bug): %v", err)
	}

	// The creator columns still landed: migrateSkillsCreatorColumns runs first.
	for _, col := range []string{
		"source", "creator_id", "review_status", "review_actor_id",
		"reviewed_at", "review_note", "scan_report", "scanned_at",
	} {
		if !db.Migrator().HasColumn(&Skill{}, col) {
			t.Errorf("expected skills.%s to be added to the legacy table", col)
		}
	}

	var rows []struct {
		ID     string
		Status string
		Source string
	}
	if err := db.Raw("SELECT id, status, source FROM skills ORDER BY id").Scan(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected both legacy rows to survive, got %d", len(rows))
	}
	if rows[0].Status != "draft" || rows[1].Status != "published" {
		t.Errorf("legacy statuses must be untouched, got %q/%q", rows[0].Status, rows[1].Status)
	}
	for _, r := range rows {
		if r.Source != SkillSourceOfficial {
			t.Errorf("row %s: expected source backfilled to %q, got %q", r.ID, SkillSourceOfficial, r.Source)
		}
	}

	// Documented degradation (PRD D2): the old CHECK survives.
	if err := db.Exec("UPDATE skills SET status = 'submitted' WHERE id = ?", "legacy-0").Error; err == nil {
		t.Error("expected a legacy SQLite database to still reject status='submitted'")
	}
}

// TestMigrateSkills_SQLite_CreatorIndexes covers the three access paths P2/P4/P7 need.
func TestMigrateSkills_SQLite_CreatorIndexes(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	for _, idx := range []string{"idx_skills_creator", "idx_skills_source_status", "idx_skills_review_status"} {
		if !db.Migrator().HasIndex(&Skill{}, idx) {
			t.Errorf("expected index %s to exist after MigrateSkills", idx)
		}
	}
}

// TestMigrateSkills_SQLite_RestartIsBroken pins a PRE-EXISTING product bug, not
// a test limitation: a SQLite database that DeepRouter created cannot be
// migrated a second time, so `make dev` / `go run main.go` fails on the second
// boot and the developer has to delete one-api.db.
//
// Verified against e1c0d12 (before any Module3 work) both in-process and across
// a genuine close-and-reopen, so it is not a gorm schema-cache artifact. Root
// cause is glebarez/sqlite v1.9.0 rebuilding tables that carry IN(...) CHECK
// constraints and then failing to parse its own DDL.
//
// The assertion is inverted on purpose: when this starts passing the driver bug
// is fixed, and the PG/MySQL-only acceptance item plus PRD D2 should be
// revisited rather than left stale.
func TestMigrateSkills_SQLite_RestartIsBroken(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("first run must succeed: %v", err)
	}
	err := MigrateSkills(db)
	if err == nil {
		t.Error("MigrateSkills is now re-runnable on SQLite — the upstream driver bug " +
			"appears fixed. Revisit PRD D2 and the PG/MySQL-only acceptance item, and " +
			"delete this test.")
		return
	}
	if !strings.Contains(err.Error(), "unbalanced brackets") {
		t.Fatalf("second run failed for a NEW reason, not the known driver bug: %v", err)
	}
}
