package model

import "testing"

func TestAffiliateSidecarTableNames(t *testing.T) {
	expected := []string{
		"affiliate_profiles",
		"affiliate_relations",
		"affiliate_invite_events",
		"affiliate_audit_logs",
		"affiliate_rule_sets",
		"affiliate_commission_rules",
		"affiliate_commission_tiers",
		"affiliate_kpi_tiers",
		"affiliate_head_fee_rules",
		"affiliate_risk_rules",
		"affiliate_commission_events",
		"affiliate_head_fee_events",
		"affiliate_kpi_snapshots",
		"affiliate_settlements",
		"affiliate_config_audit_logs",
	}

	actual := AffiliateSidecarTableNames()
	if len(actual) != len(expected) {
		t.Fatalf("expected %d affiliate tables, got %d: %v", len(expected), len(actual), actual)
	}

	seen := map[string]bool{}
	for i, name := range actual {
		if name != expected[i] {
			t.Fatalf("table %d mismatch: expected %q, got %q", i, expected[i], name)
		}
		if len(name) < len("affiliate_") || name[:len("affiliate_")] != "affiliate_" {
			t.Fatalf("table %d does not use affiliate_ prefix: %q", i, name)
		}
		if seen[name] {
			t.Fatalf("duplicate affiliate table name: %q", name)
		}
		seen[name] = true
	}
}

func TestAffiliateSidecarModelsMatchTableNames(t *testing.T) {
	models := AffiliateSidecarModels()
	names := AffiliateSidecarTableNames()
	if len(models) != len(names) {
		t.Fatalf("model count %d does not match table name count %d", len(models), len(names))
	}
}
