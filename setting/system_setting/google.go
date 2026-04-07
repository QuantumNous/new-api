package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type GoogleSettings struct {
	Enabled      bool   `json:"enabled"`
	ClientId     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

var defaultGoogleSettings = GoogleSettings{}

func init() {
	config.GlobalConfig.Register("google", &defaultGoogleSettings)
}

func GetGoogleSettings() *GoogleSettings {
	return &defaultGoogleSettings
}
