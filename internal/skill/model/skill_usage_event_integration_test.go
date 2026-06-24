package skillmodel

import (
	"strings"
	"testing"
	"time"

	enums "github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/google/uuid"
)

func TestMigrateSkillUsageEvents_SQLite_CreatesDR43Schema(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}

	if !db.Migrator().HasTable(&SkillUsageEvent{}) {
		t.Fatal("skill_usage_events table must exist after migration")
	}

	for _, col := range []string{
		"event_id",
		"event_type",
		"occurred_at",
		"user_id",
		"tenant_id",
		"session_id",
		"request_id",
		"skill_id",
		"skill_version_id",
		"first_use_key",
		"entry_point",
		"plan",
		"subscription_status",
		"persona",
		"persona_source",
		"model",
		"is_kids_session",
		"is_kids_safe_skill",
		"is_kids_exclusive_skill",
		"input_tokens",
		"output_tokens",
		"total_tokens",
		"latency_ms",
		"success",
		"failure_reason",
		"block_reason",
		"error_code",
		"timeout_occurred",
		"prompt_injection_detected",
		"safety_violation_detected",
		"metadata",
	} {
		if !db.Migrator().HasColumn(&SkillUsageEvent{}, col) {
			t.Fatalf("skill_usage_events missing column %s", col)
		}
	}

	var ddl string
	if err := db.Raw(
		`SELECT sql FROM sqlite_master WHERE type='table' AND name='skill_usage_events'`,
	).Scan(&ddl).Error; err != nil {
		t.Fatal(err)
	}
	lowerDDL := strings.ToLower(ddl)
	for _, want := range []string{
		`"entry_point"             text     not null`,
		`chk_sue_event_type`,
		`chk_sue_entry_point`,
		`chk_sue_plan`,
		`chk_sue_block_reason`,
		`chk_sue_kids_privacy`,
		`chk_sue_input_tokens`,
		`chk_sue_output_tokens`,
		`chk_sue_total_tokens`,
		`chk_sue_latency_ms`,
		`chk_sue_metadata_object`,
		`chk_sue_metadata_no_restricted_keys`,
		`kids_raw_input`,
	} {
		if !strings.Contains(lowerDDL, strings.ToLower(want)) {
			t.Errorf("skill_usage_events DDL missing %q:\n%s", want, ddl)
		}
	}
}

