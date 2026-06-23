package skillmodel

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	enums "github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DR-74: every skill_usage_events row must carry metadata.schema_version="1.0" (V1
// strict) and a server-authoritative UTC occurred_at. Both invariants are enforced in
// BeforeCreate so they hold for every write path.

func readBackSUE(t *testing.T, db *gorm.DB, eventID string) SkillUsageEvent {
	t.Helper()
	var got SkillUsageEvent
	if err := db.First(&got, "event_id = ?", eventID).Error; err != nil {
		t.Fatalf("read back event %s: %v", eventID, err)
	}
	return got
}

func metadataSchemaVersion(t *testing.T, meta SkillJSONB) (string, bool) {
	t.Helper()
	var obj map[string]any
	if err := common.Unmarshal(meta, &obj); err != nil {
		t.Fatalf("unmarshal metadata %q: %v", string(meta), err)
	}
	v, ok := obj["schema_version"].(string)
	return v, ok
}

// --- schema_version stamped on every write path ---

func TestSUE_DR74_SchemaVersionStamped_DirectCreate(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	id := uuid.New().String()
	if err := db.Create(&SkillUsageEvent{
		EventID:    id,
		EventType:  enums.SkillUsageEventTypeImpression,
		EntryPoint: enums.EntryPointMarketplaceCard,
		Metadata:   SkillJSONB(`{}`),
	}).Error; err != nil {
		t.Fatalf("create: %v", err)
	}
	got := readBackSUE(t, db, id)
	sv, ok := metadataSchemaVersion(t, got.Metadata)
	if !ok || sv != SkillEventSchemaVersion {
		t.Fatalf("metadata.schema_version = %q (present=%v), want %q", sv, ok, SkillEventSchemaVersion)
	}
}

func TestSUE_DR74_SchemaVersionStamped_EmitSkillUsageEvent(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	id := uuid.New().String()
	if err := EmitSkillUsageEvent(db, SkillUsageEvent{
		EventID:    id,
		EventType:  enums.SkillUsageEventTypeUsed,
		EntryPoint: enums.EntryPointSkillDetail,
		Metadata:   SkillJSONB(`{}`),
	}); err != nil {
		t.Fatalf("EmitSkillUsageEvent: %v", err)
	}
	got := readBackSUE(t, db, id)
	if sv, ok := metadataSchemaVersion(t, got.Metadata); !ok || sv != SkillEventSchemaVersion {
		t.Fatalf("schema_version = %q (present=%v), want %q", sv, ok, SkillEventSchemaVersion)
	}
}

func TestSUE_DR74_SchemaVersionStamped_EmitSkillEnabled(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	if err := EmitSkillEnabled(db, 7, uuid.New().String(), nil, string(enums.EntryPointMarketplaceCard), "free"); err != nil {
		t.Fatalf("EmitSkillEnabled: %v", err)
	}
	var got SkillUsageEvent
	if err := db.First(&got, "event_type = ?", enums.SkillUsageEventTypeEnabled).Error; err != nil {
		t.Fatalf("read back enabled event: %v", err)
	}
	if sv, ok := metadataSchemaVersion(t, got.Metadata); !ok || sv != SkillEventSchemaVersion {
		t.Fatalf("schema_version = %q (present=%v), want %q", sv, ok, SkillEventSchemaVersion)
	}
}

// --- schema_version V1 strict validation ---

func TestSUE_DR74_SchemaVersion_ExplicitV1Kept(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	id := uuid.New().String()
	if err := db.Create(&SkillUsageEvent{
		EventID:    id,
		EventType:  enums.SkillUsageEventTypeImpression,
		EntryPoint: enums.EntryPointMarketplaceCard,
		Metadata:   SkillJSONB(`{"schema_version":"1.0","producer":"frontend"}`),
	}).Error; err != nil {
		t.Fatalf("create with explicit 1.0 must succeed: %v", err)
	}
	got := readBackSUE(t, db, id)
	if sv, ok := metadataSchemaVersion(t, got.Metadata); !ok || sv != "1.0" {
		t.Fatalf("schema_version = %q (present=%v), want 1.0", sv, ok)
	}
}

