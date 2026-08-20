package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestRegistrationSecurityPolicy(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{DomainRiskEnabled: true, DomainRiskWindowHours: 24, DomainRiskThreshold: 10, TrustedEmailDomains: []string{"trusted.com"}}
	decision, err := EvaluateRegistrationEmail("User@Example.COM", cfg, nil)
	require.NoError(t, err)
	require.Equal(t, "example.com", decision.Domain)
	require.True(t, decision.Policy.Enabled)

	trusted, err := EvaluateRegistrationEmail("user@trusted.com", cfg, nil)
	require.NoError(t, err)
	require.False(t, trusted.Policy.Enabled)

	child, err := EvaluateRegistrationEmail("user@mail.trusted.com", cfg, nil)
	require.NoError(t, err)
	require.True(t, child.Policy.Enabled)
}

func TestRegistrationSecurityRejectsSubdomainAndActiveBlock(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{DomainRiskWindowHours: 24, DomainRiskThreshold: 10, RejectSubdomainEmailDomains: true}
	_, err := EvaluateRegistrationEmail("user@mail.example.com", cfg, nil)
	require.ErrorIs(t, err, ErrSubdomainEmailRegistrationRejected)

	cfg.RejectSubdomainEmailDomains = false
	_, err = EvaluateRegistrationEmail("user@example.com", cfg, func(string) (bool, error) { return true, nil })
	require.ErrorIs(t, err, ErrRegistrationDomainUnavailable)
}

func TestRegistrationSecurityRejectsAutomatedEmailPattern(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{
		EmailBlacklistPatterns: []string{`(?i)^fk[a-z0-9]{12}@[a-z0-9.]+$`},
	}

	for _, email := range []string{
		"fk123456789abc@example.com",
		"FK123456789ABC@EXAMPLE.COM",
		"  fkabc123abc123@mail.example.com  ",
	} {
		t.Run(email, func(t *testing.T) {
			_, err := EvaluateRegistrationEmail(email, cfg, nil)
			require.ErrorIs(t, err, ErrAutomatedRegistrationEmailRejected)
		})
	}
}

func TestRegistrationSecurityAllowsEmailsOutsideAutomatedPattern(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{
		EmailBlacklistPatterns: []string{`(?i)^fk[a-z0-9]{12}@[a-z0-9.]+$`},
	}

	for _, email := range []string{
		"fk123456789ab@example.com",
		"fk123456789abcd@example.com",
		"prefix-fk123456789abc@example.com",
		"fk123456789abc@example-domain.com",
	} {
		t.Run(email, func(t *testing.T) {
			_, err := EvaluateRegistrationEmail(email, cfg, nil)
			require.NoError(t, err)
		})
	}
}

func TestRegistrationSecurityTrustedDomainBypassesActiveBlock(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{
		DomainRiskEnabled:     true,
		DomainRiskWindowHours: 24,
		DomainRiskThreshold:   10,
		TrustedEmailDomains:   []string{"trusted.example"},
	}

	// A trusted domain must not even consult the active-block lookup, so a
	// customer whose domain was previously hammered can still register.
	decision, err := EvaluateRegistrationEmail("user@trusted.example", cfg, func(string) (bool, error) {
		t.Fatal("trusted domain must not query the active block")
		return true, nil
	})

	require.NoError(t, err)
	require.False(t, decision.Policy.Enabled)
}

func TestRegistrationSecurityAllowsEmailLessRegistrationWithoutCounting(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{DomainRiskEnabled: true, DomainRiskWindowHours: 24, DomainRiskThreshold: 10}

	decision, err := EvaluateRegistrationEmail("", cfg, func(string) (bool, error) {
		t.Fatal("email-less registration must not query domain blocks")
		return false, nil
	})

	require.NoError(t, err)
	require.Empty(t, decision.Domain)
	require.False(t, decision.Policy.Enabled)
}

// stubDNSChecker swaps the DNS checker for a fixed result and restores it on
// cleanup. DNS tests stay deterministic and never hit the live resolver.
func stubDNSChecker(check emailDomainDNSCheck) func() {
	return stubDNSCheckerFunc(func(string) emailDomainDNSCheck { return check })
}

// stubDNSCheckerFunc swaps the DNS checker for an arbitrary function.
func stubDNSCheckerFunc(fn emailDomainDNSCheckerFunc) func() {
	prev := registrationEmailDNSChecker
	registrationEmailDNSChecker = fn
	return func() { registrationEmailDNSChecker = prev }
}

