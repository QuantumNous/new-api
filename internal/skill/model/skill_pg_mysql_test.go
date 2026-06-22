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
