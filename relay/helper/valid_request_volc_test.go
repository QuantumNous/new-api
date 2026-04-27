package helper

import (
	"bytes"
	"net/http"
	"net/http/httptest"
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
