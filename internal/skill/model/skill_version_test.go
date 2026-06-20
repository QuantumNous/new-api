package skillmodel

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/google/uuid"
)

func TestMigrateSkillVersions_SQLite_SucceedsFromEmptyDB(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions on empty SQLite DB: %v", err)
	}
}

func TestComputeTemplateSHA256_Stable(t *testing.T) {
	a := ComputeTemplateSHA256("hello world")
	b := ComputeTemplateSHA256("hello world")
	if a != b {
		t.Fatal("sha256 must be deterministic")
	}
	if len(a) != 64 {
		t.Fatalf("sha256 hex must be 64 chars, got %d", len(a))
	}
	if a == ComputeTemplateSHA256("hello world!") {
		t.Fatal("different input must produce different sha")
	}
}

func TestSkillVersion_BeforeCreate_DefaultsAndSha(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions: %v", err)
	}

	skillID := uuid.New().String()
	v := SkillVersion{
		SkillID:              skillID,
		VersionNumber:        1,
		Status:               enums.SkillVersionStatusDraft,
		InstructionTemplate:  "do the thing",
		RequiredPlanSnapshot: "free",
		CreatedBy:            1,
		// OutputSchema, ModelWhitelistSnapshot, MonetizationSnapshot, sha left empty
	}
	if err := db.Create(&v).Error; err != nil {
		t.Fatalf("create version: %v", err)
	}
	if v.ID == "" {
		t.Fatal("BeforeCreate should assign an id")
	}
	if v.InstructionTemplateSHA256 != ComputeTemplateSHA256("do the thing") {
		t.Fatal("BeforeCreate should compute sha when empty")
	}

	var got SkillVersion
	if err := db.Where("id = ?", v.ID).First(&got).Error; err != nil {
		t.Fatalf("reload: %v", err)
	}
	if string(got.OutputSchema) != "{}" {
		t.Fatalf("empty object column should default to {}, got %q", string(got.OutputSchema))
	}
	if string(got.MonetizationSnapshot) != "{}" {
		t.Fatalf("empty monetization snapshot should default to {}, got %q", string(got.MonetizationSnapshot))
	}
	if string(got.ModelWhitelistSnapshot) != "[]" {
		t.Fatalf("empty whitelist snapshot should default to [], got %q", string(got.ModelWhitelistSnapshot))
	}
}

func TestSkillVersion_OneActivePerSkill_SQLite(t *testing.T) {
	db := openSQLiteDB(t)
	if err := MigrateSkills(db); err != nil {
		t.Fatalf("MigrateSkills: %v", err)
	}
	if err := MigrateSkillVersions(db); err != nil {
		t.Fatalf("MigrateSkillVersions: %v", err)
	}

	skillID := uuid.New().String()
	mk := func(num int) *SkillVersion {
		return &SkillVersion{
			SkillID:              skillID,
			VersionNumber:        num,
			Status:               enums.SkillVersionStatusActive,
			InstructionTemplate:  "t",
			RequiredPlanSnapshot: "free",
			CreatedBy:            1,
		}
	}
	if err := db.Create(mk(1)).Error; err != nil {
		t.Fatalf("first active version: %v", err)
	}
	// Second active version for the same skill must violate the partial unique index.
	if err := db.Create(mk(2)).Error; err == nil {
		t.Fatal("expected a unique-violation creating a second active version for the same skill")
	}
}

func TestMonetizationSnapshotJSON(t *testing.T) {
	quota := 100
	out := MonetizationSnapshotJSON("token_markup", 1.5, &quota)
	s := string(out)
	if !contains(s, "token_markup") || !contains(s, "1.5") || !contains(s, "100") {
		t.Fatalf("snapshot missing fields: %s", s)
	}
	out2 := MonetizationSnapshotJSON("free", 0, nil)
	if contains(string(out2), "free_quota_per_month") {
		t.Fatalf("nil quota should be omitted, got %s", string(out2))
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
