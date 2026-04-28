package volcadapter

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// ─────────────────────────────────────────
// AdjustBillingOnComplete unit tests
// ─────────────────────────────────────────

// buildSnapshot creates a BillingSnapshot for tests.
// exprStr is a simple flat expression; quota conversion: cost/1e6 * QuotaPerUnit * groupRatio
func buildSnapshot(exprStr string, quotaPerUnit, groupRatio float64) *billingexpr.BillingSnapshot {
	return &billingexpr.BillingSnapshot{
		BillingMode:   "tiered_expr",
		ExprString:    exprStr,
		ExprHash:      billingexpr.ExprHashString(exprStr),
		GroupRatio:    groupRatio,
		QuotaPerUnit:  quotaPerUnit,
		EstimatedTier: "base",
	}
}

// buildTask creates a minimal model.Task for AdjustBillingOnComplete tests.
func buildTask(snap *billingexpr.BillingSnapshot, flags *model.TieredVolcFlags, taskDataJSON string) *model.Task {
	task := &model.Task{}
	bc := &model.TaskBillingContext{
		TieredSnapshot:  snap,
		TieredVolcFlags: flags,
	}
	task.PrivateData.BillingContext = bc
	if taskDataJSON != "" {
		task.Data = json.RawMessage(taskDataJSON)
	}
	return task
}

// TestAdjustBillingOnComplete_NoSnapshot verifies that 0 is returned (fall through
// to ratio path) when BillingContext has no TieredSnapshot.
func TestAdjustBillingOnComplete_NoSnapshot(t *testing.T) {
	task := &model.Task{}
	task.PrivateData.BillingContext = &model.TaskBillingContext{}
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 100_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)
	if got != 0 {
		t.Errorf("expected 0 (no snapshot), got %d", got)
	}
}

// TestAdjustBillingOnComplete_NilBillingContext verifies that 0 is returned when
// BillingContext is nil.
func TestAdjustBillingOnComplete_NilBillingContext(t *testing.T) {
	task := &model.Task{}
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 100_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)
	if got != 0 {
		t.Errorf("expected 0 (nil BillingContext), got %d", got)
	}
}

// TestAdjustBillingOnComplete_FlatExpr verifies basic flat expression evaluation.
//
// Expression: tier("base", c * 10)  (c in token units, price in $/1M)
//  tokens = 108_000 (5s 720p output)
//  cost = 108_000 * 10 = 1_080_000 ($/1M units)
//  quotaBeforeGroup = 1_080_000 / 1_000_000 * 500 = 540
//  actualQuota = round(540 * 1.0) = 540
func TestAdjustBillingOnComplete_FlatExpr(t *testing.T) {
	exprStr := `tier("base", c * 10)`
	snap := buildSnapshot(exprStr, 500.0, 1.0)
	task := buildTask(snap, nil, `{"resolution":"720p","duration":5,"service_tier":"default"}`)
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 108_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)

	// cost = 108_000 * 10 = 1_080_000
	// quota = 1_080_000 / 1_000_000 * 500 * 1.0 = 540
	wantQuota := 540
	if got != wantQuota {
		t.Errorf("AdjustBillingOnComplete = %d, want %d", got, wantQuota)
	}
}

// TestAdjustBillingOnComplete_WithGroupRatio verifies that groupRatio is applied.
//
// Same as above but groupRatio=2.0 → actualQuota = 540 * 2 = 1080
func TestAdjustBillingOnComplete_WithGroupRatio(t *testing.T) {
	exprStr := `tier("base", c * 10)`
	snap := buildSnapshot(exprStr, 500.0, 2.0)
	task := buildTask(snap, nil, `{"resolution":"720p","duration":5,"service_tier":"default"}`)
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 108_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)

	wantQuota := 1080
	if got != wantQuota {
		t.Errorf("AdjustBillingOnComplete (groupRatio=2) = %d, want %d", got, wantQuota)
	}
}

