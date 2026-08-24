package skillmodel

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Phase 6: PG + MySQL env-gated integration tests.
// Set DR40_PG_DSN / DR40_MYSQL_DSN to run; tests skip when env var is absent.

func openPGDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("DR40_PG_DSN")
	if dsn == "" {
		t.Skip("DR40_PG_DSN not set")
	}
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open PG: %v", err)
	}
	t.Cleanup(func() {
		db.Exec("DROP TABLE IF EXISTS skill_usage_events")
		db.Exec("DROP TABLE IF EXISTS skill_calls")
		db.Exec("DROP TABLE IF EXISTS skill_ratings")
		db.Exec("DROP TABLE IF EXISTS skill_versions")
		db.Exec("DROP TABLE IF EXISTS skills")
	})
	return db
}

func openMySQLDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("DR40_MYSQL_DSN")
	if dsn == "" {
		t.Skip("DR40_MYSQL_DSN not set")
	}
	if !strings.Contains(dsn, "parseTime") {
		if strings.Contains(dsn, "?") {
			dsn += "&parseTime=true"
		} else {
			dsn += "?parseTime=true"
		}
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open MySQL: %v", err)
	}
	t.Cleanup(func() {
		db.Exec("DROP TABLE IF EXISTS skill_usage_events")
		db.Exec("DROP TABLE IF EXISTS skill_calls")
		db.Exec("DROP TABLE IF EXISTS skill_ratings")
		db.Exec("DROP TABLE IF EXISTS skill_versions")
		db.Exec("DROP TABLE IF EXISTS skills")
	})
	return db
}

// ── PostgreSQL ──────────────────────────────────────────────────────────────

func TestMigrateSkills_PG_SucceedsFromEmptyDB(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills on empty PG DB: %v", err)
	}
}

func TestMigrateSkillVersions_PG_BackfillsInstructionColumnsOnLegacyRows(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills on PG: %v", err)
	}
	if err := db.Exec(`
		CREATE TABLE skill_versions (
			id char(36) NOT NULL PRIMARY KEY,
			skill_id char(36) NOT NULL,
			version_number bigint NOT NULL,
			status varchar(32) NOT NULL DEFAULT 'draft',
			instruction_template text NOT NULL,
			instruction_template_sha256 char(64) NOT NULL,
			prompt_guard_template text,
			output_schema text,
			model_whitelist_snapshot text NOT NULL,
			required_plan_snapshot varchar(32) NOT NULL,
			monetization_snapshot text NOT NULL,
			max_input_tokens_snapshot bigint,
			rollout_percentage bigint NOT NULL DEFAULT 100,
			experiment_name varchar(128),
			created_by bigint NOT NULL,
			created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
			activated_at timestamptz,
			archived_at timestamptz
		)
	`).Error; err != nil {
		t.Fatalf("create legacy skill_versions table: %v", err)
	}
	skill := validSkill("pg-legacy-instruction-columns")
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("create parent skill: %v", err)
	}
	if err := db.Exec(`
		INSERT INTO skill_versions (
			id, skill_id, version_number, status, instruction_template,
			instruction_template_sha256, output_schema, model_whitelist_snapshot,
			required_plan_snapshot, monetization_snapshot, rollout_percentage, created_by
		) VALUES (?, ?, 1, 'draft', 'legacy template',
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
			'{"type":"object"}', '["gpt-4o-mini"]', 'free', '{"type":"free"}', 100, 1
		)
	`, uuid.New().String(), skill.ID).Error; err != nil {
		t.Fatalf("insert legacy skill version: %v", err)
	}

	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions on legacy PG table: %v", err)
	}

	var got struct {
		DownloadInstructions string
		UsageInstructions    string
		Prerequisites        string
		Quickstart           string
		ExampleIO            string
	}
	if err := db.Raw(`
		SELECT
			download_instructions,
			usage_instructions,
			prerequisites::text AS prerequisites,
			quickstart::text AS quickstart,
			example_io::text AS example_io
		FROM skill_versions
		LIMIT 1
	`).Scan(&got).Error; err != nil {
		t.Fatalf("read migrated row: %v", err)
	}
	if got.DownloadInstructions != "" || got.UsageInstructions != "" {
		t.Fatalf("text instruction defaults = %q/%q, want empty strings", got.DownloadInstructions, got.UsageInstructions)
	}
	if got.Prerequisites != "[]" || got.Quickstart != "[]" || got.ExampleIO != "[]" {
		t.Fatalf("json instruction defaults = %q/%q/%q, want []/[]/[]", got.Prerequisites, got.Quickstart, got.ExampleIO)
	}
}

