package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestGetStatusExposesSMSEnabledForRegistration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalSMSEnabled := common.SMSEnabled
	t.Cleanup(func() {
		common.SMSEnabled = originalSMSEnabled
	})

	common.SMSEnabled = true

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success response: %s", recorder.Body.String())
	}
	if response.Data["sms_enabled"] != true {
		t.Fatalf("expected sms_enabled=true in status data, got %+v", response.Data["sms_enabled"])
	}
}
