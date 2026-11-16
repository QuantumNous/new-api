package console_setting

import "github.com/QuantumNous/new-api/setting/config"

type ConsoleSetting struct {
	ApiInfo              string `json:"api_info"`              // Console API information (JSON array string)
	UptimeKumaGroups     string `json:"uptime_kuma_groups"`    // Uptime Kuma group configuration (JSON array string)
	Announcements        string `json:"announcements"`         // System announcement (JSON array string)
	FAQ                  string `json:"faq"`                   // FAQ (JSON array string)
	ApiInfoEnabled       bool   `json:"api_info_enabled"`      // Whether to enable the API information panel
	UptimeKumaEnabled    bool   `json:"uptime_kuma_enabled"`   // Whether to enable the Uptime Kuma panel
	AnnouncementsEnabled bool   `json:"announcements_enabled"` // Whether to enable the system announcement panel
	FAQEnabled           bool   `json:"faq_enabled"`           // Whether to enable FAQ panel
}

// Default configuration
var defaultConsoleSetting = ConsoleSetting{
	ApiInfo:              "",
	UptimeKumaGroups:     "",
	Announcements:        "",
	FAQ:                  "",
	ApiInfoEnabled:       true,
	UptimeKumaEnabled:    true,
	AnnouncementsEnabled: true,
	FAQEnabled:           true,
}

// global instance
var consoleSetting = defaultConsoleSetting

func init() {
	// Register to the global configuration manager with the key name console_setting
	config.GlobalConfig.Register("console_setting", &consoleSetting)
}

// GetConsoleSetting Gets the ConsoleSetting configuration instance
func GetConsoleSetting() *ConsoleSetting {
	return &consoleSetting
}