func TestSkillUsageEvents_SQLite_ChecksEnforced(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}

	insert := func(eventID string, eventType any, entryPoint any, plan any, blockReason any, inputTokens any, outputTokens any, totalTokens any, latencyMS any, metadata string) error {
		return db.Exec(
			`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, plan, block_reason, input_tokens, output_tokens, total_tokens, latency_ms, metadata)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			eventID, eventType, testTS, entryPoint, plan, blockReason, inputTokens, outputTokens, totalTokens, latencyMS, metadata,
		).Error
	}

	if err := insert("ok", "skill_used", "skill_detail", "free", nil, 0, 0, 0, 0, `{}`); err != nil {
		t.Fatalf("valid usage event must insert: %v", err)
	}
	if err := insert("bad-event-type", "skill_Used", "skill_detail", "free", nil, 0, 0, 0, 0, `{}`); err == nil {
		t.Error("event_type enum CHECK must be enforced")
	}
	if err := insert("missing-entry", "skill_used", nil, "free", nil, 0, 0, 0, 0, `{}`); err == nil {
		t.Error("entry_point NOT NULL must be enforced")
	}
	if err := insert("bad-entry-point", "skill_used", "skill_Detail", "free", nil, 0, 0, 0, 0, `{}`); err == nil {
		t.Error("entry_point enum CHECK must be enforced")
	}
	if err := insert("bad-plan", "skill_used", "skill_detail", "gold", nil, 0, 0, 0, 0, `{}`); err == nil {
		t.Error("plan enum CHECK must be enforced")
	}
	if err := insert("bad-block-reason", "skill_used", "skill_detail", "free", "skill_plan_required", 0, 0, 0, 0, `{}`); err == nil {
		t.Error("block_reason enum CHECK must be enforced")
	}
	if err := insert("bad-input-tokens", "skill_used", "skill_detail", "free", nil, -1, 0, 0, 0, `{}`); err == nil {
		t.Error("input_tokens >= 0 CHECK must be enforced")
	}
	if err := insert("bad-output-tokens", "skill_used", "skill_detail", "free", nil, 0, -1, 0, 0, `{}`); err == nil {
		t.Error("output_tokens >= 0 CHECK must be enforced")
	}
	if err := insert("bad-total-tokens", "skill_used", "skill_detail", "free", nil, 0, 0, -1, 0, `{}`); err == nil {
		t.Error("total_tokens >= 0 CHECK must be enforced")
	}
	if err := insert("bad-latency", "skill_used", "skill_detail", "free", nil, 0, 0, 0, -1, `{}`); err == nil {
		t.Error("latency_ms >= 0 CHECK must be enforced")
	}
	if err := insert("bad-metadata-array", "skill_used", "skill_detail", "free", nil, 0, 0, 0, 0, `[]`); err == nil {
		t.Error("metadata object CHECK must be enforced")
	}
	if err := insert("bad-metadata-json", "skill_used", "skill_detail", "free", nil, 0, 0, 0, 0, `{`); err == nil {
		t.Error("metadata valid JSON CHECK must be enforced")
	}
	if err := insert("bad-metadata", "skill_used", "skill_detail", "free", nil, 0, 0, 0, 0, `{"kids_raw_input":"nope"}`); err == nil {
		t.Error("metadata restricted-key CHECK must be enforced")
	}
	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, is_kids_session, user_id, session_id, metadata)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"bad-kids-user-id", "skill_used", testTS, "skill_detail", true, 123, "pseudo", `{}`,
	).Error; err == nil {
		t.Error("kids privacy CHECK must reject real user_id")
	}
	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, is_kids_session, tenant_id, session_id, metadata)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"bad-kids-tenant-id", "skill_used", testTS, "skill_detail", true, 456, "pseudo", `{}`,
	).Error; err == nil {
		t.Error("kids privacy CHECK must reject real tenant_id (V1: tenant_id == user_id)")
	}
}

func TestMigrateSkillUsageEvents_SQLite_Idempotent(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("first MigrateSkillUsageEvents: %v", err)
	}
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("second MigrateSkillUsageEvents: %v", err)
	}
}

func TestMigrateSkillUsageEvents_SQLite_FirstUseKeyUniqueIndex(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	if !db.Migrator().HasColumn(&SkillUsageEvent{}, "first_use_key") {
		t.Fatal("skill_usage_events missing first_use_key column")
	}
	if !db.Migrator().HasIndex(&SkillUsageEvent{}, "idx_sue_first_use_key_unique") {
		t.Fatal("skill_usage_events missing unique first_use_key index")
	}

	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, user_id, skill_id, first_use_key, entry_point, success, metadata)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"first-use-1", "skill_first_use", testTS, 42, "skill-a", "42:skill-a", "skill_package", true, `{}`,
	).Error; err != nil {
		t.Fatalf("first first-use row must insert: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, user_id, skill_id, first_use_key, entry_point, success, metadata)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"first-use-duplicate", "skill_first_use", testTS, 42, "skill-a", "42:skill-a", "skill_package", true, `{}`,
	).Error; err == nil {
		t.Fatal("unique first_use_key index must reject duplicate first-use rows")
	}
	for _, id := range []string{"used-1", "used-2"} {
		if err := db.Exec(
			`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, user_id, skill_id, entry_point, success, metadata)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, "skill_used", testTS, 42, "skill-a", "skill_package", true, `{}`,
		).Error; err != nil {
			t.Fatalf("skill_used rows with NULL first_use_key must remain repeatable: %v", err)
		}
	}

	uid := int64(43)
	skillID := "skill-b"
	success := true
	if err := EmitSkillUsageEvent(db, SkillUsageEvent{
		EventType:  enums.SkillUsageEventTypeFirstUse,
		UserID:     &uid,
		SkillID:    &skillID,
		EntryPoint: enums.EntryPointSkillPackage,
		Success:    &success,
		Metadata:   SkillJSONB(`{}`),
	}); err != nil {
		t.Fatalf("EmitSkillUsageEvent must derive first_use_key: %v", err)
	}
	var derived SkillUsageEvent
	if err := db.Where("user_id = ? AND skill_id = ?", uid, skillID).Take(&derived).Error; err != nil {
		t.Fatalf("read derived first_use_key row: %v", err)
	}
	if derived.FirstUseKey == nil || *derived.FirstUseKey != "43:skill-b" {
		t.Fatalf("derived first_use_key = %v, want 43:skill-b", derived.FirstUseKey)
	}
}

