package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

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

func UpdateRecallActivitySMTP(input RecallActivitySMTPInput) (RecallActivitySMTPStatus, error) {
	current := recallActivitySMTPConfigFromSetting(operation_setting.GetRecallCampaignSetting())
	submitted := common.SMTPConfig{
		Server:         strings.TrimSpace(input.Server),
		Port:           input.Port,
		Account:        strings.TrimSpace(input.Account),
		From:           strings.TrimSpace(input.EmailFrom),
		Token:          input.Token,
		SSLEnabled:     input.SSLEnabled,
		ForceAuthLogin: input.ForceAuthLogin,
	}
	effective := submitted
	if strings.TrimSpace(effective.Token) == "" {
		effective.Token = current.Token
	}
	if err := effective.Validate(); err != nil {
		return RecallActivitySMTPStatus{}, err
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
