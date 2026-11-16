package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type DiscordSettings struct {
	Enabled      bool   `json:"enabled"`
	ClientId     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

// Default configuration
var defaultDiscordSettings = DiscordSettings{}

func init() {
	// Register to the global configuration manager
	config.GlobalConfig.Register("discord", &defaultDiscordSettings)
}

func GetDiscordSettings() *DiscordSettings {
	return &defaultDiscordSettings
}
