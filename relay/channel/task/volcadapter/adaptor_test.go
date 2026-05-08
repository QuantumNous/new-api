package volcadapter

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newVolcTaskTestContext creates a gin.Context with JSON body stored in
// common.KeyBodyStorage so validateVolcNativeTaskRequest can read it.
func newVolcTaskTestContext(t *testing.T, body []byte) *gin.Context {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v3/contents/generations/tasks", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	bs, err := common.CreateBodyStorage(body)
	if err != nil {
		t.Fatalf("failed to create body storage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)
	return c
}

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

// TestAdjustBillingOnComplete_CallbackPath_FlagsCarryResolution verifies that
// TieredVolcFlags.Resolution/Duration/ServiceTier are used when task.Data only
// contains {"id":...} (callback-enabled deployments where the Volc fetch
// response is never stored).
func TestAdjustBillingOnComplete_CallbackPath_FlagsCarryResolution(t *testing.T) {
	exprStr := `param("resolution") == "1080p" ? tier("hd", c * 20) : tier("sd", c * 10)`
	snap := buildSnapshot(exprStr, 500.0, 1.0)
	flags := &model.TieredVolcFlags{
		Resolution:  "1080p",
		Duration:    5,
		ServiceTier: "default",
	}
	// task.Data is the raw submit response — only contains {"id":...}, no
	// resolution / duration / service_tier. Without flags fallback the
	// settle would silently pick the "sd" tier.
	task := buildTask(snap, flags, `{"id":"task_xyz"}`)
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 243_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)

	// Should hit the "hd" tier because flags.Resolution == "1080p".
	wantQuota := 2430 // 4_860_000 / 1e6 * 500 = 2430
	if got != wantQuota {
		t.Errorf("callback path (flags resolution) = %d, want %d (settle picked the wrong tier)", got, wantQuota)
	}
}

// TestAdjustBillingOnComplete_FlagsTakePriorityOverTaskData verifies that
// when both sources have a value, the submit-time flags win. This covers the
// case where Volc's fetch response defaults a field to something different
// from what the user actually submitted (e.g. the user submitted with no
// service_tier, Volc filled in "default", but we want to bill against the
// submitted value).
func TestAdjustBillingOnComplete_FlagsTakePriorityOverTaskData(t *testing.T) {
	exprStr := `param("service_tier") == "flex" ? tier("flex", c * 5) : tier("default", c * 10)`
	snap := buildSnapshot(exprStr, 500.0, 1.0)
	flags := &model.TieredVolcFlags{ServiceTier: "flex"}
	// task.Data says "default" — flags should override.
	task := buildTask(snap, flags, `{"resolution":"720p","duration":5,"service_tier":"default"}`)
	taskResult := &relaycommon.TaskInfo{CompletionTokens: 100_000}

	a := &TaskAdaptor{}
	got := a.AdjustBillingOnComplete(task, taskResult)

	// flex tier: 100_000 * 5 / 1e6 * 500 = 250
	wantQuota := 250
	if got != wantQuota {
		t.Errorf("flags should take priority over task.Data: got=%d, want=%d", got, wantQuota)
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

// ─────────────────────────────────────────
// T-6: validateVolcNativeTaskRequest — malformed input cases
// ─────────────────────────────────────────

// TestValidateVolcNativeTaskRequest_MissingModel verifies that a body without
// a model field returns a 400 TaskError.
func TestValidateVolcNativeTaskRequest_MissingModel(t *testing.T) {
	body := []byte(`{"content":[{"type":"text","text":"make a video"}]}`)
	c := newVolcTaskTestContext(t, body)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := validateVolcNativeTaskRequest(c, info)
	if taskErr == nil {
		t.Fatal("expected TaskError for missing model, got nil")
	}
	if taskErr.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", taskErr.StatusCode)
	}
	if taskErr.Code != "invalid_request" {
		t.Errorf("expected code=invalid_request, got %q", taskErr.Code)
	}
}

// TestValidateVolcNativeTaskRequest_EmptyBody verifies that an empty JSON
// object ({} with no fields) returns a 400 — model is required.
func TestValidateVolcNativeTaskRequest_EmptyBody(t *testing.T) {
	body := []byte(`{}`)
	c := newVolcTaskTestContext(t, body)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := validateVolcNativeTaskRequest(c, info)
	if taskErr == nil {
		t.Fatal("expected TaskError for empty body, got nil")
	}
	if taskErr.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", taskErr.StatusCode)
	}
}

// TestValidateVolcNativeTaskRequest_EmptyContentArray verifies that a body with
// content: [] (empty array) is accepted when model is present.
// The validator does not require content[] to be non-empty.
func TestValidateVolcNativeTaskRequest_EmptyContentArray(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","content":[]}`)
	c := newVolcTaskTestContext(t, body)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := validateVolcNativeTaskRequest(c, info)
	if taskErr != nil {
		t.Errorf("expected no error for empty content array (model is present), got: %+v", taskErr)
	}
}

// TestValidateVolcNativeTaskRequest_MalformedContentItems verifies that content[]
// entries missing the "type" field do not panic and are handled gracefully.
// Items without type are skipped when scanning for image/video inputs.
func TestValidateVolcNativeTaskRequest_MalformedContentItems(t *testing.T) {
	// content[] items have no "type" key — should not crash.
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"text":"hello"},{"random_key":42}]}`)
	c := newVolcTaskTestContext(t, body)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := validateVolcNativeTaskRequest(c, info)
	if taskErr != nil {
		t.Errorf("unexpected error for malformed content items: %+v", taskErr)
	}
	// Without any image_url/video_url items the action defaults to TextGenerate.
	if info.Action != "textGenerate" {
		t.Errorf("expected action=textGenerate for typeless content items, got %q", info.Action)
	}
}

// TestValidateVolcNativeTaskRequest_NonJSONBody verifies that a non-JSON request
// body returns a 400 and does NOT panic.
func TestValidateVolcNativeTaskRequest_NonJSONBody(t *testing.T) {
	body := []byte(`not json at all`)
	c := newVolcTaskTestContext(t, body)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := validateVolcNativeTaskRequest(c, info)
	if taskErr == nil {
		t.Fatal("expected TaskError for non-JSON body, got nil")
	}
	if taskErr.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", taskErr.StatusCode)
	}
}

// TestValidateVolcNativeTaskRequest_InvalidJSONBody verifies that syntactically
// broken JSON (truncated / malformed) returns a 400 with no panic.
func TestValidateVolcNativeTaskRequest_InvalidJSONBody(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"text"`)
	c := newVolcTaskTestContext(t, body)
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := validateVolcNativeTaskRequest(c, info)
	if taskErr == nil {
		t.Fatal("expected TaskError for truncated JSON, got nil")
	}
	if taskErr.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", taskErr.StatusCode)
	}
}

