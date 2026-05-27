package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/gin-gonic/gin"
)

func TestGetStatusIncludesApiInfoEnabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	settings := console_setting.GetConsoleSetting()
	oldSettings := *settings
	t.Cleanup(func() { *settings = oldSettings })
	settings.ApiInfoEnabled = false

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var body struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.Success {
		t.Fatalf("expected success response, got %s", recorder.Body.String())
	}
	value, exists := body.Data["api_info_enabled"]
	if !exists {
		t.Fatalf("expected api_info_enabled to be present, got response %s", recorder.Body.String())
	}
	if value != false {
		t.Fatalf("expected api_info_enabled=false to be present, got response %s", recorder.Body.String())
	}
}
