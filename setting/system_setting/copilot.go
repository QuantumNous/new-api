package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type CopilotSettings struct {
	ClientID string `json:"client_id"`
}

var defaultCopilotSettings = CopilotSettings{}

func init() {
	config.GlobalConfig.Register("copilot", &defaultCopilotSettings)
}

func GetCopilotSettings() *CopilotSettings {
	return &defaultCopilotSettings
}
