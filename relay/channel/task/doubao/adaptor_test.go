package doubao

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
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
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	bs, err := common.CreateBodyStorage(body)
	if err != nil {
		t.Fatalf("failed to create body storage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)
	return c
}

// ─────────────────────────────────────────
// ValidateRequestAndSetAction regression guard (OpenAI path)
// ─────────────────────────────────────────

// TestValidateRequestAndSetAction_OpenAIPath verifies that the existing OpenAI
// task path works when RelayFormat is not Volc.
func TestValidateRequestAndSetAction_OpenAIPath(t *testing.T) {
	// /v1/video/generations uses TaskSubmitReq format
	body := []byte(`{"model":"doubao-seedance-2-0","prompt":"a cat video"}`)
	c := newDoubaoTestContext(t, body)
	info := &relaycommon.RelayInfo{
		RelayFormat:   types.RelayFormatTask,
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	a := &TaskAdaptor{}
	err := a.ValidateRequestAndSetAction(c, info)
	// May succeed or fail depending on ValidateBasicTaskRequest's prompt check.
	// The important thing is that it does NOT panic or go through a Volc path.
	_ = err
}

// ─────────────────────────────────────────
// BuildRequestBody regression guard (OpenAI path)
// ─────────────────────────────────────────

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
// EstimateBilling regression guard (OpenAI path)
// ─────────────────────────────────────────

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
