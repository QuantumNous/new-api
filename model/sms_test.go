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

func TestSMSSidecarTableNamesIncludesSendLogs(t *testing.T) {
	names := SMSSidecarTableNames()
	for _, name := range names {
		if name == "sms_send_logs" {
			return
		}
	}
	t.Fatalf("expected sms_send_logs table name, got %+v", names)
}