func TestMigrateSkillUsageEvents_SQLite_AddsFirstUseKeyToExistingDR43Table(t *testing.T) {
	db := openSQLiteDB(t)
	ddlWithoutFirstUseKey := strings.Replace(
		sueCreateTableDDL("skill_usage_events"),
		"\n\t\t\"first_use_key\"           TEXT,",
		"",
		1,
	)
	if err := db.Exec(ddlWithoutFirstUseKey).Error; err != nil {
		t.Fatalf("create DR-43 table without first_use_key: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, metadata)
		 VALUES (?, ?, ?, ?, ?)`,
		"existing-dr43-row", "skill_used", testTS, "skill_detail", `{}`,
	).Error; err != nil {
		t.Fatalf("seed existing DR-43 row: %v", err)
	}

	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}

	if !db.Migrator().HasColumn(&SkillUsageEvent{}, "first_use_key") {
		t.Fatal("MigrateSkillUsageEvents must add first_use_key to existing DR-43 tables")
	}
	if !db.Migrator().HasIndex(&SkillUsageEvent{}, "idx_sue_first_use_key_unique") {
		t.Fatal("MigrateSkillUsageEvents must add first_use_key unique index to existing DR-43 tables")
	}
	var count int64
	if err := db.Raw(`SELECT COUNT(*) FROM skill_usage_events WHERE event_id = ?`, "existing-dr43-row").Scan(&count).Error; err != nil {
		t.Fatalf("count existing DR-43 row after first_use_key upgrade: %v", err)
	}
	if count != 1 {
		t.Fatalf("existing row must survive additive first_use_key migration, got %d", count)
	}
}

func TestSkillUsageEvent_BeforeCreateRejectsRestrictedMetadataKey(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}

	err := db.Create(&SkillUsageEvent{
		EventID:    uuid.New().String(),
		EventType:  "skill_used",
		OccurredAt: time.Now().UTC(),
		EntryPoint: "skill_detail",
		Metadata:   SkillJSONB(`{"safe":{"instruction_template":"blocked"}}`),
	}).Error
	if err == nil {
		t.Fatal("BeforeCreate must reject restricted metadata keys before DB insert")
	}
	if !strings.Contains(err.Error(), "instruction_template") {
		t.Fatalf("expected instruction_template error, got: %v", err)
	}
}

func TestSkillUsageEvent_KidsSessionPrivacy(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}

	uid := int64(123)
	err := db.Create(&SkillUsageEvent{
		EventID:       uuid.New().String(),
		EventType:     enums.SkillUsageEventTypeUsed,
		OccurredAt:    time.Now().UTC(),
		UserID:        &uid,
		EntryPoint:    enums.EntryPointSkillDetail,
		IsKidsSession: true,
		Metadata:      SkillJSONB(`{}`),
	}).Error
	if err == nil {
		t.Fatal("kids session analytics must reject real user_id")
	}

	pseudo, err := KidsSessionPseudoID(123, 456, "2026-06-21", []byte("daily-salt"))
	if err != nil {
		t.Fatalf("KidsSessionPseudoID: %v", err)
	}
	if len(pseudo) != 64 {
		t.Fatalf("kids pseudo id must be sha256 hex, got %q", pseudo)
	}

	// Verify app layer also rejects real tenant_id on kids sessions.
	tenantUID := int64(456)
	tenantOnlyErr := db.Create(&SkillUsageEvent{
		EventID:       uuid.New().String(),
		EventType:     enums.SkillUsageEventTypeUsed,
		OccurredAt:    time.Now().UTC(),
		TenantID:      &tenantUID,
		EntryPoint:    enums.EntryPointSkillDetail,
		IsKidsSession: true,
		SessionID:     &pseudo,
		Metadata:      SkillJSONB(`{}`),
	}).Error
	if tenantOnlyErr == nil {
		t.Fatal("kids session analytics must reject real tenant_id (V1: tenant_id == user_id)")
	}

	event := SkillUsageEvent{
		EventType:  enums.SkillUsageEventTypeUsed,
		EntryPoint: enums.EntryPointSkillDetail,
		Metadata:   SkillJSONB(`{}`),
	}
	if err := event.ApplyKidsSessionAnalyticsIdentity(123, 456, "2026-06-21", []byte("daily-salt")); err != nil {
		t.Fatalf("ApplyKidsSessionAnalyticsIdentity: %v", err)
	}
	if event.UserID != nil {
		t.Fatal("ApplyKidsSessionAnalyticsIdentity must clear real user_id")
	}
	if event.TenantID != nil {
		t.Fatal("ApplyKidsSessionAnalyticsIdentity must clear tenant_id (V1: tenant_id == user_id)")
	}
	if event.SessionID == nil || *event.SessionID != pseudo {
		t.Fatal("ApplyKidsSessionAnalyticsIdentity must set HMAC session_id")
	}
	if err := EmitSkillUsageEvent(db, event); err != nil {
		t.Fatalf("kids-safe event should insert: %v", err)
	}
}

func TestEmitSkillUsageEvent_ValidatesEnums(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}

	base := func() SkillUsageEvent {
		return SkillUsageEvent{
			EventType:  enums.SkillUsageEventTypeUsed,
			EntryPoint: enums.EntryPointSkillDetail,
			Metadata:   SkillJSONB(`{}`),
		}
	}

	badEventType := base()
	badEventType.EventType = enums.SkillUsageEventType("skill_Used")
	if err := EmitSkillUsageEvent(db, badEventType); err == nil {
		t.Fatal("EmitSkillUsageEvent must reject invalid event_type")
	}

	badEntryPoint := base()
	badEntryPoint.EntryPoint = enums.EntryPoint("skill_Detail")
	if err := EmitSkillUsageEvent(db, badEntryPoint); err == nil {
		t.Fatal("EmitSkillUsageEvent must reject invalid entry_point")
	}

	badPlan := base()
	plan := enums.RequiredPlan("gold")
	badPlan.Plan = &plan
	if err := EmitSkillUsageEvent(db, badPlan); err == nil {
		t.Fatal("EmitSkillUsageEvent must reject invalid plan")
	}

	badBlockReason := base()
	blockReason := enums.BlockReason("skill_plan_required")
	badBlockReason.BlockReason = &blockReason
	if err := EmitSkillUsageEvent(db, badBlockReason); err == nil {
		t.Fatal("EmitSkillUsageEvent must reject invalid block_reason")
	}
}

// TestMigrateSkillUsageEvents_SQLite_UpgradesPreDR43Table verifies that
// MigrateSkillUsageEvents upgrades an existing pre-DR-43 skill_usage_events table.
//
// Detection: upgradeSUETableSQLite looks for "chk_sue_kids_privacy" in the stored
// DDL. Tables lacking it are rebuilt by rebuildSUETableSQLite, which creates a new
// table with the full DR-43 schema, copies existing rows (absent columns receive
// their DR-43 defaults), then renames the table. All steps run in a transaction so
// a failure leaves the original table intact.
func TestMigrateSkillUsageEvents_SQLite_UpgradesPreDR43Table(t *testing.T) {
	db := openSQLiteDB(t)

	// Create a minimal pre-DR-43 schema: no chk_sue_kids_privacy, no tenant_id,
	// no metadata, no is_kids_safe_skill / is_kids_exclusive_skill, no safety columns.
	const preDR43DDL = `CREATE TABLE "skill_usage_events" (
		"event_id"         TEXT     NOT NULL,
		"event_type"       TEXT     NOT NULL,
		"occurred_at"      DATETIME NOT NULL,
		"user_id"          INTEGER,
		"session_id"       TEXT,
		"request_id"       TEXT,
		"skill_id"         TEXT,
		"skill_version_id" TEXT,
		"entry_point"      TEXT     NOT NULL,
		"plan"             TEXT,
		"model"            TEXT,
		"is_kids_session"  INTEGER  NOT NULL DEFAULT 0,
		"input_tokens"     INTEGER,
		"output_tokens"    INTEGER,
		"total_tokens"     INTEGER,
		"latency_ms"       INTEGER,
		"success"          INTEGER,
		"failure_reason"   TEXT,
		"block_reason"     TEXT,
		"error_code"       TEXT,
		PRIMARY KEY ("event_id")
	)`
	if err := db.Exec(preDR43DDL).Error; err != nil {
		t.Fatalf("create pre-DR-43 skill_usage_events: %v", err)
	}
	// Seed a row in the old schema; it must survive the rebuild.
	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, is_kids_session)
		 VALUES (?, ?, ?, ?, ?)`,
		"pre-dr43-row", "skill_used", testTS, "skill_detail", 0,
	).Error; err != nil {
		t.Fatalf("seed pre-DR-43 row: %v", err)
	}

	// Run the migration — must succeed without error.
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents upgrade: %v", err)
	}

	// All DR-43 columns must now exist.
	for _, col := range sueAllDR43Columns {
		if !db.Migrator().HasColumn(&SkillUsageEvent{}, col) {
			t.Errorf("column %q missing after upgrade", col)
		}
	}

	// All required indexes must exist.
	for _, name := range []string{
		"idx_sue_event_time",
		"idx_sue_user_skill",
		"idx_sue_entry_time",
		"idx_usage_skill_time",
		"idx_usage_user_time",
		"idx_usage_plan_persona_time",
		"idx_usage_request_id",
		"idx_sue_first_use_key_unique",
	} {
		if !db.Migrator().HasIndex(&SkillUsageEvent{}, name) {
			t.Errorf("index %q missing after upgrade", name)
		}
	}

	// DR-43 CHECK constraints must appear in the rebuilt DDL.
	var ddl string
	if err := db.Raw(
		`SELECT sql FROM sqlite_master WHERE type='table' AND name='skill_usage_events'`,
	).Scan(&ddl).Error; err != nil {
		t.Fatal(err)
	}
	lowerDDL := strings.ToLower(ddl)
	for _, want := range []string{
		"chk_sue_kids_privacy",
		"chk_sue_metadata_object",
		"chk_sue_metadata_no_restricted_keys",
		"chk_sue_event_type",
		"chk_sue_entry_point",
	} {
		if !strings.Contains(lowerDDL, want) {
			t.Errorf("DDL missing constraint %q after upgrade:\n%s", want, ddl)
		}
	}

	// The pre-DR-43 row must survive the rebuild.
	var count int64
	if err := db.Raw(`SELECT COUNT(*) FROM skill_usage_events WHERE event_id = ?`, "pre-dr43-row").Scan(&count).Error; err != nil {
		t.Fatalf("count pre-DR-43 row after upgrade: %v", err)
	}
	if count != 1 {
		t.Errorf("pre-DR-43 row must survive rebuild, got count=%d", count)
	}

	// Application-level Kids privacy guard must still reject real user_id via ORM.
	uid := int64(999)
	if err := db.Create(&SkillUsageEvent{
		EventID:       uuid.New().String(),
		EventType:     enums.SkillUsageEventTypeUsed,
		OccurredAt:    time.Now().UTC(),
		UserID:        &uid,
		EntryPoint:    enums.EntryPointSkillDetail,
		IsKidsSession: true,
		Metadata:      SkillJSONB(`{}`),
	}).Error; err == nil {
		t.Fatal("kids privacy guard must reject real user_id via ORM after upgrade")
	}

	// Application-level metadata guard must still reject restricted keys via ORM.
	if err := db.Create(&SkillUsageEvent{
		EventID:    uuid.New().String(),
		EventType:  enums.SkillUsageEventTypeUsed,
		OccurredAt: time.Now().UTC(),
		EntryPoint: enums.EntryPointSkillDetail,
		Metadata:   SkillJSONB(`{"instruction_template":"blocked"}`),
	}).Error; err == nil {
		t.Fatal("metadata guard must reject restricted key 'instruction_template' via ORM after upgrade")
	}

	// DB-level chk_sue_kids_privacy must reject real user_id in kids session via raw SQL.
	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, is_kids_session, user_id, session_id, metadata)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"db-chk-kids-uid", "skill_used", testTS, "skill_detail", 1, 123, "pseudo", `{}`,
	).Error; err == nil {
		t.Error("DB chk_sue_kids_privacy must reject real user_id in kids session after upgrade")
	}

	// DB-level chk_sue_metadata_no_restricted_keys must reject top-level restricted key via raw SQL.
	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, metadata)
		 VALUES (?, ?, ?, ?, ?)`,
		"db-chk-meta", "skill_used", testTS, "skill_detail", `{"prompt":"blocked"}`,
	).Error; err == nil {
		t.Error("DB chk_sue_metadata_no_restricted_keys must reject top-level restricted key after upgrade")
	}

	// DB-level chk_sue_event_type must reject an invalid enum value via raw SQL.
	if err := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, metadata)
		 VALUES (?, ?, ?, ?, ?)`,
		"db-chk-evtype", "SKILL_USED", testTS, "skill_detail", `{}`,
	).Error; err == nil {
		t.Error("DB chk_sue_event_type must reject invalid event_type after upgrade")
	}
}

