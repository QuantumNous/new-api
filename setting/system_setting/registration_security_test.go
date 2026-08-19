package system_setting

import (
	"math"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestRegistrationSecurityDefaults(t *testing.T) {
	cfg := GetRegistrationSecuritySettings()
	require.False(t, cfg.DomainRiskEnabled)
	require.Equal(t, 24, cfg.DomainRiskWindowHours)
	require.Equal(t, 10, cfg.DomainRiskThreshold)
	require.Empty(t, cfg.TrustedEmailDomains)
	require.False(t, cfg.RejectSubdomainEmailDomains)
	require.Equal(t, []string{`(?i)^fk[a-z0-9]{12}@[a-z0-9.]+$`}, cfg.EmailBlacklistPatterns)
	require.True(t, cfg.IsEmailBlacklisted("FK123456789ABC@EXAMPLE.COM"))
}

func TestRegistrationSecurityNormalizeAndValidate(t *testing.T) {
	cfg := RegistrationSecuritySettings{
		DomainRiskWindowHours:  24,
		DomainRiskThreshold:    10,
		TrustedEmailDomains:    []string{" Example.com ", "example.com", "EXAMPLE.ORG"},
		EmailBlacklistPatterns: []string{` ^blocked@example\.com$ `, `^blocked@example\.com$`, ""},
	}
	require.NoError(t, cfg.NormalizeAndValidate())
	require.Equal(t, []string{"example.com", "example.org"}, cfg.TrustedEmailDomains)
	require.True(t, cfg.IsTrustedDomain("EXAMPLE.COM"))
	require.False(t, cfg.IsTrustedDomain("mail.example.com"))
	require.Equal(t, []string{`^blocked@example\.com$`}, cfg.EmailBlacklistPatterns)
	require.True(t, cfg.IsEmailBlacklisted("blocked@example.com"))

	cfg.DomainRiskThreshold = 1
	require.Error(t, cfg.NormalizeAndValidate())
	cfg.DomainRiskThreshold = 10
	cfg.DomainRiskWindowHours = 0
	require.Error(t, cfg.NormalizeAndValidate())
	cfg.DomainRiskWindowHours = 24
	cfg.TrustedEmailDomains = []string{"not a domain"}
	require.Error(t, cfg.NormalizeAndValidate())
	cfg.TrustedEmailDomains = []string{"evil.example@example.com"}
	require.Error(t, cfg.NormalizeAndValidate())
	cfg.TrustedEmailDomains = nil
	cfg.DomainRiskWindowHours = math.MaxInt
	require.Error(t, cfg.NormalizeAndValidate())
	cfg.DomainRiskWindowHours = 24
	cfg.DomainRiskThreshold = math.MaxInt
	require.Error(t, cfg.NormalizeAndValidate())
	cfg.DomainRiskThreshold = 10
	cfg.EmailBlacklistPatterns = []string{"["}
	require.Error(t, cfg.NormalizeAndValidate())
}

func TestRegistrationSecurityLoadFromDBRejectsOutOfRangeValues(t *testing.T) {
	original := GetRegistrationSecuritySettings()
	t.Cleanup(func() {
		values, err := config.ConfigToMap(&original)
		require.NoError(t, err)
		require.NoError(t, UpdateRegistrationSecuritySettingsFromMap(values))
	})
	require.NoError(t, UpdateRegistrationSecuritySettingsFromMap(map[string]string{
		"domain_risk_enabled":      "true",
		"domain_risk_window_hours": "24",
		"domain_risk_threshold":    "10",
	}))

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"registration_security.domain_risk_window_hours": "721",
	}))

	cfg := GetRegistrationSecuritySettings()
	require.True(t, cfg.DomainRiskEnabled)
	require.Equal(t, 24, cfg.DomainRiskWindowHours)
	require.Equal(t, 10, cfg.DomainRiskThreshold)
}

func TestRegistrationSecurityUpdatesExposeOnlyCompleteSnapshots(t *testing.T) {
	original := GetRegistrationSecuritySettings()
	t.Cleanup(func() {
		values, err := config.ConfigToMap(&original)
		require.NoError(t, err)
		require.NoError(t, UpdateRegistrationSecuritySettingsFromMap(values))
	})
	first := map[string]string{
		"domain_risk_enabled":      "true",
		"domain_risk_window_hours": "12",
		"domain_risk_threshold":    "4",
		"trusted_email_domains":    `["first.example"]`,
	}
	second := map[string]string{
		"domain_risk_enabled":      "false",
		"domain_risk_window_hours": "48",
		"domain_risk_threshold":    "20",
		"trusted_email_domains":    `["second.example"]`,
	}
	require.NoError(t, UpdateRegistrationSecuritySettingsFromMap(first))

	var wg sync.WaitGroup
	start := make(chan struct{})
	errCh := make(chan error, 1)
	wg.Add(2)
	go func() {
		defer wg.Done()
		<-start
		for i := 0; i < 1000; i++ {
			if err := UpdateRegistrationSecuritySettingsFromMap(second); err != nil {
				errCh <- err
				return
			}
			if err := UpdateRegistrationSecuritySettingsFromMap(first); err != nil {
				errCh <- err
				return
			}
		}
	}()
	go func() {
		defer wg.Done()
		<-start
		for i := 0; i < 5000; i++ {
			cfg := GetRegistrationSecuritySettings()
			isFirst := cfg.DomainRiskEnabled && cfg.DomainRiskWindowHours == 12 && cfg.DomainRiskThreshold == 4 && cfg.IsTrustedDomain("first.example")
			isSecond := !cfg.DomainRiskEnabled && cfg.DomainRiskWindowHours == 48 && cfg.DomainRiskThreshold == 20 && cfg.IsTrustedDomain("second.example")
			if !isFirst && !isSecond {
				errCh <- &incompleteRegistrationSecuritySnapshot{cfg: cfg}
				return
			}
		}
	}()
	close(start)
	wg.Wait()
	close(errCh)
	for err := range errCh {
		require.NoError(t, err)
	}
}

type incompleteRegistrationSecuritySnapshot struct {
	cfg RegistrationSecuritySettings
}

func (e *incompleteRegistrationSecuritySnapshot) Error() string {
	return "observed incomplete registration security configuration snapshot"
}
