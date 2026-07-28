package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type RecallEmailSenderOption struct {
	Email     string `json:"email"`
	IsDefault bool   `json:"is_default"`
}

type RecallEmailSenderStatus struct {
	ConfiguredEmailFrom string                    `json:"configured_email_from"`
	EffectiveEmailFrom  string                    `json:"effective_email_from"`
	UsesDefault         bool                      `json:"uses_default"`
	Options             []RecallEmailSenderOption `json:"options"`
}

func GetRecallEmailSenderStatus() (RecallEmailSenderStatus, error) {
	configured := strings.TrimSpace(operation_setting.GetRecallCampaignSetting().EmailFrom)
	resolved, err := common.ResolveSMTPSender(configured)
	if err != nil {
		return RecallEmailSenderStatus{}, err
	}
	options := make([]RecallEmailSenderOption, 0, len(resolved.Options))
	for _, option := range resolved.Options {
		options = append(options, RecallEmailSenderOption{
			Email:     option.Email,
			IsDefault: option.IsDefault,
		})
	}
	return RecallEmailSenderStatus{
		ConfiguredEmailFrom: configured,
		EffectiveEmailFrom:  resolved.Email,
		UsesDefault:         resolved.UsesDefault,
		Options:             options,
	}, nil
}

func NormalizeRecallEmailSenderSelection(value string) (string, error) {
	selection := strings.TrimSpace(value)
	if selection == "" {
		return "", nil
	}
	resolved, err := common.ResolveSMTPSender(selection)
	if err != nil || resolved.UsesDefault {
		return "", fmt.Errorf("Activity sender must be one of the configured SMTP aliases")
	}
	return resolved.Email, nil
}