// TestSUEMetadataDBConstraintTopLevelOnly documents the boundary between the
// application-layer and DB-layer metadata key enforcement.
//
// The DB CHECK constraint (chk_sue_metadata_no_restricted_keys) uses json_extract
// with top-level JSON paths ($.key) and cannot recursively inspect nested objects.
// Direct SQL can therefore insert metadata like {"safe":{"prompt":"..."}} without
// triggering the constraint.
//
// The APPLICATION write path (BeforeCreate → validateSUEEventMetadata →
// jsonContainsRestrictedMetadataKey) is the authoritative recursive guard and
// always executes before the DB constraint via the GORM BeforeCreate hook.
func TestSUEMetadataDBConstraintTopLevelOnly(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}

	// Application layer catches nested restricted keys before they reach the DB.
	ormErr := db.Create(&SkillUsageEvent{
		EventID:    uuid.New().String(),
		EventType:  enums.SkillUsageEventTypeUsed,
		OccurredAt: time.Now().UTC(),
		EntryPoint: enums.EntryPointSkillDetail,
		Metadata:   SkillJSONB(`{"safe":{"prompt":"nested restricted key"}}`),
	}).Error
	if ormErr == nil {
		t.Fatal("application BeforeCreate must reject nested restricted metadata key")
	}
	if !strings.Contains(ormErr.Error(), "prompt") {
		t.Fatalf("expected error mentioning restricted key, got: %v", ormErr)
	}

	// DB CHECK constraint is top-level only: direct SQL with a nested restricted key
	// succeeds because json_extract('$.prompt') evaluates to NULL (key not at root).
	// This is a documented limitation; the application write path is authoritative.
	sqlErr := db.Exec(
		`INSERT INTO skill_usage_events (event_id, event_type, occurred_at, entry_point, metadata)
		 VALUES (?, ?, ?, ?, ?)`,
		uuid.New().String(), "skill_used", testTS, "skill_detail",
		`{"safe":{"prompt":"nested restricted key bypasses DB CHECK — app layer is the guard"}}`,
	).Error
	if sqlErr != nil {
		t.Errorf("unexpected: DB rejected nested restricted key (constraint stricter than documented): %v", sqlErr)
	}
}
