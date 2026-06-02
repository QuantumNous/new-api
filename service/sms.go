package service

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type SMSSendLogInput struct {
	Phone           string
	PhoneMasked     string
	Scene           string
	Provider        string
	TemplateVersion string
	ProviderCode    string
	DurationMs      int64
}

func RecordSMSSendLog(db *gorm.DB, input SMSSendLogInput) (*model.SMSSendLog, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	phoneMasked := strings.TrimSpace(input.PhoneMasked)
	if phoneMasked == "" {
		phoneMasked = common.MaskPhone(input.Phone)
	}
	if phoneMasked == "" {
		return nil, errors.New("invalid sms phone")
	}
	durationMs := input.DurationMs
	if durationMs < 0 {
		durationMs = 0
	}
	log := &model.SMSSendLog{
		PhoneMasked:     phoneMasked,
		Scene:           strings.TrimSpace(input.Scene),
		Provider:        strings.TrimSpace(input.Provider),
		TemplateVersion: strings.TrimSpace(input.TemplateVersion),
		ProviderCode:    strings.TrimSpace(input.ProviderCode),
		DurationMs:      durationMs,
	}
	if err := db.Create(log).Error; err != nil {
		return nil, err
	}
	return log, nil
}
