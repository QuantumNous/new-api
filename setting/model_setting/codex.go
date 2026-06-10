package model_setting

import "github.com/QuantumNous/new-api/setting/config"

// CodexSettings 是 codex 渠道相关的全局设置。
type CodexSettings struct {
	// ImageCarrierModel:codex 图像出图的全局承载文本模型(留空=用代码默认 gpt-5.4)。
	// 当上游文本模型改名/下线时,改这一处即可影响所有 codex 渠道。
	ImageCarrierModel string `json:"image_carrier_model"`
}

// 默认值:留空,表示回退到代码常量 defaultImageCarrierModel。
var defaultCodexSettings = CodexSettings{
	ImageCarrierModel: "",
}

var codexSettings = defaultCodexSettings

func init() {
	config.GlobalConfig.Register("codex", &codexSettings)
}

func GetCodexSettings() *CodexSettings {
	return &codexSettings
}
