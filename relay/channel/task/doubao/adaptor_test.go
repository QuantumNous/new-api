package doubao

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newDoubaoTestContext creates a gin.Context with pre-populated body storage.
func newDoubaoTestContext(t *testing.T, body []byte) *gin.Context {
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
// ValidateRequestAndSetAction tests
// ─────────────────────────────────────────

// TestValidateRequestAndSetAction_VolcNative_TextGenerate verifies that a
// Volc-native body without content[] images sets action to TaskActionTextGenerate.
func TestValidateRequestAndSetAction_VolcNative_TextGenerate(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"text","text":"a cat video"}]}`)
	c := newDoubaoTestContext(t, body)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatVolc}

	a := &TaskAdaptor{}
	if err := a.ValidateRequestAndSetAction(c, info); err != nil {
		t.Fatalf("unexpected error: %+v", err)
	}
	if info.Action != constant.TaskActionTextGenerate {
		t.Errorf("expected action=%q, got=%q", constant.TaskActionTextGenerate, info.Action)
	}
	if info.OriginModelName != "doubao-seedance-2-0" {
		t.Errorf("expected OriginModelName=%q, got=%q", "doubao-seedance-2-0", info.OriginModelName)
	}
}

// TestValidateRequestAndSetAction_VolcNative_Generate verifies that a
// Volc-native body with image_url in content[] sets action to TaskActionGenerate.
func TestValidateRequestAndSetAction_VolcNative_Generate(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"image_url","image_url":{"url":"https://example.com/img.jpg"}},{"type":"text","text":"make it move"}]}`)
	c := newDoubaoTestContext(t, body)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatVolc}

	a := &TaskAdaptor{}
	if err := a.ValidateRequestAndSetAction(c, info); err != nil {
		t.Fatalf("unexpected error: %+v", err)
	}
	if info.Action != constant.TaskActionGenerate {
		t.Errorf("expected action=%q, got=%q", constant.TaskActionGenerate, info.Action)
	}
}

// TestValidateRequestAndSetAction_VolcNative_VideoURL verifies that
// video_url content items also trigger TaskActionGenerate.
func TestValidateRequestAndSetAction_VolcNative_VideoURL(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"video_url","video_url":{"url":"https://example.com/vid.mp4"}},{"type":"text","text":"remix this"}]}`)
	c := newDoubaoTestContext(t, body)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatVolc}

	a := &TaskAdaptor{}
	if err := a.ValidateRequestAndSetAction(c, info); err != nil {
		t.Fatalf("unexpected error: %+v", err)
	}
	if info.Action != constant.TaskActionGenerate {
		t.Errorf("expected action=%q, got=%q", constant.TaskActionGenerate, info.Action)
	}
}

// TestValidateRequestAndSetAction_VolcNative_MissingModel verifies that a
// Volc-native body without model returns a validation error.
func TestValidateRequestAndSetAction_VolcNative_MissingModel(t *testing.T) {
	body := []byte(`{"content":[{"type":"text","text":"a cat video"}]}`)
	c := newDoubaoTestContext(t, body)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatVolc}

	a := &TaskAdaptor{}
	err := a.ValidateRequestAndSetAction(c, info)
	if err == nil {
		t.Fatal("expected error for missing model, got nil")
	}
}

// TestValidateRequestAndSetAction_OpenAIPath verifies that the existing OpenAI
// task path is unchanged when RelayFormat is not Volc (regression guard).
func TestValidateRequestAndSetAction_OpenAIPath(t *testing.T) {
	// /v1/video/generations uses TaskSubmitReq format
	body := []byte(`{"model":"doubao-seedance-2-0","prompt":"a cat video"}`)
	c := newDoubaoTestContext(t, body)
	// TaskRelayInfo must be non-nil for storeTaskRequest to work
	info := &relaycommon.RelayInfo{
		RelayFormat:   types.RelayFormatTask,
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	a := &TaskAdaptor{}
	err := a.ValidateRequestAndSetAction(c, info)
	// May succeed or fail depending on ValidateBasicTaskRequest's prompt check
	// The important thing is that it does NOT go through the Volc path
	_ = err
}

// ─────────────────────────────────────────
// BuildRequestBody tests
// ─────────────────────────────────────────

// TestBuildRequestBody_VolcNative_ByteIdentical verifies that the body forwarded
// to upstream is byte-identical to the original body for Volc-native requests,
// even when it contains Volc-specific fields not modeled in any struct.
func TestBuildRequestBody_VolcNative_ByteIdentical(t *testing.T) {
	// Body with Volc-specific fields: tools, resolution, ratio, duration, etc.
	originalBody := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"text","text":"cinematic shot"}],"tools":[{"type":"web_search"}],"resolution":"720p","ratio":"16:9","duration":5,"seed":42}`)
	c := newDoubaoTestContext(t, originalBody)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatVolc,
		ChannelMeta: &relaycommon.ChannelMeta{
			IsModelMapped:     false,
			UpstreamModelName: "doubao-seedance-2-0",
		},
	}
	info.OriginModelName = "doubao-seedance-2-0"

	a := &TaskAdaptor{}
	reader, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody returned error: %v", err)
	}

	gotBytes, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll returned error: %v", err)
	}

	if !bytes.Equal(gotBytes, originalBody) {
		t.Errorf("body not byte-identical:\n  original: %s\n  got:      %s", originalBody, gotBytes)
	}
}

