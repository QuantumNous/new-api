package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type AppConsoleSettings struct {
	Origin string `json:"origin"`
}

var appConsoleSettings = AppConsoleSettings{}

func init() {
	config.GlobalConfig.Register("app_console", &appConsoleSettings)
}

func GetAppConsoleSettings() *AppConsoleSettings {
	return &appConsoleSettings
}
