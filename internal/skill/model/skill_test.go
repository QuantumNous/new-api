package skillmodel

import (
	"strings"
	"testing"

	enums "github.com/QuantumNous/new-api/internal/skill/enums"
	"gorm.io/gorm"
)

// Phase 4: unit tests - no DB required.

func TestTableName(t *testing.T) {
	s := Skill{}
	if s.TableName() != "skills" {
		t.Fatal("TableName() must return 'skills'")
	}
}

func TestSkillVersionTableName(t *testing.T) {
	v := SkillVersion{}
	if v.TableName() != "skill_versions" {
		t.Fatal("TableName() must return 'skill_versions'")
	}
}

func TestBeforeCreate_UUID(t *testing.T) {
	s := &Skill{}
	if err := s.BeforeCreate(&gorm.DB{}); err != nil {
		t.Fatal(err)
	}
	if len(s.ID) != 36 {
		t.Fatalf("expected 36-char UUID, got %q (len=%d)", s.ID, len(s.ID))
	}
	parts := strings.Split(s.ID, "-")
	if len(parts) != 5 {
		t.Fatalf("expected UUID with 4 hyphens, got %q", s.ID)
	}
}

func TestSkillVersionBeforeCreate_UUID(t *testing.T) {
	v := &SkillVersion{}
	if err := v.BeforeCreate(&gorm.DB{}); err != nil {
		t.Fatal(err)
	}
	if len(v.ID) != 36 {
		t.Fatalf("expected 36-char UUID, got %q (len=%d)", v.ID, len(v.ID))
	}
	parts := strings.Split(v.ID, "-")
	if len(parts) != 5 {
		t.Fatalf("expected UUID with 4 hyphens, got %q", v.ID)
	}
}

func TestSkillVersionBeforeCreate_NormalizesJSONFields(t *testing.T) {
	v := &SkillVersion{}
	if err := v.BeforeCreate(&gorm.DB{}); err != nil {
		t.Fatal(err)
	}
	// output_schema: nullable per PRD §4.2; nil input must stay nil (NULL in DB = no schema).
	if v.OutputSchema != nil {
		t.Errorf("OutputSchema: expected nil (NULL), got %q", string(*v.OutputSchema))
	}
	// model_whitelist_snapshot: array shape, normalized to [].
	if string(v.ModelWhitelistSnapshot) != "[]" {
		t.Errorf("ModelWhitelistSnapshot: expected '[]', got %q", string(v.ModelWhitelistSnapshot))
	}
	// monetization_snapshot: object shape per PRD §4.2, normalized to {}.
	if string(v.MonetizationSnapshot) != "{}" {
		t.Errorf("MonetizationSnapshot: expected '{}', got %q", string(v.MonetizationSnapshot))
	}
	// sentinel: make sure the old wrong default [] is not present for monetization
	if string(v.MonetizationSnapshot) == "[]" {
		t.Errorf("MonetizationSnapshot must NOT be '[]' — it is an object, not an array")
	}
}

func TestBeforeCreate_PresetID(t *testing.T) {
	preset := "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
	s := &Skill{ID: preset}
	if err := s.BeforeCreate(&gorm.DB{}); err != nil {
		t.Fatal(err)
	}
	if s.ID != preset {
		t.Fatalf("BeforeCreate must not overwrite preset ID; got %q", s.ID)
	}
}

func TestBeforeCreate_NormalizesJSONFields(t *testing.T) {
	s := &Skill{} // all JSON fields zero
	if err := s.BeforeCreate(&gorm.DB{}); err != nil {
		t.Fatal(err)
	}
	for name, field := range map[string]SkillJSONB{
		"Tags":           s.Tags,
		"InputHints":     s.InputHints,
		"ExampleInputs":  s.ExampleInputs,
		"ExampleOutputs": s.ExampleOutputs,
		"ModelWhitelist": s.ModelWhitelist,
	} {
		if string(field) != "[]" {
			t.Errorf("%s: expected '[]', got %q", name, string(field))
		}
	}
}

func TestSkillJSONB_Empty_Value(t *testing.T) {
	var j SkillJSONB
	v, err := j.Value()
	if err != nil {
		t.Fatal(err)
	}
	if v != "[]" {
		t.Fatalf("expected '[]', got %v", v)
	}
}

func TestSkillJSONB_Empty_Scan(t *testing.T) {
	var j SkillJSONB
	if err := j.Scan(nil); err != nil {
		t.Fatal(err)
	}
	if string(j) != "[]" {
		t.Fatalf("expected '[]', got %q", string(j))
	}
}

func TestSkillJSONB_Roundtrip(t *testing.T) {
	original := SkillJSONB(`["alpha","beta"]`)
	v, err := original.Value()
	if err != nil {
		t.Fatal(err)
	}
	var back SkillJSONB
	if err := back.Scan(v); err != nil {
		t.Fatal(err)
	}
	if string(back) != string(original) {
		t.Fatalf("roundtrip mismatch: got %q, want %q", string(back), string(original))
	}
}

func TestSkillJSONB_InvalidJSON_ValueReturnsError(t *testing.T) {
	j := SkillJSONB("not-json")
	_, err := j.Value()
	if err == nil {
		t.Fatal("expected error for invalid JSON in Value(), got nil")
	}
}

