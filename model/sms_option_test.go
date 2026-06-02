package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestSMSOptionMapInitializesProviderSettings(t *testing.T) {
	originalMap := common.OptionMap
	originalEnabled := common.SMSEnabled
	originalProvider := common.SMSProviderName
	originalEndpoint := common.SMSBaoEndpoint
	originalCredentialMode := common.SMSBaoCredentialMode
	t.Cleanup(func() {
		common.OptionMap = originalMap
		common.SMSEnabled = originalEnabled
		common.SMSProviderName = originalProvider
		common.SMSBaoEndpoint = originalEndpoint
		common.SMSBaoCredentialMode = originalCredentialMode
	})

	common.OptionMap = map[string]string{}
	common.SMSEnabled = false
	common.SMSProviderName = common.SMSProviderSMSBao
	common.SMSBaoEndpoint = common.DefaultSMSBaoEndpoint
	common.SMSBaoCredentialMode = common.SMSBaoCredentialModeAPIKey

	InitOptionMap()

	if common.OptionMap["SMSEnabled"] != "false" {
		t.Fatalf("expected SMSEnabled option false, got %q", common.OptionMap["SMSEnabled"])
	}
	if common.OptionMap["SMSProvider"] != common.SMSProviderSMSBao {
		t.Fatalf("expected SMSProvider smsbao, got %q", common.OptionMap["SMSProvider"])
	}
	if common.OptionMap["SMSBaoEndpoint"] != common.DefaultSMSBaoEndpoint {
		t.Fatalf("expected SMSBaoEndpoint default, got %q", common.OptionMap["SMSBaoEndpoint"])
	}
	if common.OptionMap["SMSBaoCredentialMode"] != common.SMSBaoCredentialModeAPIKey {
		t.Fatalf("expected SMSBaoCredentialMode api_key, got %q", common.OptionMap["SMSBaoCredentialMode"])
	}
	if common.OptionMap["SMSBaoCredential"] != "" {
		t.Fatal("SMSBaoCredential should not be exposed with an existing value")
	}
}

func TestUpdateOptionMapUpdatesSMSProviderSettings(t *testing.T) {
	originalMap := common.OptionMap
	originalEnabled := common.SMSEnabled
	originalProvider := common.SMSProviderName
	originalEndpoint := common.SMSBaoEndpoint
	originalUsername := common.SMSBaoUsername
	originalCredential := common.SMSBaoCredential
	originalCredentialMode := common.SMSBaoCredentialMode
	originalProductID := common.SMSBaoProductID
	t.Cleanup(func() {
		common.OptionMap = originalMap
		common.SMSEnabled = originalEnabled
		common.SMSProviderName = originalProvider
		common.SMSBaoEndpoint = originalEndpoint
		common.SMSBaoUsername = originalUsername
		common.SMSBaoCredential = originalCredential
		common.SMSBaoCredentialMode = originalCredentialMode
		common.SMSBaoProductID = originalProductID
	})

	common.OptionMap = map[string]string{}

	if err := updateOptionMap("SMSEnabled", "true"); err != nil {
		t.Fatalf("update SMSEnabled: %v", err)
	}
	if err := updateOptionMap("SMSProvider", common.SMSProviderSMSBao); err != nil {
		t.Fatalf("update SMSProvider: %v", err)
	}
	if err := updateOptionMap("SMSBaoEndpoint", "https://sms.example.test/sms"); err != nil {
		t.Fatalf("update SMSBaoEndpoint: %v", err)
	}
	if err := updateOptionMap("SMSBaoUsername", "demo-user"); err != nil {
		t.Fatalf("update SMSBaoUsername: %v", err)
	}
	if err := updateOptionMap("SMSBaoCredential", "demo-key"); err != nil {
		t.Fatalf("update SMSBaoCredential: %v", err)
	}
	if err := updateOptionMap("SMSBaoCredentialMode", common.SMSBaoCredentialModeMD5Password); err != nil {
		t.Fatalf("update SMSBaoCredentialMode: %v", err)
	}
	if err := updateOptionMap("SMSBaoProductID", "vip-001"); err != nil {
		t.Fatalf("update SMSBaoProductID: %v", err)
	}

	if !common.SMSEnabled || common.SMSProviderName != common.SMSProviderSMSBao || common.SMSBaoEndpoint != "https://sms.example.test/sms" {
		t.Fatalf("unexpected SMS option values: enabled=%v provider=%q endpoint=%q", common.SMSEnabled, common.SMSProviderName, common.SMSBaoEndpoint)
	}
	if common.SMSBaoUsername != "demo-user" || common.SMSBaoCredential != "demo-key" || common.SMSBaoCredentialMode != common.SMSBaoCredentialModeMD5Password || common.SMSBaoProductID != "vip-001" {
		t.Fatalf("unexpected SMSBao option values: username=%q credential=%q mode=%q product=%q", common.SMSBaoUsername, common.SMSBaoCredential, common.SMSBaoCredentialMode, common.SMSBaoProductID)
	}
}
