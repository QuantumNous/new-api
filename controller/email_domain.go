package controller

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const emailDomainWhitelistErrorMessage = "The administrator has enabled the email domain name whitelist, and your email address is not allowed due to special symbols or it's not in the whitelist."

func validateEmailDomainRestriction(email string) error {
	if !common.EmailDomainRestrictionEnabled {
		return nil
	}
	email = strings.TrimSpace(email)
	if err := common.Validate.Var(email, "required,email"); err != nil {
		return errors.New(emailDomainWhitelistErrorMessage)
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return errors.New(emailDomainWhitelistErrorMessage)
	}
	domainPart := strings.ToLower(strings.TrimSpace(parts[1]))
	for _, domain := range common.EmailDomainWhitelist {
		if domainPart == strings.ToLower(strings.TrimSpace(domain)) {
			return nil
		}
	}
	return errors.New(emailDomainWhitelistErrorMessage)
}
