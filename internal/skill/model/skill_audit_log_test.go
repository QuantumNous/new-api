package skillmodel

import "testing"

func TestMigrateSkillAuditLog_SQLite_SucceedsFromEmptyDB(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions: %v", err)
	}
	if err := MigrateSkillAuditLog(db); err != nil {
		t.Fatalf("MigrateSkillAuditLog on empty SQLite DB: %v", err)
	}
	if !db.Migrator().HasTable(&SkillAuditLog{}) {
		t.Fatal("skill_audit_log table must exist after MigrateSkillAuditLog")
	}
}

func TestSkillAuditLog_InsertSanitizedValues_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	skill := createSkillForVersionTest(t, db, "audit-log")
	if err := MigrateSkillAuditLog(db); err != nil {
		t.Fatalf("MigrateSkillAuditLog: %v", err)
	}
	version := validSkillVersion(skill.ID, 1)
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create skill version: %v", err)
	}

	changed := SkillJSONB(`["instruction_template_sha256"]`)
	after := SkillJSONB(`{"instruction_template_sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}`)
	row := SkillAuditLog{
		SkillID:        &skill.ID,
		SkillVersionID: &version.ID,
		ActorID:        1,
		ActorRole:      "100",
		Action:         "version_created",
		ChangedFields:  changed,
		AfterValue:     &after,
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatalf("create audit log: %v", err)
	}
	if row.ID == "" {
		t.Fatal("audit log ID must be set after create")
	}

	var got SkillAuditLog
	if err := db.First(&got, "id = ?", row.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.Action != "version_created" {
		t.Fatalf("unexpected action %q", got.Action)
	}
	if string(*got.AfterValue) != string(after) {
		t.Fatalf("unexpected after_value %s", string(*got.AfterValue))
	}
}
