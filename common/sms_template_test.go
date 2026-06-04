package common

import (
	"strings"
	"testing"
)

func TestRenderSMSVerificationContentUsesApprovedSignatureAndTemplateVariables(t *testing.T) {
	content, err := RenderSMSVerificationContent(SMSVerificationContentInput{
		Scene:        SMSSceneRegister,
		Code:         "123456",
		ValidMinutes: 5,
		SiteName:     "Rain API",
		ProductName:  "分销系统",
		Config: SMSVerificationTemplateConfig{
			Signature:             "NewAPI",
			SignatureReviewStatus: SMSSignatureStatusApproved,
			Template:              "{site} {product} 验证码 {code}，{minutes} 分钟内有效。",
		},
	})
	if err != nil {
		t.Fatalf("RenderSMSVerificationContent returned error: %v", err)
	}
	expected := "【NewAPI】Rain API 分销系统 验证码 123456，5 分钟内有效。"
	if content != expected {
		t.Fatalf("unexpected content: %q", content)
	}
}

func TestRenderSMSVerificationContentRejectsUnapprovedSignature(t *testing.T) {
	_, err := RenderSMSVerificationContent(SMSVerificationContentInput{
		Scene: SMSSceneLogin,
		Code:  "123456",
		Config: SMSVerificationTemplateConfig{
			Signature:             "NewAPI",
			SignatureReviewStatus: SMSSignatureStatusPending,
			Template:              "验证码 {code}",
		},
	})
	if err == nil || err.Error() != "sms signature is not approved" {
		t.Fatalf("expected unapproved signature error, got %v", err)
	}
}

func TestRenderSMSVerificationContentRejectsMissingTemplate(t *testing.T) {
	_, err := RenderSMSVerificationContent(SMSVerificationContentInput{
		Scene: SMSSceneChangePhone,
		Code:  "123456",
		Config: SMSVerificationTemplateConfig{
			Signature:             "NewAPI",
			SignatureReviewStatus: SMSSignatureStatusApproved,
			Template:              " ",
		},
	})
	if err == nil || err.Error() != "sms template is not configured" {
		t.Fatalf("expected missing template error, got %v", err)
	}
}

func TestDefaultSMSVerificationTemplateConfigUsesGlobals(t *testing.T) {
	originalSignature := SMSSignature
	originalStatus := SMSSignatureReviewStatus
	originalProductName := SMSProductName
	originalTemplate := SMSTemplate
	t.Cleanup(func() {
		SMSSignature = originalSignature
		SMSSignatureReviewStatus = originalStatus
		SMSProductName = originalProductName
		SMSTemplate = originalTemplate
	})

	SMSSignature = "NewAPI"
	SMSSignatureReviewStatus = SMSSignatureStatusApproved
	SMSProductName = "分销系统"
	SMSTemplate = "{product} 验证码 {code}"

	content, err := RenderSMSVerificationContent(SMSVerificationContentInput{
		Scene: SMSSceneRegister,
		Code:  "654321",
	})
	if err != nil {
		t.Fatalf("RenderSMSVerificationContent returned error: %v", err)
	}
	if content != "【NewAPI】分销系统 验证码 654321" {
		t.Fatalf("unexpected content: %q", content)
	}
}

func TestSMSVerificationTemplateVersionKeepsSceneButDoesNotIncludeCodeOrTemplateBody(t *testing.T) {
	version := SMSVerificationTemplateVersionFromConfig(SMSSceneRegister, SMSVerificationTemplateConfig{
		Signature:             "NewAPI",
		SignatureReviewStatus: SMSSignatureStatusApproved,
		Template:              "验证码 {code}，{minutes} 分钟内有效。",
	})
	if version == "" {
		t.Fatal("expected template version")
	}
	if !strings.HasPrefix(version, SMSSceneRegister+":") {
		t.Fatalf("expected scene-scoped template version, got %s", version)
	}
	for _, forbidden := range []string{"123456", "{code}", "验证码"} {
		if strings.Contains(version, forbidden) {
			t.Fatalf("template version leaked %q: %s", forbidden, version)
		}
	}
}
