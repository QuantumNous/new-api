package volcengine

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func TestConvertVolcRequest_NoOpPassThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	a := &Adaptor{}
	info := &relaycommon.RelayInfo{}

	req := &dto.VolcImageRequest{
		Model:  "high-aes-general-v21-L",
		Prompt: "a beautiful sunset",
		Size:   "2K",
	}

	got, err := a.ConvertVolcRequest(c, info, req)
	if err != nil {
		t.Fatalf("ConvertVolcRequest returned unexpected error: %v", err)
	}
	// Should return the request pointer unchanged
	gotReq, ok := got.(*dto.VolcImageRequest)
	if !ok {
		t.Fatalf("ConvertVolcRequest returned %T, want *dto.VolcImageRequest", got)
	}
	if gotReq != req {
		t.Errorf("ConvertVolcRequest should return the same pointer, got different pointer")
	}
	if gotReq.Model != req.Model {
		t.Errorf("Model mismatch: got %q, want %q", gotReq.Model, req.Model)
	}
	if gotReq.Size != req.Size {
		t.Errorf("Size mismatch: got %q, want %q", gotReq.Size, req.Size)
	}
}

func TestConvertVolcRequest_NilRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	a := &Adaptor{}
	info := &relaycommon.RelayInfo{}

	got, err := a.ConvertVolcRequest(c, info, nil)
	if err != nil {
		t.Fatalf("ConvertVolcRequest(nil) returned unexpected error: %v", err)
	}
	// nil *dto.VolcImageRequest passed in → the any wrapper contains nil pointer.
	// We can't use got != nil here because interface-wrapped nil is not equal to untyped nil.
	// Instead, verify the returned value is a *dto.VolcImageRequest holding nil.
	if got != nil {
		// Only complain if a non-nil typed value was returned
		if reqPtr, ok := got.(*dto.VolcImageRequest); ok && reqPtr != nil {
			t.Errorf("expected nil *dto.VolcImageRequest, got non-nil %v", reqPtr)
		}
	}
}
