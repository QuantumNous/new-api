package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type AgentSetting struct {
	Enabled bool `json:"enabled"`
}

var agentSetting AgentSetting

func init() { config.GlobalConfig.Register("agent_setting", &agentSetting) }

func GetAgentSetting() *AgentSetting { return &agentSetting }