func TestMigrateSkillUsageEvents_PG_SucceedsFromEmptyDB(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents on empty PG DB: %v", err)
	}
	if !db.Migrator().HasTable(&SkillUsageEvent{}) {
		t.Fatal("skill_usage_events table must exist after migration")
	}
}

func TestMigrateSkillUsageEvents_PG_Idempotent(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("first MigrateSkillUsageEvents on PG: %v", err)
	}
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("second MigrateSkillUsageEvents on PG: %v", err)
	}
}

func TestSUE_PG_MetadataConstraintEnforced(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatal(err)
	}

	err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, metadata)
		 VALUES (?, ?, ?, ?, CAST(? AS jsonb))`,
		uuid.New().String(), "skill_used", testTS, "skill_detail", `{"instruction_template":"blocked"}`,
	).Error
	if err == nil {
		t.Fatal("PG must reject metadata containing instruction_template")
	}
}

func TestSUE_PG_EnumConstraintsEnforced(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name        string
		eventType   string
		entryPoint  string
		plan        any
		blockReason any
	}{
		{"bad-event-type", "skill_Used", "skill_detail", "free", nil},
		{"bad-entry-point", "skill_used", "skill_Detail", "free", nil},
		{"bad-plan", "skill_used", "skill_detail", "gold", nil},
		{"bad-block-reason", "skill_used", "skill_detail", "free", "skill_plan_required"},
	}
	for _, tc := range cases {
		err := db.Exec(
			`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, plan, block_reason, metadata)
			 VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb))`,
			uuid.New().String(), tc.eventType, testTS, tc.entryPoint, tc.plan, tc.blockReason, `{}`,
		).Error
		if err == nil {
			t.Fatalf("%s: PG must reject invalid enum value", tc.name)
		}
	}
}

func TestSUE_PG_MetadataIsJSONB(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatal(err)
	}
	isJSONB, err := isPGColumnJSONB(db, "skill_usage_events", "metadata")
	if err != nil {
		t.Fatalf("check skill_usage_events metadata jsonb: %v", err)
	}
	if !isJSONB {
		t.Fatal("skill_usage_events.metadata must be jsonb after migration")
	}
}

func TestJSONBColumns_PG(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	cols := []string{"tags", "input_hints", "example_inputs", "example_outputs", "model_whitelist"}
	for _, col := range cols {
		isJSONB, err := isPGColumnJSONB(db, "skills", col)
		if err != nil {
			t.Errorf("check jsonb %s: %v", col, err)
			continue
		}
		if !isJSONB {
			t.Errorf("column %s must be jsonb after migration, but is not", col)
		}
	}
}

func TestJSONBColumns_PG_Idempotent(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	// Running createSkillsJSONBColumns a second time must not error
	if err := createSkillsJSONBColumns(db); err != nil {
		t.Fatalf("createSkillsJSONBColumns second run: %v", err)
	}
}

func TestJSONBColumns_PG_DefaultIsJSONBArray(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	cols := []string{"tags", "input_hints", "example_inputs", "example_outputs", "model_whitelist"}
	for _, col := range cols {
		var colDefault string
		err := db.Raw(
			`SELECT column_default FROM information_schema.columns
			 WHERE table_schema = current_schema() AND table_name = 'skills' AND column_name = ?`,
			col,
		).Scan(&colDefault).Error
		if err != nil {
			t.Errorf("query default for %s: %v", col, err)
			continue
		}
		// PG stores the default as `'[]'::jsonb`
		if !strings.Contains(colDefault, "[]") || !strings.Contains(colDefault, "jsonb") {
			t.Errorf("column %s default must be '[]'::jsonb, got %q", col, colDefault)
		}
	}
}

func TestGINIndex_PG(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	var indexdef string
	err := db.Raw(
		`SELECT indexdef FROM pg_indexes WHERE tablename='skills' AND indexname='idx_skills_public_search'`,
	).Scan(&indexdef).Error
	if err != nil {
		t.Fatal(err)
	}
	if indexdef == "" {
		t.Fatal("idx_skills_public_search not found in pg_indexes")
	}
	lower := strings.ToLower(indexdef)
	for _, want := range []string{
		"using gin",
		"to_tsvector('simple'",
		"name",
		"short_description",
		"description",
	} {
		if !strings.Contains(lower, want) {
			t.Errorf("idx_skills_public_search missing %q in indexdef: %s", want, indexdef)
		}
	}
}

func TestCheckConstraints_PG(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	// status='invalid' must be rejected
	err := db.Exec(
		`INSERT INTO skills (id,slug,status,category,tags,default_locale,name,short_description,description,input_hints,example_inputs,example_outputs,required_plan,monetization_type,price_markup,model_whitelist,timeout_seconds,timeout_risk,is_kids_safe,is_kids_exclusive,kids_approval_status,ai_disclosure_required,featured_flag,created_by,created_at,updated_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"id-pg-bad-status", "pg-bad-status", "invalid", "cat", "[]", "en", "N", "S", "D", "[]", "[]", "[]", "free", "free", 0, "[]", 45, false, false, false, "not_required", true, false, 1, testTS, testTS,
	).Error
	if err == nil {
		t.Error("PG must reject status='invalid' via CHECK")
	}
	// timeout_seconds=0 must be rejected
	err = db.Exec(
		`INSERT INTO skills (id,slug,status,category,tags,default_locale,name,short_description,description,input_hints,example_inputs,example_outputs,required_plan,monetization_type,price_markup,model_whitelist,timeout_seconds,timeout_risk,is_kids_safe,is_kids_exclusive,kids_approval_status,ai_disclosure_required,featured_flag,created_by,created_at,updated_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"id-pg-bad-timeout", "pg-bad-timeout", "draft", "cat", "[]", "en", "N", "S", "D", "[]", "[]", "[]", "free", "free", 0, "[]", 0, false, false, false, "not_required", true, false, 1, testTS, testTS,
	).Error
	if err == nil {
		t.Error("PG must reject timeout_seconds=0 via CHECK")
	}
	// is_kids_exclusive=true + is_kids_safe=false must be rejected
	err = db.Exec(
		`INSERT INTO skills (id,slug,status,category,tags,default_locale,name,short_description,description,input_hints,example_inputs,example_outputs,required_plan,monetization_type,price_markup,model_whitelist,timeout_seconds,timeout_risk,is_kids_safe,is_kids_exclusive,kids_approval_status,ai_disclosure_required,featured_flag,created_by,created_at,updated_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"id-pg-kids", "pg-kids-excl", "draft", "cat", "[]", "en", "N", "S", "D", "[]", "[]", "[]", "free", "free", 0, "[]", 45, false,
		false, // is_kids_safe
		true,  // is_kids_exclusive
		"not_required", true, false, 1, testTS, testTS,
	).Error
	if err == nil {
		t.Error("PG must reject is_kids_exclusive=true + is_kids_safe=false via CHECK")
	}
}