// TestSkillJSONB_Value_AllowsValidNonArrayJSON locks the V1 D6 behavior:
// Value() validates JSON syntax only — top-level shape is not enforced.
// Objects, numbers, strings, and null all pass. This is an explicit scope decision
// (DR-40 is a schema migration ticket; business payload shape belongs at the API/service layer).
func TestSkillJSONB_Value_AllowsValidNonArrayJSON(t *testing.T) {
	for _, input := range []string{`{}`, `{"key":"val"}`, `"abc"`, `123`, `true`, `null`} {
		j := SkillJSONB(input)
		if _, err := j.Value(); err != nil {
			t.Errorf("Value(%q) = error %v; want nil (D6: V1 accepts any valid JSON)", input, err)
		}
	}
}

func TestSkillJSONB_InvalidJSON_ScanReturnsError(t *testing.T) {
	var j SkillJSONB
	if err := j.Scan([]byte("not-json")); err == nil {
		t.Fatal("expected error for invalid JSON in Scan(), got nil")
	}
}

func TestNormalizeSkillJSONB_Empty(t *testing.T) {
	var j SkillJSONB
	normalizeSkillJSONB(&j)
	if string(j) != "[]" {
		t.Fatalf("expected '[]', got %q", string(j))
	}
}

func TestNormalizeSkillJSONB_NonEmpty(t *testing.T) {
	j := SkillJSONB(`["x"]`)
	normalizeSkillJSONB(&j)
	if string(j) != `["x"]` {
		t.Fatalf("normalizeSkillJSONB must not change non-empty value; got %q", string(j))
	}
}

func TestSkillJSONB_ScanString(t *testing.T) {
	var j SkillJSONB
	input := "[\"a\"]"
	if err := j.Scan(input); err != nil {
		t.Fatal(err)
	}
	want := SkillJSONB([]byte("[\"a\"]"))
	if string(j) != string(want) {
		t.Fatalf("Scan(string) mismatch: got %q, want %q", string(j), string(want))
	}
}

func TestSkillJSONB_ScanUnsupportedType(t *testing.T) {
	var j SkillJSONB
	if err := j.Scan(42); err == nil {
		t.Fatal("expected error for unsupported scan type int, got nil")
	}
}

// TestIsMySQLAtLeast8016_Versions covers the MySQL version gate for CHECK DDL in migrateSkillsConstraints.
// This proves the MySQL 5.7 skip path activates correctly without needing a live 5.7 instance.
func TestIsMySQLAtLeast8016_Versions(t *testing.T) {
	cases := []struct {
		ver  string
		want bool
	}{
		{"5.7.44-log", false},
		{"5.7.44", false},
		{"8.0.15", false},
		{"8.0.16", true},
		{"8.0.46", true},
		{"8.1.0", true},
		{"9.0.0", true},
	}
	for _, c := range cases {
		got, err := isMySQLVersionAtLeast8016(c.ver)
		if err != nil {
			t.Errorf("isMySQLVersionAtLeast8016(%q): unexpected error: %v", c.ver, err)
			continue
		}
		if got != c.want {
			t.Errorf("isMySQLVersionAtLeast8016(%q) = %v, want %v", c.ver, got, c.want)
		}
	}
}

func TestEnumDBValues_MatchCheckConstraints(t *testing.T) {
	checks := []struct {
		name string
		got  string
		want string
	}{
		{"SkillStatusDraft", string(enums.SkillStatusDraft), "draft"},
		{"SkillStatusPublished", string(enums.SkillStatusPublished), "published"},
		{"SkillStatusDeprecated", string(enums.SkillStatusDeprecated), "deprecated"},
		{"SkillStatusArchived", string(enums.SkillStatusArchived), "archived"},
		{"SkillVersionStatusDraft", string(enums.SkillVersionStatusDraft), "draft"},
		{"SkillVersionStatusActive", string(enums.SkillVersionStatusActive), "active"},
		{"SkillVersionStatusInactive", string(enums.SkillVersionStatusInactive), "inactive"},
		{"SkillVersionStatusArchived", string(enums.SkillVersionStatusArchived), "archived"},
		{"RequiredPlanFree", string(enums.RequiredPlanFree), "free"},
		{"RequiredPlanPro", string(enums.RequiredPlanPro), "pro"},
		{"RequiredPlanEnterprise", string(enums.RequiredPlanEnterprise), "enterprise"},
		{"MonetizationTypeFree", string(enums.MonetizationTypeFree), "free"},
		{"MonetizationTypePlanIncluded", string(enums.MonetizationTypePlanIncluded), "plan_included"},
		{"MonetizationTypeTokenMarkup", string(enums.MonetizationTypeTokenMarkup), "token_markup"},
		{"KidsApprovalStatusNotRequired", string(enums.KidsApprovalStatusNotRequired), "not_required"},
		{"KidsApprovalStatusPending", string(enums.KidsApprovalStatusPending), "pending"},
		{"KidsApprovalStatusApproved", string(enums.KidsApprovalStatusApproved), "approved"},
		{"KidsApprovalStatusEmergencyApproved", string(enums.KidsApprovalStatusEmergencyApproved), "emergency_approved"},
		{"KidsApprovalStatusRejected", string(enums.KidsApprovalStatusRejected), "rejected"},
		{"KidsApprovalStatusRevoked", string(enums.KidsApprovalStatusRevoked), "revoked"},
	}
	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("%s: enum value %q does not match CHECK literal %q (DR-39/DR-40 drift)", c.name, c.got, c.want)
		}
	}
}