func TestSUE_DR74_SchemaVersion_NonV1Rejected(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	for _, meta := range []string{
		`{"schema_version":"2.0"}`, // wrong version
		`{"schema_version":""}`,    // empty string
		`{"schema_version":3}`,     // non-string
	} {
		err := db.Create(&SkillUsageEvent{
			EventID:    uuid.New().String(),
			EventType:  enums.SkillUsageEventTypeImpression,
			EntryPoint: enums.EntryPointMarketplaceCard,
			Metadata:   SkillJSONB(meta),
		}).Error
		if err == nil {
			t.Fatalf("metadata %s must be rejected (V1 strict schema_version)", meta)
		}
	}
}

func TestSUE_DR74_RestrictedKeyStillRejected_WithSchemaVersion(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	err := db.Create(&SkillUsageEvent{
		EventID:    uuid.New().String(),
		EventType:  enums.SkillUsageEventTypeImpression,
		EntryPoint: enums.EntryPointMarketplaceCard,
		Metadata:   SkillJSONB(`{"schema_version":"1.0","prompt":"leak"}`),
	}).Error
	if err == nil {
		t.Fatal("restricted-key guard must still reject even with a valid schema_version")
	}
}

// --- occurred_at server-authoritative UTC ---

func TestSUE_DR74_OccurredAt_NormalizedToUTC(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	plus8 := time.FixedZone("UTC+8", 8*3600)
	local := time.Date(2026, 6, 15, 10, 20, 0, 0, plus8) // 02:20:00Z
	wantUTC := local.UTC()
	id := uuid.New().String()
	if err := db.Create(&SkillUsageEvent{
		EventID:    id,
		EventType:  enums.SkillUsageEventTypeUsed,
		EntryPoint: enums.EntryPointSkillDetail,
		OccurredAt: local,
		Metadata:   SkillJSONB(`{}`),
	}).Error; err != nil {
		t.Fatalf("create: %v", err)
	}
	got := readBackSUE(t, db, id)
	// Stable cross-DB assertions: the persisted instant equals the UTC equivalent,
	// and the stored value is its own UTC (no offset baked in). Location() pointer is
	// intentionally NOT relied on (driver read-back varies across SQLite/MySQL/PG).
	if !got.OccurredAt.Equal(wantUTC) {
		t.Fatalf("occurred_at instant = %v, want %v", got.OccurredAt, wantUTC)
	}
	if !got.OccurredAt.UTC().Equal(got.OccurredAt) {
		t.Fatalf("occurred_at not stored as UTC: %v", got.OccurredAt)
	}
}

func TestSUE_DR74_OccurredAt_ZeroDefaultsToNowUTC(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	before := time.Now().UTC().Add(-time.Second)
	id := uuid.New().String()
	// Direct create with zero OccurredAt -> BeforeCreate must set now (UTC).
	if err := db.Create(&SkillUsageEvent{
		EventID:    id,
		EventType:  enums.SkillUsageEventTypeImpression,
		EntryPoint: enums.EntryPointMarketplaceCard,
		Metadata:   SkillJSONB(`{}`),
	}).Error; err != nil {
		t.Fatalf("create: %v", err)
	}
	got := readBackSUE(t, db, id)
	if got.OccurredAt.IsZero() {
		t.Fatal("zero OccurredAt must be defaulted to now")
	}
	if got.OccurredAt.Before(before) {
		t.Fatalf("defaulted occurred_at %v is before test start %v", got.OccurredAt, before)
	}
	if !got.OccurredAt.UTC().Equal(got.OccurredAt) {
		t.Fatalf("defaulted occurred_at not UTC: %v", got.OccurredAt)
	}
}

func TestSUE_DR74_OccurredAt_NonZeroUTCPreserved(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkillUsageEvents(db); err != nil {
		t.Fatalf("MigrateSkillUsageEvents: %v", err)
	}
	want := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	id := uuid.New().String()
	if err := db.Create(&SkillUsageEvent{
		EventID:    id,
		EventType:  enums.SkillUsageEventTypeUsed,
		EntryPoint: enums.EntryPointSkillDetail,
		OccurredAt: want,
		Metadata:   SkillJSONB(`{}`),
	}).Error; err != nil {
		t.Fatalf("create: %v", err)
	}
	got := readBackSUE(t, db, id)
	if !got.OccurredAt.Equal(want) {
		t.Fatalf("occurred_at = %v, want preserved %v (not replaced by now)", got.OccurredAt, want)
	}
}