func TestFeaturedIndex_PG_IsPartial(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	var indexdef string
	err := db.Raw(
		`SELECT indexdef FROM pg_indexes WHERE tablename='skills' AND indexname='idx_skills_featured'`,
	).Scan(&indexdef).Error
	if err != nil {
		t.Fatal(err)
	}
	if indexdef == "" {
		t.Fatal("idx_skills_featured not found in pg_indexes")
	}
	lower := strings.ToLower(indexdef)
	for _, want := range []string{"featured_flag", "featured_rank", "where"} {
		if !strings.Contains(lower, want) {
			t.Errorf("idx_skills_featured missing %q in indexdef: %s", want, indexdef)
		}
	}
}

func TestMigrateSkillsConstraints_PG_Idempotent(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	// Running constraints migration a second time must not error
	if err := migrateSkillsConstraints(db); err != nil {
		t.Fatalf("migrateSkillsConstraints second run on PG: %v", err)
	}
}

// ── MySQL ───────────────────────────────────────────────────────────────────

func TestMigrateSkills_MySQL_SucceedsFromEmptyDB(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills on empty MySQL DB: %v", err)
	}
}

func TestMigrateSkillUsageEvents_MySQL_SucceedsFromEmptyDB(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents on empty MySQL DB: %v", err)
	}
	if !db.Migrator().HasTable(&SkillUsageEvent{}) {
		t.Fatal("skill_usage_events table must exist after migration")
	}
}

