package system_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// DesktopSettings controls the desktop client device-authorization flow: the
// desktop app exchanges a device code for a signed access token plus a relay
// API key, and an external connector broker verifies those tokens via JWKS.
type DesktopSettings struct {
	Enabled bool `json:"enabled"`
	// ReleaseManifestURL points at the releases.json the desktop publish pipeline writes to
	// Cloudflare R2. The download page reads it directly for the current version, per-platform
	// installer URLs, sizes, and checksums, so shipping a release never needs a backend deploy.
	ReleaseManifestURL string `json:"release_manifest_url"`
	// DownloadURL is the manual override used when no manifest is reachable.
	DownloadURL        string `json:"download_url"`
	MinVersion         string `json:"min_version"`
	TokenName          string `json:"token_name"`
	BrokerAudience     string `json:"broker_audience"`
	AccessTokenMinutes int    `json:"access_token_minutes"`
	RefreshTokenDays   int    `json:"refresh_token_days"`
}

var defaultDesktopSettings = DesktopSettings{
	Enabled:            false,
	ReleaseManifestURL: "https://dl.you-box.com/desktop/releases.json",
	DownloadURL:        "",
	MinVersion:         "",
	TokenName:          "BoxAI Desktop",
	BrokerAudience:     "",
	AccessTokenMinutes: 60,
	RefreshTokenDays:   30,
}

func init() {
	config.GlobalConfig.Register("desktop", &defaultDesktopSettings)
}

func GetDesktopSettings() *DesktopSettings {
	if defaultDesktopSettings.TokenName == "" {
		defaultDesktopSettings.TokenName = "BoxAI Desktop"
	}
	if defaultDesktopSettings.AccessTokenMinutes <= 0 {
		defaultDesktopSettings.AccessTokenMinutes = 60
	}
	if defaultDesktopSettings.RefreshTokenDays <= 0 {
		defaultDesktopSettings.RefreshTokenDays = 30
	}
	if defaultDesktopSettings.BrokerAudience == "" {
		defaultDesktopSettings.BrokerAudience = defaultBrokerAudience()
	}
	return &defaultDesktopSettings
}

// defaultBrokerAudience derives an audience from the deployment address so a
// fresh install issues tokens the connector broker can pin without extra setup.
func defaultBrokerAudience() string {
	addr := strings.TrimSpace(ServerAddress)
	if addr == "" {
		return "boxai-desktop"
	}
	return strings.TrimSuffix(addr, "/") + "/desktop"
}
