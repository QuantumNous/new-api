package common

import (
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"math/big"
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

func SMSVerificationPurpose(scene string) string {
	return "sms:" + strings.TrimSpace(scene)
}

func GenerateSMSVerificationCode(length int) (string, error) {
	if length <= 0 {
		length = 6
	}
	code := make([]byte, length)
	for i := range code {
		value, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		code[i] = byte('0' + value.Int64())
	}
	return string(code), nil
}

type SMSVerificationTemplateConfig struct {
	Signature             string
	SignatureReviewStatus string
	Template              string
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
		Template:              SMSTemplate,
	}
}

func SMSVerificationTemplateVersion(scene string) string {
	return SMSVerificationTemplateVersionFromConfig(scene, DefaultSMSVerificationTemplateConfig())
}

func SMSVerificationTemplateVersionFromConfig(scene string, config SMSVerificationTemplateConfig) string {
	if config.Template == "" {
		config = DefaultSMSVerificationTemplateConfig()
	}
	normalizedScene := strings.TrimSpace(scene)
	template := strings.TrimSpace(config.Template)
	if normalizedScene == "" || template == "" {
		return ""
	}
	signature := strings.TrimSpace(config.Signature)
	digest := sha256.Sum256([]byte(normalizedScene + "\x00" + signature + "\x00" + template))
	return fmt.Sprintf("%s:%x", normalizedScene, digest[:6])
}

func RenderSMSVerificationContent(input SMSVerificationContentInput) (string, error) {
	config := input.Config
	if config.Template == "" {
		config = DefaultSMSVerificationTemplateConfig()
	}
	if strings.TrimSpace(config.SignatureReviewStatus) != SMSSignatureStatusApproved {
		return "", fmt.Errorf("sms signature is not approved")
	}
	signature := strings.TrimSpace(config.Signature)
	if signature == "" {
		return "", fmt.Errorf("sms signature is not configured")
	}
	template := strings.TrimSpace(config.Template)
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