func TestMigrateSkillUsageEvents_MySQL_Idempotent(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("first MigrateSkillUsageEvents on MySQL: %v", err)
	}
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("second MigrateSkillUsageEvents on MySQL: %v", err)
	}
}

func TestSUE_MySQL_BeforeCreateRejectsRestrictedMetadataKey(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatal(err)
	}
	err := db.Create(&SkillUsageEvent{
		EventID:    uuid.New().String(),
		EventType:  "skill_used",
		OccurredAt: time.Now().UTC(),
		EntryPoint: "skill_detail",
		Metadata:   SkillJSONB(`{"instruction_template":"blocked"}`),
	}).Error
	if err == nil {
		t.Fatal("BeforeCreate must reject restricted metadata keys on MySQL")
	}
}

func TestSUE_MySQL_MetadataChecksRejectInvalidJSON(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatal(err)
	}

	ok, err := isMySQLAtLeast8016DB(db)
	if err != nil {
		t.Fatalf("isMySQLAtLeast8016DB: %v", err)
	}
	if !ok {
		t.Skip("MySQL < 8.0.16: CHECK constraints are skipped; app-layer hook is the guard")
	}

	for _, tc := range []struct {
		name     string
		metadata string
	}{
		{"invalid-json", `{`},
		{"array-json", `[]`},
		{"restricted-key", `{"kids_raw_input":"blocked"}`},
	} {
		err := db.Exec(
			`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, metadata)
			 VALUES (?, ?, ?, ?, ?)`,
			uuid.New().String(), "skill_used", testTS, "skill_detail", tc.metadata,
		).Error
		if err == nil {
			t.Fatalf("%s: MySQL CHECK must reject invalid metadata", tc.name)
		}
	}
}

func TestSkillVersions_OneActiveVersion_MySQL(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatal(err)
	}

	skill := validSkill("mysql-one-active")
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("create parent skill: %v", err)
	}

	active := validSkillVersion(skill.ID, 1)
	active.Status = "active"
	inactive := validSkillVersion(skill.ID, 2)
	inactive.Status = "inactive"
	secondActive := validSkillVersion(skill.ID, 3)
	secondActive.Status = "active"

	if err := db.Create(&active).Error; err != nil {
		t.Fatalf("create active version: %v", err)
	}
	if err := db.Create(&inactive).Error; err != nil {
		t.Fatalf("create inactive version beside active version: %v", err)
	}
	if err := db.Create(&secondActive).Error; err == nil {
		t.Fatal("expected MySQL generated-column unique index to reject a second active version")
	}
}

func TestCreateSkill_EmptyJSONFieldsBecomeArrays_MySQL(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	s := validSkill("mysql-json-norm")
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
			t.Errorf("MySQL %s: expected '[]', got %q", name, string(field))
		}
	}
}

