package helper

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

func TestGetAndValidateResponsesRequest_AllowsMissingInput(t *testing.T) {
	constant.MaxRequestBodyMB = 20

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	c.Request = &http.Request{
		Method: "POST",
		URL:    nil,
		Body:   io.NopCloser(bytes.NewBufferString(`{"model":"gpt-4o-mini"}`)),
		Header: make(http.Header),
	}
	c.Request.Header.Set("Content-Type", "application/json")

	req, err := GetAndValidateResponsesRequest(c)
	if err != nil {
		t.Fatalf("GetAndValidateResponsesRequest() error: %v", err)
	}
	if req == nil {
		t.Fatal("GetAndValidateResponsesRequest() returned nil request")
	}
	if req.Model != "gpt-4o-mini" {
		t.Fatalf("Model = %q, want %q", req.Model, "gpt-4o-mini")
	}
	if req.Input != nil {
		t.Fatalf("Input = %v, want nil", req.Input)
	}
}
