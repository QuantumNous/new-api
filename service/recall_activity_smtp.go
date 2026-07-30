package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const (
	RecallActivitySMTPNotConfiguredCode    = "activity_smtp_not_configured"
	RecallActivitySMTPNotConfiguredMessage = "Activity SMTP settings are incomplete or invalid. Configure Activity SMTP settings before activating or sending recall emails."
	RecallActivitySMTPSendFailedCode       = "activity_smtp_send_failed"
	RecallActivitySMTPSendFailedMessage    = "Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry."
)

type recallActivitySMTPError struct {
	code    string
	message string
}

func (e recallActivitySMTPError) Error() string {
	return fmt.Sprintf("%s: %s", e.code, e.message)
}

func (e recallActivitySMTPError) Code() string {
	return e.code
}

func (e recallActivitySMTPError) Message() string {
	return e.message
}

func newRecallActivitySMTPNotConfiguredError() error {
	return recallActivitySMTPError{code: RecallActivitySMTPNotConfiguredCode, message: RecallActivitySMTPNotConfiguredMessage}
}

type RecallActivitySMTPInput struct {
	Server         string `json:"server"`
	Port           int    `json:"port"`
	Account        string `json:"account"`
	EmailFrom      string `json:"email_from"`
	Token          string `json:"token"`
	SSLEnabled     bool   `json:"ssl_enabled"`
	ForceAuthLogin bool   `json:"force_auth_login"`
}

type RecallActivitySMTPStatus struct {
	Server          string `json:"server"`
	Port            int    `json:"port"`
	Account         string `json:"account"`
	EmailFrom       string `json:"email_from"`
	SSLEnabled      bool   `json:"ssl_enabled"`
	ForceAuthLogin  bool   `json:"force_auth_login"`
	TokenConfigured bool   `json:"token_configured"`
	Configured      bool   `json:"configured"`
}

func GetRecallActivitySMTPStatus() RecallActivitySMTPStatus {
	return recallActivitySMTPStatus(recallActivitySMTPConfigFromSetting(operation_setting.GetRecallCampaignSetting()))
}

func RecallActivitySMTPSnapshot() (common.SMTPConfig, error) {
	config := recallActivitySMTPConfigFromSetting(operation_setting.GetRecallCampaignSetting())
	return config, config.Validate()
}

func recallActivitySMTPPreflight() (common.SMTPConfig, error) {
	snapshot, err := RecallActivitySMTPSnapshot()
	if err != nil {
		return common.SMTPConfig{}, newRecallActivitySMTPNotConfiguredError()
	}
	return snapshot, nil
}

func UpdateRecallActivitySMTP(input RecallActivitySMTPInput) (RecallActivitySMTPStatus, error) {
	submitted := common.SMTPConfig{
		Server:         strings.TrimSpace(input.Server),
		Port:           input.Port,
		Account:        strings.TrimSpace(input.Account),
		From:           strings.TrimSpace(input.EmailFrom),
		Token:          input.Token,
		SSLEnabled:     input.SSLEnabled,
		ForceAuthLogin: input.ForceAuthLogin,
	}
	if strings.TrimSpace(submitted.Token) == "" {
		submitted.Token = ""
	}
	if err := model.UpdateRecallActivitySMTPOptions(model.RecallActivitySMTPOptionInput{SMTPConfig: submitted}); err != nil {
		return RecallActivitySMTPStatus{}, err
	}
	return GetRecallActivitySMTPStatus(), nil
}

func recallActivitySMTPConfigFromSetting(setting operation_setting.RecallCampaignSetting) common.SMTPConfig {
	return common.SMTPConfig{
		Server:         strings.TrimSpace(setting.SMTPServer),
		Port:           setting.SMTPPort,
		Account:        strings.TrimSpace(setting.SMTPAccount),
		From:           strings.TrimSpace(setting.EmailFrom),
		Token:          setting.SMTPToken,
		SSLEnabled:     setting.SMTPSSLEnabled,
		ForceAuthLogin: setting.SMTPForceAuthLogin,
	}
}

func recallActivitySMTPStatus(config common.SMTPConfig) RecallActivitySMTPStatus {
	return RecallActivitySMTPStatus{
		Server:          config.Server,
		Port:            config.Port,
		Account:         config.Account,
		EmailFrom:       config.From,
		SSLEnabled:      config.SSLEnabled,
		ForceAuthLogin:  config.ForceAuthLogin,
		TokenConfigured: strings.TrimSpace(config.Token) != "",
		Configured:      config.Validate() == nil,
	}
}