func TestJSONRoundTrip_MySQL(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	s := validSkill("mysql-json-rt")
	s.Tags = SkillJSONB(`["go","api"]`)
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	var got Skill
	if err := db.First(&got, "id = ?", s.ID).Error; err != nil {
		t.Fatal(err)
	}
	if string(got.Tags) != `["go","api"]` {
		t.Errorf("MySQL Tags roundtrip: got %q, want %q", string(got.Tags), `["go","api"]`)
	}

	// Invalid JSON must be rejected by application layer (SkillJSONB.Value)
	s2 := validSkill("mysql-json-invalid")
	s2.Tags = SkillJSONB("not-json")
	if err := db.Create(&s2).Error; err == nil {
		t.Error("invalid JSON in Tags must be rejected by SkillJSONB.Value()")
	}
}

func TestPartialIndex_MySQL(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	// Use SHOW CREATE TABLE — HasIndex cannot prove absence of WHERE clause.
	var tableName, createSQL string
	if err := db.Raw("SHOW CREATE TABLE skills").Row().Scan(&tableName, &createSQL); err != nil {
		t.Fatal(err)
	}
	upper := strings.ToUpper(createSQL)
	// idx_skills_featured must exist
	if !strings.Contains(upper, "IDX_SKILLS_FEATURED") {
		t.Error("idx_skills_featured not found in SHOW CREATE TABLE output")
	}
	// MySQL 5.7 does not support partial indexes — no WHERE clause should appear next to this index
	// We look for WHERE within 200 chars after the index name
	idx := strings.Index(upper, "IDX_SKILLS_FEATURED")
	if idx >= 0 {
		window := upper[idx:]
		if len(window) > 200 {
			window = window[:200]
		}
		if strings.Contains(window, "WHERE") {
			t.Errorf("idx_skills_featured must NOT have a WHERE clause on MySQL, got window: %s", window)
		}
	}
}

