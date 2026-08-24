package common

import (
	"errors"
	"strings"

	"golang.org/x/net/publicsuffix"
)

var ErrInvalidEmailDomain = errors.New("invalid email domain")

func NormalizeEmailDomain(email string) (string, error) {
	email = strings.TrimSpace(email)
	at := strings.IndexByte(email, '@')
	if at <= 0 || at == len(email)-1 || strings.IndexByte(email[at+1:], '@') >= 0 {
		return "", ErrInvalidEmailDomain
	}
	domain := strings.ToLower(strings.TrimSpace(email[at+1:]))
	if !isValidASCIIDomain(domain) {
		return "", ErrInvalidEmailDomain
	}
	if _, err := publicsuffix.EffectiveTLDPlusOne(domain); err != nil {
		return "", ErrInvalidEmailDomain
	}
	return domain, nil
}

func IsSubdomainEmailDomain(domain string) bool {
	domain = strings.ToLower(strings.TrimSpace(domain))
	registrable, err := publicsuffix.EffectiveTLDPlusOne(domain)
	return err == nil && registrable != domain
}

func isValidASCIIDomain(domain string) bool {
	if domain == "" || len(domain) > 253 || strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") {
		return false
	}
	for _, label := range strings.Split(domain, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, r := range label {
			if (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' {
				return false
			}
		}
	}
	return true
}