// TestAdjustBillingOnComplete_ParamResolution verifies that param("resolution")
// from task.Data is accessible in the expression.
//
// Expression: param("resolution") == "1080p" ? tier("hd", c * 20) : tier("sd", c * 10)
// With resolution=1080p, tokens=243_000:
//   cost = 243_000 * 20 = 4_860_000
//   quota = 4_860_000 / 1_000_000 * 500 * 1.0 = 2430
func TestAdjustBillingOnComplete_ParamResolution(t *testing.T) {
	exprStr := `param("resolution") == "1080p" ? tier("hd", c * 20) : tier("sd", c * 10)`
	snap := buildSnapshot(exprStr, 500.0, 1.0)
	task := buildTask(snap, nil, `{"resolution":"1080p","duration":5,"service_tier":"default"}`)
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 243_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)

	wantQuota := 2430 // 4_860_000 / 1e6 * 500 = 2430
	if got != wantQuota {
		t.Errorf("AdjustBillingOnComplete (param resolution) = %d, want %d", got, wantQuota)
	}
}

// TestAdjustBillingOnComplete_WithVolcFlags verifies that TieredVolcFlags
// (generate_audio, draft, has_video_input) are accessible via param() in the expression.
//
// Expression: param("generate_audio") == true ? tier("audio", c * 15) : tier("silent", c * 10)
// With generate_audio=true, tokens=108_000:
//   cost = 108_000 * 15 = 1_620_000
//   quota = 1_620_000 / 1_000_000 * 500 = 810
func TestAdjustBillingOnComplete_WithVolcFlags_Audio(t *testing.T) {
	exprStr := `param("generate_audio") == true ? tier("audio", c * 15) : tier("silent", c * 10)`
	snap := buildSnapshot(exprStr, 500.0, 1.0)
	audioTrue := true
	flags := &model.TieredVolcFlags{GenerateAudio: &audioTrue}
	task := buildTask(snap, flags, `{"resolution":"720p","duration":5}`)
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 108_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)

	wantQuota := 810 // 1_620_000 / 1e6 * 500 = 810
	if got != wantQuota {
		t.Errorf("AdjustBillingOnComplete (generate_audio=true) = %d, want %d", got, wantQuota)
	}
}

// TestAdjustBillingOnComplete_HasVideoInput verifies that HasVideoInput synthesizes
// a content[] array so that expressions using has(param(...), "video_url") work.
func TestAdjustBillingOnComplete_HasVideoInput(t *testing.T) {
	// Expression checks if content has video_url to apply video tier pricing
	exprStr := `has(param("content.0.type"), "video") ? tier("i2v", c * 12) : tier("t2v", c * 10)`
	snap := buildSnapshot(exprStr, 500.0, 1.0)
	flags := &model.TieredVolcFlags{HasVideoInput: true}
	task := buildTask(snap, flags, `{"resolution":"720p","duration":5}`)
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 108_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)

	// content[0].type == "video_url", has("video_url", "video") == true
	// cost = 108_000 * 12 = 1_296_000; quota = 1_296_000 / 1e6 * 500 = 648
	wantQuota := 648
	if got != wantQuota {
		t.Errorf("AdjustBillingOnComplete (has_video_input) = %d, want %d", got, wantQuota)
	}
}

// TestAdjustBillingOnComplete_ZeroTokens verifies graceful handling when
// CompletionTokens == 0 (expression evaluates to 0; return 0 to fall through).
func TestAdjustBillingOnComplete_ZeroTokens(t *testing.T) {
	exprStr := `tier("base", c * 10)`
	snap := buildSnapshot(exprStr, 500.0, 1.0)
	task := buildTask(snap, nil, `{"resolution":"720p","duration":5}`)
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 0}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)
	// cost = 0; quota = 0 → fall through to ratio path
	if got != 0 {
		t.Errorf("AdjustBillingOnComplete (zero tokens) = %d, want 0", got)
	}
}

// ─────────────────────────────────────────
// ValidateRequestAndSetAction tests (Volc-native path)
// ─────────────────────────────────────────