func TestBooleanMapping_MySQL(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	s := validSkill("mysql-bool")
	s.FeaturedFlag = true
	s.IsKidsSafe = true
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	var got Skill
	if err := db.First(&got, "id = ?", s.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !got.FeaturedFlag {
		t.Error("FeaturedFlag=true must read back as true on MySQL")
	}
	if !got.IsKidsSafe {
		t.Error("IsKidsSafe=true must read back as true on MySQL")
	}
}

func TestCheckDeclarations_MySQL(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}

	// Detect MySQL version via isMySQLAtLeast8016DB (production gate, same as migration).
	var versionStr string
	if err := db.Raw("SELECT VERSION()").Scan(&versionStr).Error; err != nil {
		t.Fatalf("SELECT VERSION(): %v", err)
	}
	t.Logf("MySQL version: %s", versionStr)

	ok, err := isMySQLAtLeast8016DB(db)
	if err != nil {
		t.Fatalf("isMySQLAtLeast8016DB: %v", err)
	}
	if !ok {
		t.Skipf("MySQL < 8.0.16 (%s): skipping all CHECK declaration/enforcement assertions; app-layer enum Valid() is the constraint gate", versionStr)
	}

	// MySQL >= 8.0.16: verify CHECK declarations exist and are enforced.
	var tableName, createSQL string
	if err := db.Raw("SHOW CREATE TABLE skills").Row().Scan(&tableName, &createSQL); err != nil {
		t.Fatal(err)
	}
	upper := strings.ToUpper(createSQL)
	for _, name := range []string{
		"CHK_SKILLS_STATUS",
		"CHK_SKILLS_TIMEOUT_SECONDS",
		"CHK_SKILLS_KIDS_EXCLUSIVE_REQUIRES_SAFE",
	} {
		if !strings.Contains(upper, name) {
			t.Errorf("CHECK constraint %s not declared in SHOW CREATE TABLE", name)
		}
	}

	// Verify enforcement: status='invalid' must be rejected
	err = db.Exec(
		`INSERT INTO skills (id,slug,status,category,tags,default_locale,name,short_description,description,input_hints,example_inputs,example_outputs,required_plan,monetization_type,price_markup,model_whitelist,timeout_seconds,timeout_risk,is_kids_safe,is_kids_exclusive,kids_approval_status,ai_disclosure_required,featured_flag,created_by,created_at,updated_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"id-mysql-chk", "mysql-chk-slug", "invalid", "cat", "[]", "en", "N", "S", "D", "[]", "[]", "[]", "free", "free", 0, "[]", 45, false, false, false, "not_required", true, false, 1, testTS, testTS,
	).Error
	if err == nil {
		t.Error("MySQL 8.0.16+ must enforce CHECK: status='invalid' must be rejected")
	}
}

func TestMigrateSkills_PG_Idempotent(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("first MigrateSkills on PG: %v", err)
	}
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("second MigrateSkills on PG (idempotent): %v", err)
	}
}

func TestMigrateSkills_MySQL_Idempotent(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("first MigrateSkills on MySQL: %v", err)
	}
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("second MigrateSkills on MySQL (idempotent): %v", err)
	}
}

func TestTimestampDefaults_PG(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	for _, col := range []string{"created_at", "updated_at"} {
		var colDefault string
		err := db.Raw(
			`SELECT column_default FROM information_schema.columns
			 WHERE table_schema = current_schema() AND table_name = 'skills' AND column_name = ?`,
			col,
		).Scan(&colDefault).Error
		if err != nil {
			t.Fatalf("query default for %s: %v", col, err)
		}
		upper := strings.ToUpper(colDefault)
		if !strings.Contains(upper, "CURRENT_TIMESTAMP") && !strings.Contains(upper, "NOW()") {
			t.Errorf("%s DB default must be CURRENT_TIMESTAMP-like, got %q", col, colDefault)
		}
	}
}

func TestTimestampDefaults_MySQL(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	for _, col := range []string{"created_at", "updated_at"} {
		var colDefault *string
		err := db.Raw(
			`SELECT column_default FROM information_schema.columns
			 WHERE table_schema = DATABASE() AND table_name = 'skills' AND column_name = ?`,
			col,
		).Scan(&colDefault).Error
		if err != nil {
			t.Fatalf("query default for %s: %v", col, err)
		}
		if colDefault == nil {
			t.Errorf("%s must have a DB-level default after migration, got NULL", col)
		}
	}
	// Verify raw INSERT without created_at/updated_at succeeds via DB default.
	err := db.Exec(
		`INSERT INTO skills (id,slug,status,category,tags,default_locale,name,short_description,description,input_hints,example_inputs,example_outputs,required_plan,monetization_type,price_markup,model_whitelist,timeout_seconds,timeout_risk,is_kids_safe,is_kids_exclusive,kids_approval_status,ai_disclosure_required,featured_flag,created_by)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"id-ts-mysql", "ts-mysql-slug", "draft", "cat", "[]", "en", "N", "S", "D", "[]", "[]", "[]", "free", "free", 0, "[]", 45, false, false, false, "not_required", true, false, 1,
	).Error
	if err != nil {
		t.Errorf("raw INSERT without timestamps must succeed (DB default provides them): %v", err)
	}
}

// TestTimestampDefaults_MySQL_RepairsUpdatedAtWhenCreatedAtAlreadyHasDefault simulates a
// partial failure state where created_at default was set but updated_at was not,
// and verifies that migrateSkillsTimestampDefaults repairs updated_at on re-run.
func TestTimestampDefaults_MySQL_RepairsUpdatedAtWhenCreatedAtAlreadyHasDefault(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	// Simulate partial failure: strip updated_at default manually.
	if err := db.Exec(
		"ALTER TABLE skills MODIFY COLUMN updated_at DATETIME(3) NOT NULL",
	).Error; err != nil {
		t.Fatalf("simulate partial failure: %v", err)
	}
	// Verify updated_at has no default now.
	var gotDefault *string
	db.Raw(
		`SELECT column_default FROM information_schema.columns
		 WHERE table_schema = DATABASE() AND table_name = 'skills' AND column_name = 'updated_at'`,
	).Scan(&gotDefault)
	if gotDefault != nil {
		t.Fatalf("precondition failed: updated_at still has default %q after strip", *gotDefault)
	}
	// Re-run; created_at already has default, updated_at does not.
	if err := migrateSkillsTimestampDefaults(db); err != nil {
		t.Fatalf("migrateSkillsTimestampDefaults repair run: %v", err)
	}
	// updated_at must now have its default restored.
	var repairedDefault *string
	db.Raw(
		`SELECT column_default FROM information_schema.columns
		 WHERE table_schema = DATABASE() AND table_name = 'skills' AND column_name = 'updated_at'`,
	).Scan(&repairedDefault)
	if repairedDefault == nil {
		t.Error("updated_at default was not repaired by migrateSkillsTimestampDefaults on re-run")
	}
}

