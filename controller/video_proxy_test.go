package controller

import (
	"net/http"
	"slices"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestTaskMediaWildcardDomainBoundary(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	original.DomainList = slices.Clone(fetchSetting.DomainList)
	original.IpList = slices.Clone(fetchSetting.IpList)
	original.AllowedPorts = slices.Clone(fetchSetting.AllowedPorts)
	t.Cleanup(func() {
		*fetchSetting = original
	})

	*fetchSetting = system_setting.FetchSetting{
		EnableSSRFProtection:   true,
		AllowPrivateIp:         false,
		DomainFilterMode:       true,
		IpFilterMode:           false,
		DomainList:             []string{"*.tos-cn-beijing.volces.com"},
		IpList:                 nil,
		AllowedPorts:           []string{"443"},
		ApplyIPFilterForDomain: false,
	}

	redirectClient := taskMediaRedirectClient(&http.Client{}, "", nil, nil, true)
	paths := []struct {
		name     string
		validate func(*testing.T, string) error
	}{
		{
			name: "initial",
			validate: func(_ *testing.T, rawURL string) error {
				return validateTaskMediaURL(rawURL, "")
			},
		},
		{
			name: "redirect",
			validate: func(t *testing.T, rawURL string) error {
				request, err := http.NewRequest(http.MethodGet, rawURL, nil)
				require.NoError(t, err)
				return redirectClient.CheckRedirect(request, nil)
			},
		},
	}
	tests := []struct {
		name    string
		host    string
		allowed bool
	}{
		{name: "valid subdomain", host: "ark-project.tos-cn-beijing.volces.com", allowed: true},
		{name: "apex", host: "tos-cn-beijing.volces.com", allowed: false},
		{name: "empty leading label", host: ".tos-cn-beijing.volces.com", allowed: false},
		{name: "two empty leading labels", host: "..tos-cn-beijing.volces.com", allowed: false},
		{name: "empty interior label", host: "a..tos-cn-beijing.volces.com", allowed: false},
		{name: "prefix lookalike", host: "evil-tos-cn-beijing.volces.com", allowed: false},
		{name: "suffix lookalike", host: "tos-cn-beijing.volces.com.evil", allowed: false},
		{name: "unicode case-fold lookalike", host: "ar\u212A-project.tos-cn-beijing.volces.com", allowed: false},
		{name: "unicode-space target", host: "\u00a0ark-project.tos-cn-beijing.volces.com", allowed: false},
	}

	for _, path := range paths {
		t.Run(path.name, func(t *testing.T) {
			for _, test := range tests {
				t.Run(test.name, func(t *testing.T) {
					err := path.validate(t, "https://"+test.host+"/object")
					if test.allowed {
						require.NoError(t, err)
					} else {
						require.Error(t, err)
						if path.name == "redirect" {
							require.ErrorIs(t, err, errTaskMediaRequestRejected)
						}
					}
				})
			}
		})
	}
}

func TestTaskMediaBlacklistRejectsInvalidDNSHostnames(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	original.DomainList = slices.Clone(fetchSetting.DomainList)
	original.IpList = slices.Clone(fetchSetting.IpList)
	original.AllowedPorts = slices.Clone(fetchSetting.AllowedPorts)
	t.Cleanup(func() {
		*fetchSetting = original
	})

	redirectClient := taskMediaRedirectClient(&http.Client{}, "", nil, nil, true)
	paths := []struct {
		name     string
		validate func(*testing.T, string) error
	}{
		{
			name: "initial",
			validate: func(_ *testing.T, rawURL string) error {
				return validateTaskMediaURL(rawURL, "")
			},
		},
		{
			name: "redirect",
			validate: func(t *testing.T, rawURL string) error {
				request, err := http.NewRequest(http.MethodGet, rawURL, nil)
				require.NoError(t, err)
				return redirectClient.CheckRedirect(request, nil)
			},
		},
	}
	configurations := []struct {
		name       string
		domainList []string
		tests      []struct {
			name    string
			host    string
			allowed bool
		}
	}{
		{
			name:       "exact",
			domainList: []string{"blocked.example.com"},
			tests: []struct {
				name    string
				host    string
				allowed bool
			}{
				{name: "valid unrelated", host: "allowed.example.com", allowed: true},
				{name: "case-insensitive match", host: "BLOCKED.EXAMPLE.COM", allowed: false},
				{name: "trailing dot", host: "blocked.example.com.", allowed: false},
				{name: "empty interior label", host: "blocked..example.com", allowed: false},
			},
		},
		{
			name:       "wildcard",
			domainList: []string{"*.blocked.example.com"},
			tests: []struct {
				name    string
				host    string
				allowed bool
			}{
				{name: "valid apex", host: "blocked.example.com", allowed: true},
				{name: "case-insensitive match", host: "MEDIA.BLOCKED.EXAMPLE.COM", allowed: false},
				{name: "trailing dot", host: "media.blocked.example.com.", allowed: false},
				{name: "empty interior label", host: "media..blocked.example.com", allowed: false},
			},
		},
		{
			name:       "malformed exact",
			domainList: []string{"\u00a0blocked.example.com"},
			tests: []struct {
				name    string
				host    string
				allowed bool
			}{
				{name: "configured host", host: "blocked.example.com", allowed: false},
				{name: "unrelated host", host: "allowed.example.com", allowed: false},
			},
		},
		{
			name:       "malformed wildcard",
			domainList: []string{"\u00a0*.blocked.example.com"},
			tests: []struct {
				name    string
				host    string
				allowed bool
			}{
				{name: "configured subdomain", host: "media.blocked.example.com", allowed: false},
				{name: "unrelated host", host: "allowed.example.com", allowed: false},
			},
		},
	}

	for _, configuration := range configurations {
		t.Run(configuration.name, func(t *testing.T) {
			*fetchSetting = system_setting.FetchSetting{
				EnableSSRFProtection:   true,
				AllowPrivateIp:         false,
				DomainFilterMode:       false,
				IpFilterMode:           false,
				DomainList:             configuration.domainList,
				IpList:                 nil,
				AllowedPorts:           []string{"443"},
				ApplyIPFilterForDomain: false,
			}
			for _, path := range paths {
				t.Run(path.name, func(t *testing.T) {
					for _, test := range configuration.tests {
						t.Run(test.name, func(t *testing.T) {
							err := path.validate(t, "https://"+test.host+"/object")
							if test.allowed {
								require.NoError(t, err)
							} else {
								require.Error(t, err)
								if path.name == "redirect" {
									require.ErrorIs(t, err, errTaskMediaRequestRejected)
								}
							}
						})
					}
				})
			}
		})
	}
}

func TestTaskMediaRejectsEmptyConfiguredDomainEntries(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	original.DomainList = slices.Clone(fetchSetting.DomainList)
	original.IpList = slices.Clone(fetchSetting.IpList)
	original.AllowedPorts = slices.Clone(fetchSetting.AllowedPorts)
	t.Cleanup(func() {
		*fetchSetting = original
	})

	configurations := []struct {
		name             string
		domainFilterMode bool
		domainList       []string
	}{
		{name: "empty whitelist", domainFilterMode: true, domainList: []string{""}},
		{name: "whitespace-only whitelist", domainFilterMode: true, domainList: []string{" \t\n\v\f\r "}},
		{name: "empty blacklist", domainFilterMode: false, domainList: []string{""}},
		{name: "whitespace-only blacklist", domainFilterMode: false, domainList: []string{" \t\n\v\f\r "}},
	}

	for _, configuration := range configurations {
		t.Run(configuration.name, func(t *testing.T) {
			*fetchSetting = system_setting.FetchSetting{
				EnableSSRFProtection:   true,
				AllowPrivateIp:         false,
				DomainFilterMode:       configuration.domainFilterMode,
				IpFilterMode:           false,
				DomainList:             configuration.domainList,
				AllowedPorts:           []string{"443"},
				ApplyIPFilterForDomain: false,
			}

			require.Error(t, validateTaskMediaURL("https://allowed.example.com/object", ""))

			redirectClient := taskMediaRedirectClient(&http.Client{}, "", nil, nil, true)
			request, err := http.NewRequest(
				http.MethodGet,
				"https://allowed.example.com/object",
				nil,
			)
			require.NoError(t, err)
			require.ErrorIs(
				t,
				redirectClient.CheckRedirect(request, nil),
				errTaskMediaRequestRejected,
			)
		})
	}
}