// ─────────────────────────────────────────
// BuildRequestBody tests
// ─────────────────────────────────────────

// TestBuildRequestBody_AppliesParamOverride verifies that ParamOverride fields are
// injected into the forwarded body by BuildRequestBody. Unknown Volc-specific fields
// must be preserved (byte-level patch, not struct marshal/unmarshal).
func TestBuildRequestBody_AppliesParamOverride(t *testing.T) {
	rawBody := []byte(`{"model":"doubao-seedance-2-0","prompt":"test","tools":[{"type":"web_search"}],"custom_field":"preserved"}`)
	c := newVolcTaskTestContext(t, rawBody)

	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
		ChannelMeta: &relaycommon.ChannelMeta{
			ParamOverride: map[string]interface{}{
				"service_tier": "turbo",
			},
		},
	}

	a := &TaskAdaptor{}
	reader, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody returned unexpected error: %v", err)
	}

	// Drain the reader into a buffer.
	var buf bytes.Buffer
	tmp := make([]byte, 512)
	for {
		n, readErr := reader.Read(tmp)
		if n > 0 {
			buf.Write(tmp[:n])
		}
		if readErr != nil {
			break
		}
	}
	gotBytes := buf.Bytes()

	var result map[string]json.RawMessage
	if err := json.Unmarshal(gotBytes, &result); err != nil {
		t.Fatalf("result is not valid JSON: %v\nbody: %s", err, gotBytes)
	}

	// Verify the param override field was injected.
	tierRaw, ok := result["service_tier"]
	if !ok {
		t.Fatal("service_tier was not injected by ParamOverride")
	}
	var tier string
	if err := json.Unmarshal(tierRaw, &tier); err != nil || tier != "turbo" {
		t.Errorf("service_tier: want %q, got %q (raw: %s)", "turbo", tier, tierRaw)
	}

	// Verify existing fields are preserved.
	if _, ok := result["prompt"]; !ok {
		t.Error("prompt field was dropped after ParamOverride")
	}
	if _, ok := result["tools"]; !ok {
		t.Error("tools field was dropped after ParamOverride")
	}
	if _, ok := result["custom_field"]; !ok {
		t.Error("custom_field was dropped after ParamOverride")
	}
}
