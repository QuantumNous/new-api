package common

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCustomDomainSettingsNormalizesTheTrustedDomainPolicy(t *testing.T) {
	settings, err := ParseCustomDomainSettingsWithMainOrigins(
		"true",
		" YESCHOY.IO. ",
		"https://yeschoy.com/",
		" https://YESCHOY.com:443/, https://yeschoy.pro, https://future.example ",
		"7",
		"Sales, partner",
	)
	require.NoError(t, err)
	assert.True(t, settings.Enabled)
	assert.Equal(t, "yeschoy.io", settings.Suffix)
	assert.Equal(t, "https://yeschoy.com", settings.MainOrigin)
	assert.Equal(t, []string{"https://yeschoy.com", "https://yeschoy.pro", "https://future.example"}, settings.MainOrigins)
	assert.Equal(t, 7, settings.CacheTTLSeconds)
	assert.Contains(t, settings.ReservedLabels, "sales")
	assert.Contains(t, settings.ReservedLabels, "partner")
	assert.Contains(t, settings.ReservedLabels, "www")
}

func TestParseCustomDomainSettingsWithMainOriginsValidatesThePeerAllowlist(t *testing.T) {
	tests := []struct {
		name        string
		mainOrigin  string
		mainOrigins string
	}{
		{name: "callback missing", mainOrigin: "https://yeschoy.com", mainOrigins: "https://yeschoy.pro"},
		{name: "promotion apex", mainOrigin: "https://yeschoy.com", mainOrigins: "https://yeschoy.com,https://yeschoy.io"},
		{name: "promotion subdomain", mainOrigin: "https://yeschoy.com", mainOrigins: "https://yeschoy.com,https://alpha.yeschoy.io"},
		{name: "non https", mainOrigin: "https://yeschoy.com", mainOrigins: "https://yeschoy.com,http://yeschoy.pro"},
		{name: "peer non-standard port", mainOrigin: "https://yeschoy.com", mainOrigins: "https://yeschoy.com,https://yeschoy.pro:8443"},
		{name: "same host different port", mainOrigin: "https://yeschoy.com", mainOrigins: "https://yeschoy.com,https://yeschoy.com:8443"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := ParseCustomDomainSettingsWithMainOrigins("true", "yeschoy.io", test.mainOrigin, test.mainOrigins, "5", "")
			assert.Error(t, err)
		})
	}

	tooMany := "https://yeschoy.com"
	for index := 0; index < 32; index++ {
		tooMany += ",https://main" + strconv.Itoa(index) + ".example"
	}
	_, err := ParseCustomDomainSettingsWithMainOrigins("true", "yeschoy.io", "https://yeschoy.com", tooMany, "5", "")
	assert.Error(t, err)
}

func TestValidateCustomDomainSessionSettingsRequiresSecureTrustedMainOrigin(t *testing.T) {
	settings, err := ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro",
		"5",
		"",
	)
	require.NoError(t, err)

	assert.Error(t, validateCustomDomainSessionSettings(settings, false, []string{"https://yeschoy.com"}))
	assert.Error(t, validateCustomDomainSessionSettings(settings, true, []string{"https://legacy.example.com"}))
	assert.Error(t, validateCustomDomainSessionSettings(settings, true, []string{"https://yeschoy.com"}))
	assert.NoError(t, validateCustomDomainSessionSettings(settings, true, []string{"https://yeschoy.pro", "https://yeschoy.com"}))

	settings.Enabled = false
	assert.NoError(t, validateCustomDomainSessionSettings(settings, false, nil))
}

func TestInitCustomDomainSettingsLeavesHTTPOnlyValidationToServerStartup(t *testing.T) {
	previousEnabled := CustomDomainEnabled
	previousSuffix := CustomDomainSuffix
	previousMainOrigin := CustomDomainMainOrigin
	previousMainOrigins := CustomDomainMainOrigins
	previousCacheTTL := CustomDomainCacheTTLSeconds
	previousReserved := CustomDomainReservedLabels
	previousSecure := SessionCookieSecure
	previousTrusted := SessionCookieTrustedURLs
	t.Cleanup(func() {
		CustomDomainEnabled = previousEnabled
		CustomDomainSuffix = previousSuffix
		CustomDomainMainOrigin = previousMainOrigin
		CustomDomainMainOrigins = previousMainOrigins
		CustomDomainCacheTTLSeconds = previousCacheTTL
		CustomDomainReservedLabels = previousReserved
		SessionCookieSecure = previousSecure
		SessionCookieTrustedURLs = previousTrusted
	})

	t.Setenv("CUSTOM_DOMAIN_ENABLED", "true")
	t.Setenv("CUSTOM_DOMAIN_SUFFIX", "yeschoy.io")
	t.Setenv("CUSTOM_DOMAIN_MAIN_ORIGIN", "https://yeschoy.com")
	t.Setenv("CUSTOM_DOMAIN_MAIN_ORIGINS", "https://yeschoy.com,https://yeschoy.pro")
	t.Setenv("CUSTOM_DOMAIN_CACHE_TTL_SECONDS", "5")
	t.Setenv("CUSTOM_DOMAIN_RESERVED_LABELS", "")
	SessionCookieSecure = false
	SessionCookieTrustedURLs = nil

	require.NoError(t, InitCustomDomainSettings())
	assert.True(t, CustomDomainEnabled)
	assert.Equal(t, []string{"https://yeschoy.com", "https://yeschoy.pro"}, CustomDomainMainOrigins)
	assert.Error(t, ValidateCustomDomainHTTPSettings())
}
