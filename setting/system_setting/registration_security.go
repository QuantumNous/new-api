package system_setting

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type RegistrationSecuritySettings struct {
	DomainRiskEnabled               bool     `json:"domain_risk_enabled"`
	DomainRiskWindowHours           int      `json:"domain_risk_window_hours"`
	DomainRiskThreshold             int      `json:"domain_risk_threshold"`
	TrustedEmailDomains             []string `json:"trusted_email_domains"`
	RejectSubdomainEmailDomains     bool     `json:"reject_subdomain_email_domains"`
	EmailBlacklistPatterns          []string `json:"email_blacklist_patterns"`
	DisposableEmailDomains          []string `json:"disposable_email_domains"`
	EnableEmailDomainDNSValidation  bool     `json:"enable_email_domain_dns_validation"`
	RejectEmailDomainWithoutMX      bool     `json:"reject_email_domain_without_mx"`
	RejectEmailDomainWithoutWebsite bool     `json:"reject_email_domain_without_website"`
}

var registrationSecuritySettings = RegistrationSecuritySettings{
	DomainRiskWindowHours:           24,
	DomainRiskThreshold:             10,
	EmailBlacklistPatterns: []string{
		`(?i)^fk[a-z0-9]{12}@[a-z0-9.]+$`,
	},
	DisposableEmailDomains:          append([]string(nil), defaultDisposableEmailDomains...),
	EnableEmailDomainDNSValidation:  true,
	RejectEmailDomainWithoutMX:      true,
	RejectEmailDomainWithoutWebsite: true,
}

const (
	MaxRegistrationDomainRiskWindowHours = 24 * 30
	MaxRegistrationDomainRiskThreshold   = 10_000
)

var registrationSecuritySettingsMu sync.RWMutex

func init() {
	config.GlobalConfig.Register("registration_security", &registrationSecuritySettings)
}

func GetRegistrationSecuritySettings() RegistrationSecuritySettings {
	registrationSecuritySettingsMu.RLock()
	defer registrationSecuritySettingsMu.RUnlock()
	cfg := registrationSecuritySettings
	cfg.TrustedEmailDomains = append([]string(nil), registrationSecuritySettings.TrustedEmailDomains...)
	cfg.EmailBlacklistPatterns = append([]string(nil), registrationSecuritySettings.EmailBlacklistPatterns...)
	cfg.DisposableEmailDomains = append([]string(nil), registrationSecuritySettings.DisposableEmailDomains...)
	return cfg
}

func (s *RegistrationSecuritySettings) LockConfig() {
	registrationSecuritySettingsMu.Lock()
}

func (s *RegistrationSecuritySettings) UnlockConfig() {
	registrationSecuritySettingsMu.Unlock()
}

func (s *RegistrationSecuritySettings) RLockConfig() {
	registrationSecuritySettingsMu.RLock()
}

func (s *RegistrationSecuritySettings) RUnlockConfig() {
	registrationSecuritySettingsMu.RUnlock()
}

func UpdateRegistrationSecuritySettingsFromMap(values map[string]string) error {
	registrationSecuritySettingsMu.Lock()
	defer registrationSecuritySettingsMu.Unlock()

	next := registrationSecuritySettings
	next.TrustedEmailDomains = append([]string(nil), registrationSecuritySettings.TrustedEmailDomains...)
	next.EmailBlacklistPatterns = append([]string(nil), registrationSecuritySettings.EmailBlacklistPatterns...)
	next.DisposableEmailDomains = append([]string(nil), registrationSecuritySettings.DisposableEmailDomains...)
	if err := config.UpdateConfigFromMap(&next, values); err != nil {
		return err
	}
	if err := next.NormalizeAndValidate(); err != nil {
		return err
	}
	registrationSecuritySettings = next
	return nil
}

