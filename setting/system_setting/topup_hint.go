package system_setting

import (
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type TopupHintSettings struct {
	AllowedHosts []string `json:"allowed_hosts"`
}

var defaultTopupHintSettings = TopupHintSettings{
	AllowedHosts: []string{},
}

func init() {
	config.GlobalConfig.Register("topup_hint", &defaultTopupHintSettings)
}

func GetTopupHintSettings() *TopupHintSettings {
	return &defaultTopupHintSettings
}

func TopupHintHostAllowed(rawURL string) bool {
	host := topupHintURLHost(rawURL)
	if host == "" {
		return false
	}
	for _, allowedHost := range defaultTopupHintSettings.AllowedHosts {
		if normalizeTopupHintHost(allowedHost) == host {
			return true
		}
	}
	return false
}

func topupHintURLHost(rawURL string) string {
	if strings.TrimSpace(rawURL) == "" {
		return ""
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return normalizeTopupHintHost(parsed.Hostname())
}

func normalizeTopupHintHost(host string) string {
	return strings.ToLower(strings.TrimSpace(host))
}