func TestTimestampDefaults_MySQL_RepairsOnUpdateWhenDefaultPresent(t *testing.T) {
	db := openMySQLDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	// Simulate half-broken state: DEFAULT still present, ON UPDATE removed.
	if err := db.Exec(
		"ALTER TABLE skills MODIFY COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
	).Error; err != nil {
		t.Fatalf("simulate on-update strip: %v", err)
	}
	// Precondition: EXTRA has no "on update".
	var extra string
	db.Raw(
		`SELECT EXTRA FROM information_schema.columns
		 WHERE table_schema = DATABASE() AND table_name = 'skills' AND column_name = 'updated_at'`,
	).Scan(&extra)
	if strings.Contains(strings.ToLower(extra), "on update") {
		t.Fatalf("precondition failed: EXTRA still has on update after strip: %q", extra)
	}
	// Re-run should restore ON UPDATE even though DEFAULT is still present.
	if err := migrateSkillsTimestampDefaults(db); err != nil {
		t.Fatalf("migrateSkillsTimestampDefaults repair run: %v", err)
	}
	db.Raw(
		`SELECT EXTRA FROM information_schema.columns
		 WHERE table_schema = DATABASE() AND table_name = 'skills' AND column_name = 'updated_at'`,
	).Scan(&extra)
	if !strings.Contains(strings.ToLower(extra), "on update") {
		t.Error("updated_at ON UPDATE CURRENT_TIMESTAMP was not repaired by migrateSkillsTimestampDefaults")
	}
}

// --- Creator marketplace (Module3 P1, docs/tasks/skill-creator-data-model-prd.md) ---

// assertStatusConstraintWidened restores the pre-Module3 four-value
// chk_skills_status, re-runs the migration, and requires that a creator status
// is writable afterwards.
//
// This is the ONLY test that can prove refreshSkillsStatusConstraint fires, and
// it is the single highest-risk mechanism in P1: the apply loop skips any
// constraint whose NAME already exists, and the name did not change when the
// creator statuses were added. Forget the drop hook and every existing
// PostgreSQL/MySQL database keeps the old expression forever — no error, no
// failing test, just a status the application can never write. SQLite cannot
// cover this because its whole constraint path is a no-op.
func assertStatusConstraintWidened(t *testing.T, db *gorm.DB, dropStmt string) {
	t.Helper()
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("initial MigrateSkills: %v", err)
	}
	if err := db.Exec(dropStmt).Error; err != nil {
		t.Fatalf("drop constraint to simulate a pre-Module3 database: %v", err)
	}
	if err := db.Exec("ALTER TABLE skills ADD CONSTRAINT chk_skills_status CHECK (status IN ('draft','published','deprecated','archived'))").Error; err != nil {
		t.Fatalf("restore the old four-value constraint: %v", err)
	}

	if err := MigrateSkills(db); err != nil {
		t.Fatalf("second MigrateSkills must converge: %v", err)
	}

	s := validSkill("constraint-widened")
	s.Status = "sandbox"
	if err := db.Create(&s).Error; err != nil {
		t.Fatalf("status='sandbox' must be writable after the migration re-runs — "+
			"refreshSkillsStatusConstraint did not drop the stale constraint: %v", err)
	}

	bad := validSkill("constraint-still-enforced")
	bad.Status = "not-a-status"
	if err := db.Create(&bad).Error; err == nil {
		t.Error("the widened constraint must still reject unknown values")
	}
}

func TestMigrateSkills_PG_WidensStatusConstraint(t *testing.T) {
	db := openPGDB(t)
	assertStatusConstraintWidened(t, db, "ALTER TABLE skills DROP CONSTRAINT IF EXISTS chk_skills_status")
}