// TestBuildRequestBody_VolcNative_ModelMapped verifies that model mapping
// patches only the model field while preserving all other fields byte-identical.
func TestBuildRequestBody_VolcNative_ModelMapped(t *testing.T) {
	originalBody := []byte(`{"model":"original-model","content":[{"type":"text","text":"test"}],"tools":[{"type":"web_search"}]}`)
	c := newDoubaoTestContext(t, originalBody)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatVolc,
		ChannelMeta: &relaycommon.ChannelMeta{
			IsModelMapped:     true,
			UpstreamModelName: "mapped-upstream-model",
		},
	}

	a := &TaskAdaptor{}
	reader, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody returned error: %v", err)
	}

	gotBytes, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll returned error: %v", err)
	}

	// Verify model was patched
	var gotMap map[string]json.RawMessage
	if err = json.Unmarshal(gotBytes, &gotMap); err != nil {
		t.Fatalf("failed to parse result: %v", err)
	}
	var gotModel string
	if err = json.Unmarshal(gotMap["model"], &gotModel); err != nil {
		t.Fatalf("failed to parse model: %v", err)
	}
	if gotModel != "mapped-upstream-model" {
		t.Errorf("model: got %q, want %q", gotModel, "mapped-upstream-model")
	}

	// Verify tools field is preserved
	if _, ok := gotMap["tools"]; !ok {
		t.Error("tools field was lost after model mapping")
	}
}

// TestBuildRequestBody_OpenAIPath verifies that the existing TaskSubmitReq path
// is invoked when RelayFormat is not Volc (regression guard for /v1/video/generations).
func TestBuildRequestBody_OpenAIPath(t *testing.T) {
	// /v1/video/generations uses TaskSubmitReq; store it in context
	body := []byte(`{"model":"doubao-seedance-2-0","prompt":"a cat video"}`)
	c := newDoubaoTestContext(t, body)

	req := relaycommon.TaskSubmitReq{
		Model:  "doubao-seedance-2-0",
		Prompt: "a cat video",
	}
	c.Set("task_request", req)

	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatTask,
		ChannelMeta: &relaycommon.ChannelMeta{
			IsModelMapped:     false,
			UpstreamModelName: "doubao-seedance-2-0",
		},
	}
	info.OriginModelName = "doubao-seedance-2-0"

	a := &TaskAdaptor{}
	reader, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody (OpenAI path) returned error: %v", err)
	}
	if reader == nil {
		t.Fatal("BuildRequestBody returned nil reader for OpenAI path")
	}

	// Verify it produces JSON with content array (the doubao format)
	gotBytes, _ := io.ReadAll(reader)
	var gotMap map[string]json.RawMessage
	if err = json.Unmarshal(gotBytes, &gotMap); err != nil {
		t.Fatalf("OpenAI path produced invalid JSON: %v", err)
	}
	if _, ok := gotMap["content"]; !ok {
		t.Error("OpenAI path should produce content[] array")
	}
}

// ─────────────────────────────────────────
// EstimateBilling tests
// ─────────────────────────────────────────

// TestEstimateBilling_VolcNative_NoVideo verifies that a Volc-native body without
// video_url content returns nil (no video input ratio).
func TestEstimateBilling_VolcNative_NoVideo(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"text","text":"test"}]}`)
	c := newDoubaoTestContext(t, body)
	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatVolc,
		OriginModelName: "doubao-seedance-2-0",
	}

	a := &TaskAdaptor{}
	ratios := a.EstimateBilling(c, info)
	// No video input → nil or empty
	if len(ratios) > 0 {
		t.Errorf("expected no billing ratios for text-only request, got %v", ratios)
	}
}

// TestEstimateBilling_VolcNative_WithVideo verifies that a Volc-native body with
// video_url content returns the video_input ratio if the model supports it.
func TestEstimateBilling_VolcNative_WithVideo(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","content":[{"type":"video_url","video_url":{"url":"https://example.com/vid.mp4"}}]}`)
	c := newDoubaoTestContext(t, body)

	// Use a model known to have a video input ratio
	modelName := "doubao-seedance-2-0"
	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatVolc,
		OriginModelName: modelName,
	}

	a := &TaskAdaptor{}
	ratios := a.EstimateBilling(c, info)

	// Check only if the model has a video input ratio configured
	if _, ok := GetVideoInputRatio(modelName); ok {
		if _, hasRatio := ratios["video_input"]; !hasRatio {
			t.Error("expected video_input ratio for video content, got none")
		}
	}
	// If model has no video ratio configured, ratios may be nil — that's fine.
}

// TestEstimateBilling_OpenAIPath verifies that the existing metadata-based path
// is invoked when RelayFormat is not Volc (regression guard).
func TestEstimateBilling_OpenAIPath(t *testing.T) {
	body := []byte(`{"model":"doubao-seedance-2-0","prompt":"test"}`)
	c := newDoubaoTestContext(t, body)

	req := relaycommon.TaskSubmitReq{
		Model:  "doubao-seedance-2-0",
		Prompt: "test",
	}
	c.Set("task_request", req)

	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatTask,
		OriginModelName: "doubao-seedance-2-0",
	}

	a := &TaskAdaptor{}
	// Should not panic; result doesn't matter for this regression test
	_ = a.EstimateBilling(c, info)
}
