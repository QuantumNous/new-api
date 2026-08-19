package service

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

var (
	ErrAutomatedRegistrationEmailRejected = errors.New("automated registration email rejected")
	ErrSubdomainEmailRegistrationRejected = errors.New("subdomain email registration rejected")
	ErrRegistrationDomainUnavailable      = errors.New("registration domain unavailable")
)

type RegistrationEmailDecision struct {
	Domain string
	Policy model.RegistrationDomainRiskPolicy
}

type RegistrationDomainBlockLookup func(domain string) (bool, error)

func EvaluateRegistrationEmail(email string, cfg system_setting.RegistrationSecuritySettings, lookup RegistrationDomainBlockLookup) (RegistrationEmailDecision, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return RegistrationEmailDecision{}, nil
	}
	if cfg.IsEmailBlacklisted(email) {
		return RegistrationEmailDecision{}, ErrAutomatedRegistrationEmailRejected
	}
	domain, err := common.NormalizeEmailDomain(email)
	if err != nil {
		return RegistrationEmailDecision{}, err
	}
	if cfg.RejectSubdomainEmailDomains && common.IsSubdomainEmailDomain(domain) {
		return RegistrationEmailDecision{}, ErrSubdomainEmailRegistrationRejected
	}
	trusted := cfg.IsTrustedDomain(domain)
	if lookup != nil {
		blocked, err := lookup(domain)
		if err != nil {
			return RegistrationEmailDecision{}, err
		}
		if blocked {
			return RegistrationEmailDecision{}, ErrRegistrationDomainUnavailable
		}
	}
	return RegistrationEmailDecision{
		Domain: domain,
		Policy: model.RegistrationDomainRiskPolicy{
			Enabled:   cfg.DomainRiskEnabled && !trusted,
			Window:    time.Duration(cfg.DomainRiskWindowHours) * time.Hour,
			Threshold: cfg.DomainRiskThreshold,
		},
	}, nil
}
