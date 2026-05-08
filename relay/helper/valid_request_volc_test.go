package helper

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newTestContextWithBody(t *testing.T, body string) *gin.Context {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v3/images/generations", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

// TestGetAndValidateVolcImageRequest_Valid verifies that a well-formed Volc body
// is parsed correctly and the model field is captured.
func TestGetAndValidateVolcImageRequest_Valid(t *testing.T) {
	body := `{"model":"high-aes-general-v21-L","prompt":"a beautiful sunset","size":"2K","watermark":true}`
	c := newTestContextWithBody(t, body)

	req, err := GetAndValidateVolcImageRequest(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req.Model != "high-aes-general-v21-L" {
		t.Errorf("model: got %q, want %q", req.Model, "high-aes-general-v21-L")
	}
	if req.Prompt != "a beautiful sunset" {
		t.Errorf("prompt: got %q", req.Prompt)
	}
	if req.Size != "2K" {
		t.Errorf("size: got %q", req.Size)
	}
	if req.Watermark == nil || !*req.Watermark {
		t.Errorf("watermark: expected true")
	}
}

// TestGetAndValidateVolcImageRequest_MissingModel verifies that an empty model
// field returns a validation error.
func TestGetAndValidateVolcImageRequest_MissingModel(t *testing.T) {
	body := `{"prompt":"a beautiful sunset"}`
	c := newTestContextWithBody(t, body)

	_, err := GetAndValidateVolcImageRequest(c)
	if err == nil {
		t.Fatal("expected error for missing model, got nil")
	}
	if err.Error() != "model is required" {
		t.Errorf("error message: got %q, want %q", err.Error(), "model is required")
	}
}

// TestGetAndValidateVolcImageRequest_ExtraFields verifies that Volc-specific
// fields not defined in VolcImageRequest (e.g., sequential_image_generation,
// optimize_prompt_options) are captured in the Extra map.
func TestGetAndValidateVolcImageRequest_ExtraFields(t *testing.T) {
	body := `{
		"model":"seedance-2-0",
		"prompt":"cinematic shot",
		"sequential_image_generation":"auto",
		"optimize_prompt_options":{"mode":"fast"},
		"req_key":"some-key"
	}`
	c := newTestContextWithBody(t, body)

	req, err := GetAndValidateVolcImageRequest(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(req.Extra) == 0 {
		t.Fatal("expected Extra to be populated with volc-specific fields")
	}
	if _, ok := req.Extra["sequential_image_generation"]; !ok {
		t.Error("expected sequential_image_generation in Extra")
	}
	if _, ok := req.Extra["optimize_prompt_options"]; !ok {
		t.Error("expected optimize_prompt_options in Extra")
	}
	if _, ok := req.Extra["req_key"]; !ok {
		t.Error("expected req_key in Extra")
	}
}

// TestGetAndValidateVolcImageRequest_InvalidJSON verifies that malformed JSON
// returns a parse error.
func TestGetAndValidateVolcImageRequest_InvalidJSON(t *testing.T) {
	body := `{not valid json}`
	c := newTestContextWithBody(t, body)

	_, err := GetAndValidateVolcImageRequest(c)
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

// TestGetAndValidateRequest_VolcFormat verifies that GetAndValidateRequest
// dispatches correctly for RelayFormatVolc when a model is present.
func TestGetAndValidateRequest_VolcFormat(t *testing.T) {
	body := `{"model":"high-aes-general-v21-L","prompt":"test prompt"}`
	c := newTestContextWithBody(t, body)

	req, err := GetAndValidateRequest(c, types.RelayFormatVolc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	volcReq, ok := req.(*dto.VolcImageRequest)
	if !ok {
		t.Fatalf("expected *dto.VolcImageRequest, got %T", req)
	}
	if volcReq.Model != "high-aes-general-v21-L" {
		t.Errorf("model: got %q", volcReq.Model)
	}
}

// ── T-6 additional cases ──────────────────────────────────────────────────────

// TestGetAndValidateVolcImageRequest_EmptyBody verifies that an empty JSON
// object (no fields at all) returns a 400-class "model is required" error.
func TestGetAndValidateVolcImageRequest_EmptyBody(t *testing.T) {
	body := `{}`
	c := newTestContextWithBody(t, body)

	_, err := GetAndValidateVolcImageRequest(c)
	if err == nil {
		t.Fatal("expected error for empty body {}, got nil")
	}
	if err.Error() != "model is required" {
		t.Errorf("error message: got %q, want %q", err.Error(), "model is required")
	}
}

// TestGetAndValidateVolcImageRequest_EmptyModelField verifies that
// model: "" (explicitly present but empty) is treated the same as absent.
func TestGetAndValidateVolcImageRequest_EmptyModelField(t *testing.T) {
	body := `{"model":"","prompt":"some prompt"}`
	c := newTestContextWithBody(t, body)

	_, err := GetAndValidateVolcImageRequest(c)
	if err == nil {
		t.Fatal("expected error for model:\"\", got nil")
	}
	if err.Error() != "model is required" {
		t.Errorf("error message: got %q, want %q", err.Error(), "model is required")
	}
}

// TestGetAndValidateVolcImageRequest_WrongContentType verifies that a
// multipart/form-data body without a JSON Content-Type is handled safely.
// UnmarshalBodyReusable skips form-data parsing for the VolcImageRequest struct
// (no form tags), so the model field is unpopulated → returns "model is required".
// This tests that the validator does NOT panic on unexpected content types.
func TestGetAndValidateVolcImageRequest_WrongContentType(t *testing.T) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	_ = mw.WriteField("model", "high-aes-general-v21-L")
	_ = mw.WriteField("prompt", "a beautiful sunset")
	mw.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v3/images/generations", &buf)
	c.Request.Header.Set("Content-Type", mw.FormDataContentType())

	// Must not panic; any error (including "model is required") is acceptable.
	// The key invariant is: no crash.
	_, _ = GetAndValidateVolcImageRequest(c)
	// No t.Fatal here — we're verifying robustness, not a specific error message,
	// because multipart field parsing behaviour for struct-mapped fields depends
	// on whether form tags are present (they are not on VolcImageRequest).
}

// TestGetAndValidateVolcImageRequest_ExtremelyLongModel verifies that a
// very large model string (10 KB) is accepted by the validator — there is no
// built-in size cap on the model field in GetAndValidateVolcImageRequest.
// The string is passed through to the upstream caller unchanged.
// This is intentional: length validation is the caller's / upstream's concern.
func TestGetAndValidateVolcImageRequest_ExtremelyLongModel(t *testing.T) {
	longModel := strings.Repeat("x", 10*1024) // 10 KB
	body := `{"model":"` + longModel + `","prompt":"test"}`
	c := newTestContextWithBody(t, body)

	req, err := GetAndValidateVolcImageRequest(c)
	// Accepted — no length limit in the validator.
	if err != nil {
		t.Fatalf("expected no error for long model (validator has no length cap), got: %v", err)
	}
	if req.Model != longModel {
		t.Errorf("model field should be preserved verbatim (got length %d, want %d)", len(req.Model), len(longModel))
	}
}

// TestGetAndValidateVolcImageRequest_DeeplyNestedUnexpectedFields verifies that
// deeply-nested unknown fields do not cause a panic and are preserved in Extra.
func TestGetAndValidateVolcImageRequest_DeeplyNestedUnexpectedFields(t *testing.T) {
	body := `{"model":"m1","deep":{"a":{"b":{"c":{"d":"leaf"}}}},"arr":[1,2,{"x":3}]}`
	c := newTestContextWithBody(t, body)

	req, err := GetAndValidateVolcImageRequest(c)
	if err != nil {
		t.Fatalf("unexpected error for body with nested unknown fields: %v", err)
	}
	if _, ok := req.Extra["deep"]; !ok {
		t.Error("expected nested field 'deep' captured in Extra")
	}
	if _, ok := req.Extra["arr"]; !ok {
		t.Error("expected array field 'arr' captured in Extra")
	}
}

// ── model_name / req_key fallback tests ─────────────────────────────────────

// TestGetAndValidateVolcImageRequest_ModelNameFallback verifies that when
// "model" is absent but "model_name" is present, req.Model is populated with
// the model_name value so downstream logic works uniformly.
func TestGetAndValidateVolcImageRequest_ModelNameFallback(t *testing.T) {
	body := `{"model_name":"high-aes-general-v21-L","prompt":"cinematic shot"}`
	c := newTestContextWithBody(t, body)

	req, err := GetAndValidateVolcImageRequest(c)
	if err != nil {
		t.Fatalf("unexpected error for body with model_name: %v", err)
	}
	if req.Model != "high-aes-general-v21-L" {
		t.Errorf("expected model=%q (from model_name), got %q", "high-aes-general-v21-L", req.Model)
	}
}

// TestGetAndValidateVolcImageRequest_ReqKeyFallback verifies that when both
// "model" and "model_name" are absent, req.Model is populated from "req_key".
func TestGetAndValidateVolcImageRequest_ReqKeyFallback(t *testing.T) {
	body := `{"req_key":"high-aes-general-v21-L","prompt":"cinematic shot"}`
	c := newTestContextWithBody(t, body)

	req, err := GetAndValidateVolcImageRequest(c)
	if err != nil {
		t.Fatalf("unexpected error for body with req_key: %v", err)
	}
	if req.Model != "high-aes-general-v21-L" {
		t.Errorf("expected model=%q (from req_key), got %q", "high-aes-general-v21-L", req.Model)
	}
}

// TestGetAndValidateVolcImageRequest_ModelTakesPrecedence verifies that when
// "model", "model_name", and "req_key" are all present, "model" wins.
func TestGetAndValidateVolcImageRequest_ModelTakesPrecedence(t *testing.T) {
	body := `{"model":"primary-model","model_name":"secondary","req_key":"tertiary"}`
	c := newTestContextWithBody(t, body)

	req, err := GetAndValidateVolcImageRequest(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req.Model != "primary-model" {
		t.Errorf("expected 'primary-model' to take precedence, got %q", req.Model)
	}
}

// TestGetAndValidateVolcImageRequest_AllFieldsMissing verifies that when none
// of model/model_name/req_key are present, an error is returned.
func TestGetAndValidateVolcImageRequest_AllFieldsMissing(t *testing.T) {
	body := `{"prompt":"cinematic shot"}`
	c := newTestContextWithBody(t, body)

	_, err := GetAndValidateVolcImageRequest(c)
	if err == nil {
		t.Fatal("expected error when no model identifier is present, got nil")
	}
	if err.Error() != "model is required" {
		t.Errorf("error message: got %q, want %q", err.Error(), "model is required")
	}
}
