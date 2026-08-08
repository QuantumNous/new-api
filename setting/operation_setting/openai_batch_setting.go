package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type OpenAIBatchSetting struct {
	Enabled bool `json:"enabled"`
}

var openAIBatchSetting = OpenAIBatchSetting{Enabled: false}

func init() {
	config.GlobalConfig.Register("openai_batch_setting", &openAIBatchSetting)
}

func IsOpenAIBatchEnabled() bool {
	return openAIBatchSetting.Enabled
}