func TestRegistrationSecurityDNSDisposableMXRejected(t *testing.T) {
	restore := stubDNSChecker(emailDomainDNSCheck{MXRecord: true, DisposableMX: true})
	defer restore()
	cfg := system_setting.RegistrationSecuritySettings{EnableEmailDomainDNSValidation: true}
	_, err := EvaluateRegistrationEmail("user@temp.example", cfg, nil)
	require.ErrorIs(t, err, ErrAutomatedRegistrationEmailRejected)
}

func TestRegistrationSecurityDNSPrivateARecordRejected(t *testing.T) {
	restore := stubDNSChecker(emailDomainDNSCheck{MXRecord: true, PrivateARecord: true})
	defer restore()
	cfg := system_setting.RegistrationSecuritySettings{EnableEmailDomainDNSValidation: true}
	_, err := EvaluateRegistrationEmail("user@parked.example", cfg, nil)
	require.ErrorIs(t, err, ErrAutomatedRegistrationEmailRejected)
}

func TestRegistrationSecurityDNSMissingMXRejected(t *testing.T) {
	restore := stubDNSChecker(emailDomainDNSCheck{})
	defer restore()
	cfg := system_setting.RegistrationSecuritySettings{EnableEmailDomainDNSValidation: true, RejectEmailDomainWithoutMX: true}
	_, err := EvaluateRegistrationEmail("user@nomx.example", cfg, nil)
	require.ErrorIs(t, err, ErrRegistrationDomainUnavailable)
}

func TestRegistrationSecurityDNSMissingWebsitePolicy(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{
		EnableEmailDomainDNSValidation:  true,
		RejectEmailDomainWithoutMX:      true,
		RejectEmailDomainWithoutWebsite: true,
	}
	// no A record, no website, MX on unknown infra -> rejected
	restore := stubDNSChecker(emailDomainDNSCheck{MXRecord: true, MXHost: "mx1.unknown.net"})
	defer restore()
	_, err := EvaluateRegistrationEmail("user@noweb.example", cfg, nil)
	require.ErrorIs(t, err, ErrRegistrationDomainUnavailable)

	// website present -> allowed
	restore = stubDNSChecker(emailDomainDNSCheck{MXRecord: true, MXHost: "mx1.unknown.net", WebsiteReachable: true})
	defer restore()
	_, err = EvaluateRegistrationEmail("user@withweb.example", cfg, nil)
	require.NoError(t, err)

	// major-provider MX exempts from the website requirement (email-only domain)
	restore = stubDNSChecker(emailDomainDNSCheck{MXRecord: true, MXHost: "alt1.gmail-smtp-in.l.google.com", MajorProviderMX: true})
	defer restore()
	_, err = EvaluateRegistrationEmail("user@corp.example", cfg, nil)
	require.NoError(t, err)
}

func TestRegistrationSecurityDNSDisabledByDefaultInPolicy(t *testing.T) {
	// Zero-value config must not trigger DNS lookups.
	cfg := system_setting.RegistrationSecuritySettings{}
	restore := stubDNSCheckerFunc(func(string) emailDomainDNSCheck {
		t.Fatal("DNS checker must not run when validation is disabled")
		return emailDomainDNSCheck{}
	})
	defer restore()
	_, err := EvaluateRegistrationEmail("user@example.com", cfg, nil)
	require.NoError(t, err)
}

func TestRegistrationSecurityDisposableDomainListRejected(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{DisposableEmailDomains: []string{"web-library.net"}}
	_, err := EvaluateRegistrationEmail("user@web-library.net", cfg, nil)
	require.ErrorIs(t, err, ErrAutomatedRegistrationEmailRejected)

	// subdomains of a blocked domain are blocked too
	_, err = EvaluateRegistrationEmail("user@mail.web-library.net", cfg, nil)
	require.ErrorIs(t, err, ErrAutomatedRegistrationEmailRejected)
}

func TestRegistrationSecurityTrustedDomainSkipsDNSAndDisposable(t *testing.T) {
	cfg := system_setting.RegistrationSecuritySettings{
		EnableEmailDomainDNSValidation:  true,
		RejectEmailDomainWithoutMX:      true,
		DisposableEmailDomains:          []string{"web-library.net"},
		TrustedEmailDomains:             []string{"web-library.net"},
	}
	restore := stubDNSCheckerFunc(func(string) emailDomainDNSCheck {
		t.Fatal("trusted domain must skip the DNS checker")
		return emailDomainDNSCheck{}
	})
	defer restore()

	decision, err := EvaluateRegistrationEmail("user@web-library.net", cfg, nil)
	require.NoError(t, err)
	require.Equal(t, "web-library.net", decision.Domain)
	require.False(t, decision.Policy.Enabled)
}
