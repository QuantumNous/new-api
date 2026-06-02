package common

import "testing"

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
			Templates: map[string]string{
				SMSSceneRegister: "{site} {product} 验证码 {code}，{minutes} 分钟内有效。",
			},
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
			Templates: map[string]string{
				SMSSceneLogin: "验证码 {code}",
			},
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
			Templates:             map[string]string{},
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
	originalRegisterTemplate := SMSRegisterTemplate
	t.Cleanup(func() {
		SMSSignature = originalSignature
		SMSSignatureReviewStatus = originalStatus
		SMSProductName = originalProductName
		SMSRegisterTemplate = originalRegisterTemplate
	})

	SMSSignature = "NewAPI"
	SMSSignatureReviewStatus = SMSSignatureStatusApproved
	SMSProductName = "分销系统"
	SMSRegisterTemplate = "{product} 注册验证码 {code}"

	content, err := RenderSMSVerificationContent(SMSVerificationContentInput{
		Scene: SMSSceneRegister,
		Code:  "654321",
	})
	if err != nil {
		t.Fatalf("RenderSMSVerificationContent returned error: %v", err)
	}
	if content != "【NewAPI】分销系统 注册验证码 654321" {
		t.Fatalf("unexpected content: %q", content)
	}
}
