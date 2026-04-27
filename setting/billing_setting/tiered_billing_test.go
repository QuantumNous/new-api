package billing_setting

// Tests for the defaultBillingExpr infrastructure (Architecture B — lazy fallback).
//
// Each test mutates package-level state and restores it via t.Cleanup, so tests
// are safe to run in parallel within the package.

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const testModel = "__test_default_expr_model__"
const testExpr = `tier("default", p * 2 + c * 10)`

// withDefaultExpr injects a fixture entry into defaultBillingExpr and removes
// it in t.Cleanup. Tests must NOT rely on the global map having real entries.
func withDefaultExpr(t *testing.T, model, expr string) {
	t.Helper()
	defaultBillingExpr[model] = expr
	t.Cleanup(func() { delete(defaultBillingExpr, model) })
}

// withBillingMode sets a DB-side BillingMode entry and restores on cleanup.
func withBillingMode(t *testing.T, model, mode string) {
	t.Helper()
	billingSetting.BillingMode[model] = mode
	t.Cleanup(func() { delete(billingSetting.BillingMode, model) })
}

// withBillingExpr sets a DB-side BillingExpr entry and restores on cleanup.
func withBillingExpr(t *testing.T, model, expr string) {
	t.Helper()
	billingSetting.BillingExpr[model] = expr
	t.Cleanup(func() { delete(billingSetting.BillingExpr, model) })
}

// withCustomRatio injects a custom ModelRatio for model (simulating admin DB save)
// and restores the ratio map on cleanup.
func withCustomRatio(t *testing.T, model string) {
	t.Helper()
	before := ratio_setting.GetModelRatioCopy()
	before[model] = 99999.0
	b, err := json.Marshal(before)
	if err != nil {
		t.Fatalf("withCustomRatio: marshal: %v", err)
	}
	if err := ratio_setting.UpdateModelRatioByJSONString(string(b)); err != nil {
		t.Fatalf("withCustomRatio: UpdateModelRatioByJSONString: %v", err)
	}
	t.Cleanup(func() {
		after := ratio_setting.GetModelRatioCopy()
		delete(after, model)
		b2, _ := json.Marshal(after)
		_ = ratio_setting.UpdateModelRatioByJSONString(string(b2))
	})
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// 1. Model in defaultBillingExpr, no DB config, no custom ratio → tiered_expr mode.
func TestGetBillingMode_DefaultExpr_NoDBConfig_NoCustomRatio(t *testing.T) {
	withDefaultExpr(t, testModel, testExpr)

	mode := GetBillingMode(testModel)
	if mode != BillingModeTieredExpr {
		t.Fatalf("mode = %q, want %q", mode, BillingModeTieredExpr)
	}
}

// 2. Model in defaultBillingExpr, no DB config, no custom ratio → returns default expr.
func TestGetBillingExpr_DefaultExpr_NoDBConfig_NoCustomRatio(t *testing.T) {
	withDefaultExpr(t, testModel, testExpr)

	expr, ok := GetBillingExpr(testModel)
	if !ok {
		t.Fatal("expected expr to be found")
	}
	if expr != testExpr {
		t.Fatalf("expr = %q, want %q", expr, testExpr)
	}
}

// 3. Admin set BillingMode="ratio" in DB → returns "ratio" (DB wins over default).
func TestGetBillingMode_AdminSetRatio_DBWins(t *testing.T) {
	withDefaultExpr(t, testModel, testExpr)
	withBillingMode(t, testModel, BillingModeRatio)

	mode := GetBillingMode(testModel)
	if mode != BillingModeRatio {
		t.Fatalf("mode = %q, want %q", mode, BillingModeRatio)
	}
}

// 4. Admin set BillingExpr="custom expr" in DB → GetBillingExpr returns custom expr (DB wins).
func TestGetBillingExpr_AdminSetExpr_DBWins(t *testing.T) {
	withDefaultExpr(t, testModel, testExpr)
	const customExpr = `tier("custom", p * 5 + c * 20)`
	withBillingExpr(t, testModel, customExpr)

	expr, ok := GetBillingExpr(testModel)
	if !ok {
		t.Fatal("expected expr to be found")
	}
	if expr != customExpr {
		t.Fatalf("expr = %q, want %q", expr, customExpr)
	}
}

// 5. Admin set custom ModelRatio → default NOT activated; GetBillingMode returns "ratio".
func TestGetBillingMode_CustomModelRatio_DefaultNotActivated(t *testing.T) {
	withDefaultExpr(t, testModel, testExpr)
	withCustomRatio(t, testModel)

	mode := GetBillingMode(testModel)
	if mode != BillingModeRatio {
		t.Fatalf("mode = %q, want %q (custom ratio should block default)", mode, BillingModeRatio)
	}
}

// 6. Admin set custom ModelRatio → GetBillingExpr returns empty.
func TestGetBillingExpr_CustomModelRatio_NoDefaultExpr(t *testing.T) {
	withDefaultExpr(t, testModel, testExpr)
	withCustomRatio(t, testModel)

	_, ok := GetBillingExpr(testModel)
	if ok {
		t.Fatal("expected no expr when custom ModelRatio is set")
	}
}

// 7. Model NOT in defaultBillingExpr, no DB config → GetBillingMode returns "ratio".
func TestGetBillingMode_ModelNotInDefault_ReturnsRatio(t *testing.T) {
	const unknown = "__test_unknown_model_no_default__"
	delete(defaultBillingExpr, unknown)
	delete(billingSetting.BillingMode, unknown)
	delete(billingSetting.BillingExpr, unknown)

	mode := GetBillingMode(unknown)
	if mode != BillingModeRatio {
		t.Fatalf("mode = %q, want %q", mode, BillingModeRatio)
	}
}

// 8. Model NOT in defaultBillingExpr → GetBillingExpr returns (_, false).
func TestGetBillingExpr_ModelNotInDefault_ReturnsFalse(t *testing.T) {
	const unknown = "__test_unknown_model_no_default__"
	delete(defaultBillingExpr, unknown)
	delete(billingSetting.BillingExpr, unknown)

	_, ok := GetBillingExpr(unknown)
	if ok {
		t.Fatal("expected no expr for model not in defaultBillingExpr")
	}
}

// 9. shouldApplyDefaultBillingExpr returns false when BillingMode is explicitly set.
func TestShouldApplyDefault_BillingModeSet_ReturnsFalse(t *testing.T) {
	withDefaultExpr(t, testModel, testExpr)
	withBillingMode(t, testModel, BillingModeTieredExpr)

	if shouldApplyDefaultBillingExpr(testModel) {
		t.Fatal("expected false when BillingMode is set by admin")
	}
}

// 10. shouldApplyDefaultBillingExpr returns false when BillingExpr is explicitly set.
func TestShouldApplyDefault_BillingExprSet_ReturnsFalse(t *testing.T) {
	withDefaultExpr(t, testModel, testExpr)
	withBillingExpr(t, testModel, `tier("x", p)`)

	if shouldApplyDefaultBillingExpr(testModel) {
		t.Fatal("expected false when BillingExpr is set by admin")
	}
}

// 11. Smoke-test every entry in defaultBillingExpr — fail fast if any default is broken.
// With an empty map this is a no-op; Step 4 fills it and this test then validates
// those expressions automatically.
func TestDefaultBillingExpr_AllEntriesPassSmokeTest(t *testing.T) {
	for model, expr := range defaultBillingExpr {
		if err := smokeTestExpr(expr); err != nil {
			t.Errorf("defaultBillingExpr[%q] failed smoke test: %v", model, err)
		}
	}
}
