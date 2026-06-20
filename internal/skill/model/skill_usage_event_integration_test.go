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
		"bad-kids-privacy", "skill_used", testTS, "skill_detail", true, 123, "pseudo", `{}`,
	).Error; err == nil {
		t.Error("kids privacy CHECK must reject real user_id")
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
