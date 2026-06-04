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
	originalQueryEndpoint := common.SMSBaoQueryEndpoint
	originalCredentialMode := common.SMSBaoCredentialMode
	originalRateLimitEnabled := common.SMSRateLimitEnabled
	originalRateLimitWindow := common.SMSRateLimitWindowSeconds
	originalRateLimitPhone := common.SMSRateLimitPhoneCount
	originalRateLimitIP := common.SMSRateLimitIPCount
	originalRateLimitAccount := common.SMSRateLimitAccountCount
	originalRateLimitScene := common.SMSRateLimitSceneCount
	t.Cleanup(func() {
		common.OptionMap = originalMap
		common.SMSEnabled = originalEnabled
		common.SMSProviderName = originalProvider
		common.SMSBaoEndpoint = originalEndpoint
		common.SMSBaoQueryEndpoint = originalQueryEndpoint
		common.SMSBaoCredentialMode = originalCredentialMode
		common.SMSRateLimitEnabled = originalRateLimitEnabled
		common.SMSRateLimitWindowSeconds = originalRateLimitWindow
		common.SMSRateLimitPhoneCount = originalRateLimitPhone
		common.SMSRateLimitIPCount = originalRateLimitIP
		common.SMSRateLimitAccountCount = originalRateLimitAccount
		common.SMSRateLimitSceneCount = originalRateLimitScene
	})

	common.OptionMap = map[string]string{}
	common.SMSEnabled = false
	common.SMSProviderName = common.SMSProviderSMSBao
	common.SMSBaoEndpoint = common.DefaultSMSBaoEndpoint
	common.SMSBaoQueryEndpoint = common.DefaultSMSBaoQueryEndpoint
	common.SMSBaoCredentialMode = common.SMSBaoCredentialModeAPIKey
	common.SMSRateLimitEnabled = true
	common.SMSRateLimitWindowSeconds = 60
	common.SMSRateLimitPhoneCount = 1
	common.SMSRateLimitIPCount = 10
	common.SMSRateLimitAccountCount = 5
	common.SMSRateLimitSceneCount = 100

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
	if common.OptionMap["SMSBaoQueryEndpoint"] != common.DefaultSMSBaoQueryEndpoint {
		t.Fatalf("expected SMSBaoQueryEndpoint default, got %q", common.OptionMap["SMSBaoQueryEndpoint"])
	}
	if common.OptionMap["SMSBaoCredentialMode"] != common.SMSBaoCredentialModeAPIKey {
		t.Fatalf("expected SMSBaoCredentialMode api_key, got %q", common.OptionMap["SMSBaoCredentialMode"])
	}
	if common.OptionMap["SMSBaoCredential"] != "" {
		t.Fatal("SMSBaoCredential should not be exposed with an existing value")
	}
	expectedLimits := map[string]string{
		"SMSRateLimitEnabled":       "true",
		"SMSRateLimitWindowSeconds": "60",
		"SMSRateLimitPhoneCount":    "1",
		"SMSRateLimitIPCount":       "10",
		"SMSRateLimitAccountCount":  "5",
		"SMSRateLimitSceneCount":    "100",
	}
	for key, expected := range expectedLimits {
		if common.OptionMap[key] != expected {
			t.Fatalf("expected %s option %q, got %q", key, expected, common.OptionMap[key])
		}
	}
}