func (s *RegistrationSecuritySettings) NormalizeAndValidate() error {
	if s.DomainRiskWindowHours < 1 || s.DomainRiskWindowHours > MaxRegistrationDomainRiskWindowHours {
		return fmt.Errorf("registration risk window must be between 1 and %d hours", MaxRegistrationDomainRiskWindowHours)
	}
	if s.DomainRiskThreshold < 2 || s.DomainRiskThreshold > MaxRegistrationDomainRiskThreshold {
		return fmt.Errorf("registration risk threshold must be between 2 and %d", MaxRegistrationDomainRiskThreshold)
	}
	seen := make(map[string]struct{}, len(s.TrustedEmailDomains))
	normalized := make([]string, 0, len(s.TrustedEmailDomains))
	for _, raw := range s.TrustedEmailDomains {
		domain, err := common.NormalizeEmailDomain("user@" + strings.TrimSpace(raw))
		if err != nil {
			return fmt.Errorf("invalid trusted email domain %q", raw)
		}
		if _, ok := seen[domain]; ok {
			continue
		}
		seen[domain] = struct{}{}
		normalized = append(normalized, domain)
	}
	sort.Strings(normalized)
	s.TrustedEmailDomains = normalized

	seenPatterns := make(map[string]struct{}, len(s.EmailBlacklistPatterns))
	normalizedPatterns := make([]string, 0, len(s.EmailBlacklistPatterns))
	for _, raw := range s.EmailBlacklistPatterns {
		pattern := strings.TrimSpace(raw)
		if pattern == "" {
			continue
		}
		if _, err := regexp.Compile(pattern); err != nil {
			return fmt.Errorf("invalid registration email blacklist pattern %q: %w", pattern, err)
		}
		if _, ok := seenPatterns[pattern]; ok {
			continue
		}
		seenPatterns[pattern] = struct{}{}
		normalizedPatterns = append(normalizedPatterns, pattern)
	}
	s.EmailBlacklistPatterns = normalizedPatterns

	seenDisposable := make(map[string]struct{}, len(s.DisposableEmailDomains))
	normalizedDisposable := make([]string, 0, len(s.DisposableEmailDomains))
	for _, raw := range s.DisposableEmailDomains {
		domain, err := common.NormalizeEmailDomain("user@" + strings.TrimSpace(raw))
		if err != nil {
			return fmt.Errorf("invalid disposable email domain %q", raw)
		}
		if _, ok := seenDisposable[domain]; ok {
			continue
		}
		seenDisposable[domain] = struct{}{}
		normalizedDisposable = append(normalizedDisposable, domain)
	}
	sort.Strings(normalizedDisposable)
	s.DisposableEmailDomains = normalizedDisposable
	return nil
}

func (s RegistrationSecuritySettings) IsTrustedDomain(domain string) bool {
	domain = strings.ToLower(strings.TrimSpace(domain))
	for _, trusted := range s.TrustedEmailDomains {
		if domain == trusted {
			return true
		}
	}
	return false
}

// IsDisposableEmailDomain reports whether the given (already normalized, lowercase)
// email domain matches the disposable-email blocklist exactly or as a subdomain,
// e.g. "web-library.net" also matches "mail.web-library.net".
func (s RegistrationSecuritySettings) IsDisposableEmailDomain(domain string) bool {
	domain = strings.ToLower(strings.TrimSpace(domain))
	if domain == "" {
		return false
	}
	for _, blocked := range s.DisposableEmailDomains {
		if domain == blocked || strings.HasSuffix(domain, "."+blocked) {
			return true
		}
	}
	return false
}

func (s RegistrationSecuritySettings) IsEmailBlacklisted(email string) (blacklisted bool) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("recovered from panic while evaluating registration email blacklist: %v", r))
			blacklisted = false
		}
	}()

	email = strings.TrimSpace(email)
	for _, pattern := range s.EmailBlacklistPatterns {
		matched, err := regexp.MatchString(pattern, email)
		if err != nil {
			common.SysError(fmt.Sprintf("invalid registration email blacklist pattern %q: %s", pattern, err.Error()))
			continue
		}
		if matched {
			return true
		}
	}
	return false
}