func TestMigrateSkills_MySQL_WidensStatusConstraint(t *testing.T) {
	db := openMySQLDB(t)
	ok, err := isMySQLAtLeast8016DB(db)
	if err != nil {
		t.Fatalf("detect mysql version: %v", err)
	}
	if !ok {
		t.Skip("MySQL < 8.0.16 ignores named CHECK constraints entirely")
	}
	assertStatusConstraintWidened(t, db, "ALTER TABLE skills DROP CHECK chk_skills_status")
}

// TestMigrateSkills_PG_CreatorConstraintsExist covers the three CHECKs that have
// no struct tag and therefore exist on PG/MySQL only (PRD M1).
func TestMigrateSkills_PG_CreatorConstraintsExist(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{
		"chk_skills_source", "chk_skills_review_status", "chk_skills_creator_has_creator_id",
	} {
		if !db.Migrator().HasConstraint(&Skill{}, name) {
			t.Errorf("expected %s to exist on PostgreSQL", name)
		}
	}

	bad := validSkill("bad-source")
	bad.Source = "somewhere-else"
	if err := db.Create(&bad).Error; err == nil {
		t.Error("chk_skills_source must reject an unknown source")
	}

	// chk_skills_creator_has_creator_id: a creator skill without an owner is
	// unbillable, so the database refuses it rather than leaving orphan rows.
	orphan := validSkill("creator-without-owner")
	orphan.Source = SkillSourceCreator
	if err := db.Create(&orphan).Error; err == nil {
		t.Error("a creator-sourced skill must not be insertable without creator_id")
	}
}

// TestMigrateSkills_PG_ScanReportIsJSONBWithoutDefault pins the one JSON column
// that must stay nullable: NULL means "never scanned". Giving it the '[]' default
// the other five carry would make every official skill look scanned-and-empty.
func TestMigrateSkills_PG_ScanReportIsJSONBWithoutDefault(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	isJSONB, err := isPGColumnJSONB(db, "skills", "scan_report")
	if err != nil {
		t.Fatal(err)
	}
	if !isJSONB {
		t.Error("expected skills.scan_report to be upgraded to jsonb on PostgreSQL")
	}
	var def *string
	if err := db.Raw(`SELECT column_default FROM information_schema.columns
		WHERE table_name = 'skills' AND column_name = 'scan_report'`).Scan(&def).Error; err != nil {
		t.Fatal(err)
	}
	if def != nil {
		t.Errorf("scan_report must have no default (NULL = never scanned), got %q", *def)
	}
}

// TestMigrateSkillVersions_PG_VariablesSchemaIsJSONB is the mirror check for the
// prompt-template column: array-shaped, so it DOES get the '[]' default.
func TestMigrateSkillVersions_PG_VariablesSchemaIsJSONB(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatal(err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatal(err)
	}
	isJSONB, err := isPGColumnJSONB(db, "skill_versions", "variables_schema")
	if err != nil {
		t.Fatal(err)
	}
	if !isJSONB {
		t.Error("expected skill_versions.variables_schema to be upgraded to jsonb")
	}
}

// TestMigrateSkills_PG_IdempotentWithExistingRows strengthens the existing
// TestMigrateSkills_PG_Idempotent above, which converges on an empty database.
// Every master-node boot re-runs these migrations against live data, and the
// creator columns added by P1 are the first ones with a backfill step — so
// "converges" has to mean "and the rows are still there". SQLite cannot run this
// at all (see TestMigrateSkills_SQLite_RestartIsBroken).
func TestMigrateSkills_PG_IdempotentWithExistingRows(t *testing.T) {
	db := openPGDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("first run: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("first run (versions): %v", err)
	}
	s := validSkill("pg-idempotent")
	if err := db.Create(&s).Error; err != nil {
		t.Fatal(err)
	}
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("second run: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("second run (versions): %v", err)
	}
	var count int64
	if err := db.Model(&Skill{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("expected the row to survive a second migration, got %d", count)
	}
}
