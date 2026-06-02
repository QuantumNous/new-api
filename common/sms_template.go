package common

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	SMSSceneRegister      = "register"
	SMSSceneLogin         = "login"
	SMSSceneBindPhone     = "bind_phone"
	SMSSceneChangePhone   = "change_phone"
	SMSSceneResetPassword = "reset_password"

	SMSSignatureStatusPending  = "pending"
	SMSSignatureStatusApproved = "approved"
	SMSSignatureStatusRejected = "rejected"
)

type SMSVerificationTemplateConfig struct {
	Signature             string
	SignatureReviewStatus string
	Templates             map[string]string
}

type SMSVerificationContentInput struct {
	Scene        string
	Code         string
	ValidMinutes int
	SiteName     string
	ProductName  string
	Config       SMSVerificationTemplateConfig
}

func DefaultSMSVerificationTemplateConfig() SMSVerificationTemplateConfig {
	return SMSVerificationTemplateConfig{
		Signature:             SMSSignature,
		SignatureReviewStatus: SMSSignatureReviewStatus,
		Templates: map[string]string{
			SMSSceneRegister:      SMSRegisterTemplate,
			SMSSceneLogin:         SMSLoginTemplate,
			SMSSceneBindPhone:     SMSBindTemplate,
			SMSSceneChangePhone:   SMSChangeTemplate,
			SMSSceneResetPassword: SMSResetPasswordTemplate,
		},
	}
}

func RenderSMSVerificationContent(input SMSVerificationContentInput) (string, error) {
	config := input.Config
	if config.Templates == nil {
		config = DefaultSMSVerificationTemplateConfig()
	}
	if strings.TrimSpace(config.SignatureReviewStatus) != SMSSignatureStatusApproved {
		return "", fmt.Errorf("sms signature is not approved")
	}
	signature := strings.TrimSpace(config.Signature)
	if signature == "" {
		return "", fmt.Errorf("sms signature is not configured")
	}
	scene := strings.TrimSpace(input.Scene)
	template := strings.TrimSpace(config.Templates[scene])
	if template == "" {
		return "", fmt.Errorf("sms template is not configured")
	}
	code := strings.TrimSpace(input.Code)
	if code == "" {
		return "", fmt.Errorf("sms verification code is empty")
	}
	validMinutes := input.ValidMinutes
	if validMinutes <= 0 {
		validMinutes = SMSCodeValidMinutes
	}
	productName := strings.TrimSpace(input.ProductName)
	if productName == "" {
		productName = strings.TrimSpace(SMSProductName)
	}
	siteName := strings.TrimSpace(input.SiteName)
	if siteName == "" {
		siteName = strings.TrimSpace(SystemName)
	}

	content := template
	replacements := map[string]string{
		"{code}":    code,
		"{minutes}": strconv.Itoa(validMinutes),
		"{product}": productName,
		"{site}":    siteName,
	}
	for placeholder, value := range replacements {
		content = strings.ReplaceAll(content, placeholder, value)
	}
	return fmt.Sprintf("【%s】%s", signature, content), nil
}
