package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type CDNSetting struct {
	Enabled      bool              `json:"enabled"`
	DetectHeader string            `json:"detect_header"`
	Rules        map[string]string `json:"rules"`
}

var cdnSetting = CDNSetting{
	Enabled:      false,
	DetectHeader: "X-GeoIP-Country",
	Rules:        map[string]string{},
}

func init() {
	config.GlobalConfig.Register("cdn_setting", &cdnSetting)
}

func GetCDNSetting() *CDNSetting {
	return &cdnSetting
}

// GetCDNUrlForCountry resolves the CDN URL for a given country code.
// Resolution order: exact rule match → "default" rule → empty.
func GetCDNUrlForCountry(country string) string {
	if !cdnSetting.Enabled || country == "" {
		return ""
	}
	countryUpper := strings.ToUpper(strings.TrimSpace(country))

	// 1. Exact rule match (case-insensitive)
	for k, v := range cdnSetting.Rules {
		if strings.ToUpper(k) == countryUpper && strings.ToUpper(k) != "DEFAULT" {
			return strings.TrimRight(v, "/")
		}
	}

	// 2. Default rule
	for k, v := range cdnSetting.Rules {
		if strings.ToUpper(k) == "DEFAULT" {
			return strings.TrimRight(v, "/")
		}
	}

	return ""
}
