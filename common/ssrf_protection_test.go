package common

import (
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSSRFProtectionRejectsLiteralPrivateAndReservedIPs(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   false,
		DomainFilterMode: false,
		IpFilterMode:     false,
	}

	tests := []string{
		"127.0.0.1",
		"10.0.0.1",
		"169.254.169.254",
		"fc00::1",
		"::ffff:127.0.0.1",
	}
	for _, host := range tests {
		t.Run(host, func(t *testing.T) {
			require.Error(t, protection.ValidateNetworkTarget(host, 80))
		})
	}
}

func TestSSRFProtectionAllowsPrivateIPWhenExplicitlyEnabled(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   true,
		DomainFilterMode: false,
		IpFilterMode:     false,
	}

	require.NoError(t, protection.ValidateNetworkTarget("10.0.0.1", 80))
}

func TestSSRFProtectionRejectsResolvedPrivateIP(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:         false,
		DomainFilterMode:       false,
		IpFilterMode:           false,
		ApplyIPFilterForDomain: true,
	}

	require.NoError(t, protection.ValidateNetworkTarget("example.com", 80))
	require.Error(t, protection.ValidateResolvedIP("example.com", net.ParseIP("169.254.169.254")))
}

func TestNewSSRFProtectionFromFetchSettingParsesPortRanges(t *testing.T) {
	protection, err := NewSSRFProtectionFromFetchSetting(false, false, false, nil, nil, []string{"80", "8000-8001"}, true)
	require.NoError(t, err)

	require.NoError(t, protection.ValidateNetworkTarget("example.com", 8001))
	require.Error(t, protection.ValidateNetworkTarget("example.com", 9000))
}

func TestSSRFProtectionDomainFilterRules(t *testing.T) {
	wildcardDomains := []string{"  *.TOS-CN-BEIJING.VOLCES.COM  "}
	exactDomains := []string{"tos-cn-beijing.volces.com"}
	malformedExactDomains := []string{"\u212A.example.com"}
	malformedWildcardDomains := []string{"*.\u212A.example.com"}
	unicodeSpaceExactDomains := []string{"\u00a0tos-cn-beijing.volces.com"}
	unicodeSpaceWildcardDomains := []string{"\u00a0*.tos-cn-beijing.volces.com"}
	malformedExactBlacklist := []string{"\u00a0blocked.example.com"}
	malformedWildcardBlacklist := []string{"\u00a0*.blocked.example.com"}
	tests := []struct {
		name             string
		domainList       []string
		domainFilterMode bool
		domain           string
		listed           bool
		allowed          bool
	}{
		{"wildcard whitelist allows subdomain", wildcardDomains, true, "ARK-PROJECT.TOS-CN-BEIJING.VOLCES.COM", true, true},
		{"wildcard whitelist rejects apex", wildcardDomains, true, "tos-cn-beijing.volces.com", false, false},
		{"wildcard whitelist rejects empty leading label", wildcardDomains, true, ".tos-cn-beijing.volces.com", false, false},
		{"wildcard whitelist rejects two empty leading labels", wildcardDomains, true, "..tos-cn-beijing.volces.com", false, false},
		{"wildcard whitelist rejects empty interior label", wildcardDomains, true, "a..tos-cn-beijing.volces.com", false, false},
		{"wildcard whitelist rejects prefix lookalike", wildcardDomains, true, "evil-tos-cn-beijing.volces.com", false, false},
		{"wildcard whitelist rejects suffix lookalike", wildcardDomains, true, "tos-cn-beijing.volces.com.evil", false, false},
		{"wildcard whitelist rejects unicode case-fold lookalike", wildcardDomains, true, "ar\u212A-project.tos-cn-beijing.volces.com", false, false},
		{"wildcard whitelist rejects unicode-space target", wildcardDomains, true, "\u00a0ark-project.tos-cn-beijing.volces.com", false, false},
		{"exact whitelist allows apex", exactDomains, true, "tos-cn-beijing.volces.com", true, true},
		{"exact whitelist rejects subdomain", exactDomains, true, "ark-project.tos-cn-beijing.volces.com", false, false},
		{"malformed exact whitelist rejects unicode case-fold match", malformedExactDomains, true, "k.example.com", false, false},
		{"malformed wildcard whitelist rejects unicode case-fold match", malformedWildcardDomains, true, "host.k.example.com", false, false},
		{"malformed exact whitelist rejects unicode-space entry", unicodeSpaceExactDomains, true, "tos-cn-beijing.volces.com", false, false},
		{"malformed wildcard whitelist rejects unicode-space entry", unicodeSpaceWildcardDomains, true, "ark-project.tos-cn-beijing.volces.com", false, false},
		{"wildcard blacklist rejects subdomain", wildcardDomains, false, "ark-project.tos-cn-beijing.volces.com", true, false},
		{"wildcard blacklist rejects case-insensitive subdomain", wildcardDomains, false, "ARK-PROJECT.TOS-CN-BEIJING.VOLCES.COM", true, false},
		{"wildcard blacklist rejects trailing dot", wildcardDomains, false, "ark-project.tos-cn-beijing.volces.com.", false, false},
		{"wildcard blacklist rejects empty interior label", wildcardDomains, false, "ark-project..tos-cn-beijing.volces.com", false, false},
		{"wildcard blacklist allows apex", wildcardDomains, false, "tos-cn-beijing.volces.com", false, true},
		{"wildcard blacklist allows prefix lookalike", wildcardDomains, false, "evil-tos-cn-beijing.volces.com", false, true},
		{"wildcard blacklist allows suffix lookalike", wildcardDomains, false, "tos-cn-beijing.volces.com.evil", false, true},
		{"exact blacklist rejects case-insensitive apex", exactDomains, false, "TOS-CN-BEIJING.VOLCES.COM", true, false},
		{"exact blacklist rejects trailing dot", exactDomains, false, "tos-cn-beijing.volces.com.", false, false},
		{"exact blacklist rejects empty interior label", exactDomains, false, "tos-cn-beijing..volces.com", false, false},
		{"exact blacklist rejects unicode-space target", exactDomains, false, "\u00a0tos-cn-beijing.volces.com", false, false},
		{"malformed exact blacklist fails closed", malformedExactBlacklist, false, "blocked.example.com", false, false},
		{"malformed wildcard blacklist fails closed", malformedWildcardBlacklist, false, "media.blocked.example.com", false, false},
		{"empty whitelist entry fails closed", []string{""}, true, "allowed.example.com", false, false},
		{"whitespace-only whitelist entry fails closed", []string{" \t\n\v\f\r "}, true, "allowed.example.com", false, false},
		{"empty blacklist entry fails closed", []string{""}, false, "allowed.example.com", false, false},
		{"whitespace-only blacklist entry fails closed", []string{" \t\n\v\f\r "}, false, "allowed.example.com", false, false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Run("matcher", func(t *testing.T) {
				require.Equal(t, test.listed, isDomainListed(test.domain, test.domainList))
			})

			t.Run("URL validation", func(t *testing.T) {
				err := ValidateURLWithFetchSetting(
					"https://"+test.domain+"/object",
					true, false, test.domainFilterMode, false,
					test.domainList, nil, []string{"443"}, false,
				)
				if test.allowed {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}
			})
		})
	}
}