func TestUpdateOptionMapUpdatesSMSProviderSettings(t *testing.T) {
	originalMap := common.OptionMap
	originalEnabled := common.SMSEnabled
	originalProvider := common.SMSProviderName
	originalEndpoint := common.SMSBaoEndpoint
	originalQueryEndpoint := common.SMSBaoQueryEndpoint
	originalUsername := common.SMSBaoUsername
	originalCredential := common.SMSBaoCredential
	originalCredentialMode := common.SMSBaoCredentialMode
	originalProductID := common.SMSBaoProductID
	originalRateLimitEnabled := common.SMSRateLimitEnabled
	originalRateLimitWindow := common.SMSRateLimitWindowSeconds
	originalRateLimitPhone := common.SMSRateLimitPhoneCount
	originalRateLimitIP := common.SMSRateLimitIPCount
	originalRateLimitAccount := common.SMSRateLimitAccountCount
	originalRateLimitScene := common.SMSRateLimitSceneCount
	t.Cleanup(func() {
		common.OptionMap = originalMap
		common.SMSEnabled = originalEnabled
		common.SMSProviderName = originalProvider
		common.SMSBaoEndpoint = originalEndpoint
		common.SMSBaoQueryEndpoint = originalQueryEndpoint
		common.SMSBaoUsername = originalUsername
		common.SMSBaoCredential = originalCredential
		common.SMSBaoCredentialMode = originalCredentialMode
		common.SMSBaoProductID = originalProductID
		common.SMSRateLimitEnabled = originalRateLimitEnabled
		common.SMSRateLimitWindowSeconds = originalRateLimitWindow
		common.SMSRateLimitPhoneCount = originalRateLimitPhone
		common.SMSRateLimitIPCount = originalRateLimitIP
		common.SMSRateLimitAccountCount = originalRateLimitAccount
		common.SMSRateLimitSceneCount = originalRateLimitScene
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
	if err := updateOptionMap("SMSBaoQueryEndpoint", "https://sms.example.test/query"); err != nil {
		t.Fatalf("update SMSBaoQueryEndpoint: %v", err)
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
	if err := updateOptionMap("SMSRateLimitEnabled", "true"); err != nil {
		t.Fatalf("update SMSRateLimitEnabled: %v", err)
	}
	if err := updateOptionMap("SMSRateLimitWindowSeconds", "120"); err != nil {
		t.Fatalf("update SMSRateLimitWindowSeconds: %v", err)
	}
	if err := updateOptionMap("SMSRateLimitPhoneCount", "2"); err != nil {
		t.Fatalf("update SMSRateLimitPhoneCount: %v", err)
	}
	if err := updateOptionMap("SMSRateLimitIPCount", "20"); err != nil {
		t.Fatalf("update SMSRateLimitIPCount: %v", err)
	}
	if err := updateOptionMap("SMSRateLimitAccountCount", "8"); err != nil {
		t.Fatalf("update SMSRateLimitAccountCount: %v", err)
	}
	if err := updateOptionMap("SMSRateLimitSceneCount", "200"); err != nil {
		t.Fatalf("update SMSRateLimitSceneCount: %v", err)
	}

	if !common.SMSEnabled || common.SMSProviderName != common.SMSProviderSMSBao || common.SMSBaoEndpoint != "https://sms.example.test/sms" || common.SMSBaoQueryEndpoint != "https://sms.example.test/query" {
		t.Fatalf("unexpected SMS option values: enabled=%v provider=%q endpoint=%q query_endpoint=%q", common.SMSEnabled, common.SMSProviderName, common.SMSBaoEndpoint, common.SMSBaoQueryEndpoint)
	}
	if common.SMSBaoUsername != "demo-user" || common.SMSBaoCredential != "demo-key" || common.SMSBaoCredentialMode != common.SMSBaoCredentialModeMD5Password || common.SMSBaoProductID != "vip-001" {
		t.Fatalf("unexpected SMSBao option values: username=%q credential=%q mode=%q product=%q", common.SMSBaoUsername, common.SMSBaoCredential, common.SMSBaoCredentialMode, common.SMSBaoProductID)
	}
	if !common.SMSRateLimitEnabled || common.SMSRateLimitWindowSeconds != 120 || common.SMSRateLimitPhoneCount != 2 || common.SMSRateLimitIPCount != 20 || common.SMSRateLimitAccountCount != 8 || common.SMSRateLimitSceneCount != 200 {
		t.Fatalf("unexpected SMS rate limit values: enabled=%v window=%d phone=%d ip=%d account=%d scene=%d", common.SMSRateLimitEnabled, common.SMSRateLimitWindowSeconds, common.SMSRateLimitPhoneCount, common.SMSRateLimitIPCount, common.SMSRateLimitAccountCount, common.SMSRateLimitSceneCount)
	}
}

func TestSMSOptionMapInitializesTemplateSettings(t *testing.T) {
	originalMap := common.OptionMap
	originalSignature := common.SMSSignature
	originalStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	t.Cleanup(func() {
		common.OptionMap = originalMap
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
	})

	common.OptionMap = map[string]string{}
	common.SMSSignature = "NewAPI"
	common.SMSSignatureReviewStatus = common.SMSSignatureStatusPending
	common.SMSProductName = "分销系统"
	common.SMSTemplate = "{product} 验证码 {code}"

	InitOptionMap()

	if common.OptionMap["SMSSignature"] != "NewAPI" {
		t.Fatalf("expected SMSSignature option, got %q", common.OptionMap["SMSSignature"])
	}
	if common.OptionMap["SMSSignatureReviewStatus"] != common.SMSSignatureStatusPending {
		t.Fatalf("expected SMSSignatureReviewStatus pending, got %q", common.OptionMap["SMSSignatureReviewStatus"])
	}
	if common.OptionMap["SMSProductName"] != "分销系统" {
		t.Fatalf("expected SMSProductName option, got %q", common.OptionMap["SMSProductName"])
	}
	if common.OptionMap["SMSTemplate"] != "{product} 验证码 {code}" {
		t.Fatalf("expected SMSTemplate option, got %q", common.OptionMap["SMSTemplate"])
	}
}

func TestUpdateOptionMapUpdatesSMSTemplateSettings(t *testing.T) {
	originalMap := common.OptionMap
	originalSignature := common.SMSSignature
	originalStatus := common.SMSSignatureReviewStatus
	originalProductName := common.SMSProductName
	originalTemplate := common.SMSTemplate
	t.Cleanup(func() {
		common.OptionMap = originalMap
		common.SMSSignature = originalSignature
		common.SMSSignatureReviewStatus = originalStatus
		common.SMSProductName = originalProductName
		common.SMSTemplate = originalTemplate
	})

	common.OptionMap = map[string]string{}
	settings := map[string]string{
		"SMSSignature":             "NewAPI",
		"SMSSignatureReviewStatus": common.SMSSignatureStatusApproved,
		"SMSProductName":           "分销系统",
		"SMSTemplate":              "验证码 {code}",
	}
	for key, value := range settings {
		if err := updateOptionMap(key, value); err != nil {
			t.Fatalf("update %s: %v", key, err)
		}
	}

	if common.SMSSignature != "NewAPI" || common.SMSSignatureReviewStatus != common.SMSSignatureStatusApproved || common.SMSProductName != "分销系统" {
		t.Fatalf("unexpected SMS signature settings: signature=%q status=%q product=%q", common.SMSSignature, common.SMSSignatureReviewStatus, common.SMSProductName)
	}
	if common.SMSTemplate != "验证码 {code}" {
		t.Fatalf("unexpected SMS template: %q", common.SMSTemplate)
	}
}
