package model_setting

import "github.com/QuantumNous/new-api/setting/config"

// CodexSettings defines Codex model configuration.
// Note: bool fields should end with "enabled" so the UI can parse them as boolean options.
type CodexSettings struct {
	NonStreamAdapterEnabled bool `json:"non_stream_adapter_enabled"`
}

var defaultCodexSettings = CodexSettings{
	NonStreamAdapterEnabled: true,
}

var codexSettings = defaultCodexSettings

func init() {
	config.GlobalConfig.Register("codex", &codexSettings)
}

func GetCodexSettings() *CodexSettings {
	return &codexSettings
}