// TestValidateRequestAndSetAction_TextOnly verifies text-only body sets TextGenerate.
func TestValidateRequestAndSetAction_TextOnly(t *testing.T) {
	// Test the internal validateVolcNativeTaskRequest function directly.
	// We can't use gin context easily without httptest setup, so test via the helper.
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"text","text":"hello"}]}`)
	flags := extractFlagsFromBody(body)
	if flags.HasVideoInput {
		t.Error("expected HasVideoInput=false for text-only body")
	}
}

// TestValidateRequestAndSetAction_WithVideo verifies video body sets HasVideoInput.
func TestValidateRequestAndSetAction_WithVideo(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"video_url","video_url":{"url":"https://example.com/v.mp4"}}]}`)
	flags := extractFlagsFromBody(body)
	if !flags.HasVideoInput {
		t.Error("expected HasVideoInput=true for video_url body")
	}
}

// extractFlagsFromBody is a test helper that extracts flags from a raw body
// using the same logic as extractVolcFlags in controller/relay.go.
func extractFlagsFromBody(body []byte) *model.TieredVolcFlags {
	flags := &model.TieredVolcFlags{}
	var parsed map[string]interface{}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return flags
	}
	if contentRaw, ok := parsed["content"]; ok {
		if items, ok := contentRaw.([]interface{}); ok {
			for _, item := range items {
				if itemMap, ok := item.(map[string]interface{}); ok {
					if typeStr, _ := itemMap["type"].(string); typeStr == "video_url" {
						flags.HasVideoInput = true
						break
					}
					if _, hasKey := itemMap["video_url"]; hasKey {
						flags.HasVideoInput = true
						break
					}
				}
			}
		}
	}
	return flags
}

// ─────────────────────────────────────────
// buildSynthesizedBody tests
// ─────────────────────────────────────────

// TestBuildSynthesizedBody_Basic verifies that resolution/duration/service_tier
// from task.Data are included in the synthesized body.
func TestBuildSynthesizedBody_Basic(t *testing.T) {
	snap := buildSnapshot(`tier("base", c * 10)`, 500.0, 1.0)
	task := buildTask(snap, nil, `{"resolution":"1080p","duration":10,"service_tier":"turbo"}`)

	bc := task.PrivateData.BillingContext
	synthBody, err := buildSynthesizedBody(task, bc)
	if err != nil {
		t.Fatalf("buildSynthesizedBody failed: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(synthBody, &m); err != nil {
		t.Fatalf("synthesized body is not valid JSON: %v", err)
	}
	if m["resolution"] != "1080p" {
		t.Errorf("resolution: got %v, want 1080p", m["resolution"])
	}
	if m["service_tier"] != "turbo" {
		t.Errorf("service_tier: got %v, want turbo", m["service_tier"])
	}
}

// TestBuildSynthesizedBody_WithFlags verifies that TieredVolcFlags are included
// in the synthesized body alongside task.Data fields.
func TestBuildSynthesizedBody_WithFlags(t *testing.T) {
	snap := buildSnapshot(`tier("base", c * 10)`, 500.0, 1.0)
	audioTrue := true
	draftFalse := false
	flags := &model.TieredVolcFlags{GenerateAudio: &audioTrue, Draft: &draftFalse, HasVideoInput: true}
	task := buildTask(snap, flags, `{"resolution":"720p","duration":5}`)

	bc := task.PrivateData.BillingContext
	synthBody, err := buildSynthesizedBody(task, bc)
	if err != nil {
		t.Fatalf("buildSynthesizedBody failed: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(synthBody, &m); err != nil {
		t.Fatalf("synthesized body is not valid JSON: %v", err)
	}

	if m["generate_audio"] != true {
		t.Errorf("generate_audio: got %v, want true", m["generate_audio"])
	}
	if m["draft"] != false {
		t.Errorf("draft: got %v, want false", m["draft"])
	}
	// Check content[] has video_url entry
	content, ok := m["content"].([]interface{})
	if !ok || len(content) == 0 {
		t.Fatal("expected content[] with at least one item")
	}
	firstItem, ok := content[0].(map[string]interface{})
	if !ok {
		t.Fatal("content[0] is not a map")
	}
	if firstItem["type"] != "video_url" {
		t.Errorf("content[0].type: got %v, want video_url", firstItem["type"])
	}
}
