package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func TestGetTopUpInfoIncludesConfiguredAirwallex(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentSetting := operation_setting.GetPaymentSetting()
	oldPaymentSetting := *paymentSetting
	t.Cleanup(func() { *paymentSetting = oldPaymentSetting })
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	airwallexSetting := operation_setting.GetAirwallexSetting()
	oldAirwallexSetting := *airwallexSetting
	t.Cleanup(func() { *airwallexSetting = oldAirwallexSetting })
	airwallexSetting.Enabled = true
	airwallexSetting.Accounts = map[string]operation_setting.AirwallexAccount{
		"b2c": {
			Enabled:       true,
			BaseURL:       "https://api.airwallex.com",
			ClientID:      "client-id",
			APIKey:        "api-key",
			WebhookSecret: "webhook-secret",
		},
	}
	airwallexSetting.AllowedPaymentMethods = []string{"card", "alipaycn", "googlepay"}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)

	GetTopUpInfo(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			EnableAirwallexTopup  bool     `json:"enable_airwallex_topup"`
			AirwallexDefaultBiz   string   `json:"airwallex_default_biz"`
			AirwallexAvailableBiz []string `json:"airwallex_available_biz"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.Success {
		t.Fatalf("expected success response, got %s", recorder.Body.String())
	}
	if !body.Data.EnableAirwallexTopup {
		t.Fatalf("expected Airwallex topup to be enabled, got response %s", recorder.Body.String())
	}
	if body.Data.AirwallexDefaultBiz != "b2c" {
		t.Fatalf("expected default biz b2c, got %q", body.Data.AirwallexDefaultBiz)
	}
	if len(body.Data.AirwallexAvailableBiz) != 1 || body.Data.AirwallexAvailableBiz[0] != "b2c" {
		t.Fatalf("expected available biz [b2c], got %#v", body.Data.AirwallexAvailableBiz)
	}
}

func TestGetTopUpInfoHidesEpayMethodsWhenEpayGatewayIsDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentSetting := operation_setting.GetPaymentSetting()
	oldPaymentSetting := *paymentSetting
	t.Cleanup(func() { *paymentSetting = oldPaymentSetting })
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})
	operation_setting.PayAddress = ""
	operation_setting.EpayId = ""
	operation_setting.EpayKey = ""
	operation_setting.PayMethods = []map[string]string{
		{"name": "Alipay", "type": "alipay"},
		{"name": "WeChat Pay", "type": "wxpay"},
	}

	airwallexSetting := operation_setting.GetAirwallexSetting()
	oldAirwallexSetting := *airwallexSetting
	t.Cleanup(func() { *airwallexSetting = oldAirwallexSetting })
	airwallexSetting.Enabled = true
	airwallexSetting.Accounts = map[string]operation_setting.AirwallexAccount{
		"b2c": {
			Enabled:       true,
			BaseURL:       "https://api.airwallex.com",
			ClientID:      "client-id",
			APIKey:        "api-key",
			WebhookSecret: "webhook-secret",
		},
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)

	GetTopUpInfo(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			EnableOnlineTopup    bool                `json:"enable_online_topup"`
			EnableAirwallexTopup bool                `json:"enable_airwallex_topup"`
			PayMethods           []map[string]string `json:"pay_methods"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.Success {
		t.Fatalf("expected success response, got %s", recorder.Body.String())
	}
	if body.Data.EnableOnlineTopup {
		t.Fatalf("expected epay topup disabled")
	}
	if !body.Data.EnableAirwallexTopup {
		t.Fatalf("expected Airwallex topup enabled")
	}
	if len(body.Data.PayMethods) != 0 {
		t.Fatalf("expected no epay pay methods when epay is disabled, got %#v", body.Data.PayMethods)
	}
}
