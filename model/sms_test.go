package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestSMSSidecarModelsMigrateSendLogs(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(SMSSidecarModels()...); err != nil {
		t.Fatalf("migrate sms sidecar models: %v", err)
	}
	if !db.Migrator().HasTable("sms_send_logs") {
		t.Fatal("expected sms_send_logs table")
	}
	for _, column := range []string{"phone_masked", "scene", "provider", "template_version", "provider_code", "duration_ms", "created_at"} {
		if !db.Migrator().HasColumn(&SMSSendLog{}, column) {
			t.Fatalf("expected sms_send_logs.%s column", column)
		}
	}
}

func TestSMSSidecarModelsMigrateUserPhoneBindings(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(SMSSidecarModels()...); err != nil {
		t.Fatalf("migrate sms sidecar models: %v", err)
	}
	if !db.Migrator().HasTable("user_phone_bindings") {
		t.Fatal("expected user_phone_bindings table")
	}
	for _, column := range []string{"user_id", "phone_hash", "phone_masked", "status", "provider", "verified_at", "bound_at", "unbound_at", "created_at", "updated_at", "deleted_at"} {
		if !db.Migrator().HasColumn(&UserPhoneBinding{}, column) {
			t.Fatalf("expected user_phone_bindings.%s column", column)
		}
	}
}

func TestSMSSidecarModelsMigrateSMSRateLimitCounters(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(SMSSidecarModels()...); err != nil {
		t.Fatalf("migrate sms sidecar models: %v", err)
	}
	if !db.Migrator().HasTable("sms_rate_limit_counters") {
		t.Fatal("expected sms_rate_limit_counters table")
	}
	for _, column := range []string{"dimension", "scene", "rate_key_hash", "window_start", "window_seconds", "count", "expires_at", "created_at", "updated_at"} {
		if !db.Migrator().HasColumn(&SMSRateLimitCounter{}, column) {
			t.Fatalf("expected sms_rate_limit_counters.%s column", column)
		}
	}
}

func TestSMSSidecarTableNamesIncludesSMSModels(t *testing.T) {
	names := SMSSidecarTableNames()
	expected := map[string]bool{
		"sms_rate_limit_counters": false,
		"sms_send_logs":           false,
		"user_phone_bindings":     false,
	}
	for _, name := range names {
		if _, ok := expected[name]; ok {
			expected[name] = true
		}
	}
	for name, found := range expected {
		if !found {
			t.Fatalf("expected %s table name, got %+v", name, names)
		}
	}
}
