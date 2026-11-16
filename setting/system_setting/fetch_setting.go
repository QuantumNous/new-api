package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type FetchSetting struct {
	EnableSSRFProtection   bool     `json:"enable_ssrf_protection"` // Whether to enable SSRF protection
	AllowPrivateIp         bool     `json:"allow_private_ip"`
	DomainFilterMode       bool     `json:"domain_filter_mode"`         // Domain name filtering mode, true: whitelist mode, false: blacklist mode
	IpFilterMode           bool     `json:"ip_filter_mode"`             // IP filtering mode, true: whitelist mode, false: blacklist mode
	DomainList             []string `json:"domain_list"`                // domain format, e.g. example.com, *.example.com
	IpList                 []string `json:"ip_list"`                    // CIDR format
	AllowedPorts           []string `json:"allowed_ports"`              // port range format, e.g. 80, 443, 8000-9000
	ApplyIPFilterForDomain bool     `json:"apply_ip_filter_for_domain"` // Enable IP filtering for domain names (experimental)
}

var defaultFetchSetting = FetchSetting{
	EnableSSRFProtection:   true, // SSRF protection is enabled by default
	AllowPrivateIp:         false,
	DomainFilterMode:       false,
	IpFilterMode:           false,
	DomainList:             []string{},
	IpList:                 []string{},
	AllowedPorts:           []string{"80", "443", "8080", "8443"},
	ApplyIPFilterForDomain: true,
}

func init() {
	// Register to the global configuration manager
	config.GlobalConfig.Register("fetch_setting", &defaultFetchSetting)
}

func GetFetchSetting() *FetchSetting {
	return &defaultFetchSetting
}
