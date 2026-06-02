package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func TestGetOptionsHidesSMSBaoCredential(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalMap := common.OptionMap
	t.Cleanup(func() {
		common.OptionMap = originalMap
	})
	common.OptionMap = map[string]string{
		"SMSEnabled":       "true",
		"SMSBaoCredential": "redacted-test-value",
		"SMSBaoUsername":   "demo-user",
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)

	GetOptions(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Success bool            `json:"success"`
		Data    []*model.Option `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	for _, option := range response.Data {
		if option.Key == "SMSBaoCredential" {
			t.Fatalf("SMSBaoCredential should be hidden from option response")
		}
		if option.Value == "redacted-test-value" {
			t.Fatalf("SMSBaoCredential value leaked in option response")
		}
	}
}
