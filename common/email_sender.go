package common

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"
)

type SMTPSenderChoice struct {
	Email     string `json:"email"`
	IsDefault bool   `json:"is_default"`
}

type ResolvedSMTPSender struct {
	Email       string
	Domain      string
	UsesDefault bool
	Options     []SMTPSenderChoice
}

func NormalizeSMTPFromAliases(value, smtpFrom, smtpAccount string) (string, error) {
	defaultSender, _, err := effectiveSMTPSenderFromConfig(smtpFrom, smtpAccount)
	if err != nil {
		return "", err
	}

	seen := map[string]bool{strings.ToLower(defaultSender): true}
	aliases := make([]string, 0)
	for _, token := range strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r'
	}) {
		alias := strings.TrimSpace(token)
		if alias == "" {
			continue
		}
		parsed, _, err := parsePlainMailbox(alias, "invalid SMTP from alias")
		if err != nil {
			return "", err
		}
		key := strings.ToLower(parsed)
		if seen[key] {
			continue
		}
		seen[key] = true
		aliases = append(aliases, parsed)
	}
	return strings.Join(aliases, ","), nil
}

func ResolveSMTPSender(configured string) (ResolvedSMTPSender, error) {
	return ResolveSMTPSenderFromConfig(configured, SMTPFrom, SMTPAccount, SMTPFromAliases)
}

func ResolveSMTPSenderFromConfig(configured, smtpFrom, smtpAccount, aliases string) (ResolvedSMTPSender, error) {
	defaultSender, defaultDomain, err := effectiveSMTPSenderFromConfig(smtpFrom, smtpAccount)
	if err != nil {
		return ResolvedSMTPSender{}, err
	}
	normalizedAliases, err := NormalizeSMTPFromAliases(aliases, smtpFrom, smtpAccount)
	if err != nil {
		return ResolvedSMTPSender{}, err
	}

	options := []SMTPSenderChoice{{Email: defaultSender, IsDefault: true}}
	if normalizedAliases != "" {
		for _, alias := range strings.Split(normalizedAliases, ",") {
			options = append(options, SMTPSenderChoice{Email: alias})
		}
	}

	selected := strings.TrimSpace(configured)
	if selected == "" {
		return ResolvedSMTPSender{
			Email:       defaultSender,
			Domain:      defaultDomain,
			UsesDefault: true,
			Options:     options,
		}, nil
	}
	selectedMailbox, _, err := parsePlainMailbox(selected, "invalid SMTP sender")
	if err != nil {
		return ResolvedSMTPSender{}, err
	}
	for _, option := range options {
		if strings.EqualFold(selectedMailbox, option.Email) {
			domain, err := EmailMessageIDDomainForSender(option.Email)
			if err != nil {
				return ResolvedSMTPSender{}, err
			}
			return ResolvedSMTPSender{
				Email:       option.Email,
				Domain:      domain,
				UsesDefault: option.IsDefault,
				Options:     options,
			}, nil
		}
	}
	return ResolvedSMTPSender{}, fmt.Errorf("SMTP sender %q is not allowed", selectedMailbox)
}

func EmailMessageIDDomainForSender(sender string) (string, error) {
	_, domain, err := parsePlainMailbox(sender, "invalid SMTP sender")
	return domain, err
}

func effectiveSMTPSenderFromConfig(smtpFrom, smtpAccount string) (string, string, error) {
	sender := strings.TrimSpace(smtpFrom)
	if sender == "" {
		sender = strings.TrimSpace(smtpAccount)
	}
	if sender == "" {
		return "", "", fmt.Errorf("invalid SMTP account")
	}
	return parsePlainMailbox(sender, "invalid SMTP account")
}

func parsePlainMailbox(value string, errorMessage string) (string, string, error) {
	if value == "" || containsEmailHeaderBreak(value) {
		return "", "", errors.New(errorMessage)
	}
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value {
		return "", "", errors.New(errorMessage)
	}
	at := strings.LastIndexByte(value, '@')
	if at <= 0 || at == len(value)-1 {
		return "", "", errors.New(errorMessage)
	}
	domain := strings.ToLower(value[at+1:])
	if !validEmailDomain(domain) {
		return "", "", errors.New(errorMessage)
	}
	return value, domain, nil
}
