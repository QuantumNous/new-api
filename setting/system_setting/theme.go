package system_setting

import (
	"github.com/QuantumNous/new-api/setting/config"
)

const DefaultFrontend = "default"

type ThemeSettings struct {
	Frontend string `json:"frontend"`
}

var themeSettings = ThemeSettings{
	Frontend: DefaultFrontend,
}

func init() {
	config.GlobalConfig.Register("theme", &themeSettings)
}

func GetThemeSettings() *ThemeSettings {
	return &themeSettings
}
