package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCustomDomainSettingsNormalizesTheTrustedDomainPolicy(t *testing.T) {
	settings, err := ParseCustomDomainSettings(
		"true",
		" YESCHOY.IO. ",
		"https://yeschoy.com/",
		"7",
		"Sales, partner",
	)
	require.NoError(t, err)
	assert.True(t, settings.Enabled)
	assert.Equal(t, "yeschoy.io", settings.Suffix)
	assert.Equal(t, "https://yeschoy.com", settings.MainOrigin)
	assert.Equal(t, 7, settings.CacheTTLSeconds)
	assert.Contains(t, settings.ReservedLabels, "sales")
	assert.Contains(t, settings.ReservedLabels, "partner")
	assert.Contains(t, settings.ReservedLabels, "www")
}

func TestValidateCustomDomainSessionSettingsRequiresSecureTrustedMainOrigin(t *testing.T) {
	settings, err := ParseCustomDomainSettings(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)

	assert.Error(t, validateCustomDomainSessionSettings(settings, false, []string{"https://yeschoy.com"}))
	assert.Error(t, validateCustomDomainSessionSettings(settings, true, []string{"https://legacy.example.com"}))
	assert.NoError(t, validateCustomDomainSessionSettings(settings, true, []string{"https://yeschoy.com"}))

	settings.Enabled = false
	assert.NoError(t, validateCustomDomainSessionSettings(settings, false, nil))
}

func TestInitCustomDomainSettingsLeavesHTTPOnlyValidationToServerStartup(t *testing.T) {
	previousEnabled := CustomDomainEnabled
	previousSuffix := CustomDomainSuffix
	previousMainOrigin := CustomDomainMainOrigin
	previousCacheTTL := CustomDomainCacheTTLSeconds
	previousReserved := CustomDomainReservedLabels
	previousSecure := SessionCookieSecure
	previousTrusted := SessionCookieTrustedURLs
	t.Cleanup(func() {
		CustomDomainEnabled = previousEnabled
		CustomDomainSuffix = previousSuffix
		CustomDomainMainOrigin = previousMainOrigin
		CustomDomainCacheTTLSeconds = previousCacheTTL
		CustomDomainReservedLabels = previousReserved
		SessionCookieSecure = previousSecure
		SessionCookieTrustedURLs = previousTrusted
	})

	t.Setenv("CUSTOM_DOMAIN_ENABLED", "true")
	t.Setenv("CUSTOM_DOMAIN_SUFFIX", "yeschoy.io")
	t.Setenv("CUSTOM_DOMAIN_MAIN_ORIGIN", "https://yeschoy.com")
	t.Setenv("CUSTOM_DOMAIN_CACHE_TTL_SECONDS", "5")
	t.Setenv("CUSTOM_DOMAIN_RESERVED_LABELS", "")
	SessionCookieSecure = false
	SessionCookieTrustedURLs = nil

	require.NoError(t, InitCustomDomainSettings())
	assert.True(t, CustomDomainEnabled)
	assert.Error(t, ValidateCustomDomainHTTPSettings())
}
