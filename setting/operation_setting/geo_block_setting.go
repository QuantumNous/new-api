package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type GeoBlockSetting struct {
	Enabled     bool   `json:"enabled"`
	Countries   string `json:"countries"`
	PageContent string `json:"page_content"`
}

var geoBlockSetting = GeoBlockSetting{
	Enabled:     false,
	Countries:   "",
	PageContent: "",
}

func init() {
	config.GlobalConfig.Register("geo_block", &geoBlockSetting)
}

func GetGeoBlockSetting() *GeoBlockSetting {
	return &geoBlockSetting
}

func IsCountryBlocked(country string) bool {
	if !geoBlockSetting.Enabled || country == "" || geoBlockSetting.Countries == "" {
		return false
	}
	countryUpper := strings.ToUpper(strings.TrimSpace(country))
	parts := strings.Split(geoBlockSetting.Countries, ",")
	for _, p := range parts {
		if strings.ToUpper(strings.TrimSpace(p)) == countryUpper {
			return true
		}
	}
	return false
}
