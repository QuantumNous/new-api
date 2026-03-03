package model_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// QwenSettings defines Qwen model configuration. 注意bool要以enabled结尾才可以生效编辑
type QwenSettings struct {
	SyncImageModels []string `json:"sync_image_models"`
}

// 默认配置
var defaultQwenSettings = QwenSettings{
	SyncImageModels: []string{
		"z-image",
		"qwen-image",
		"wan2.6",
		"qwen-image-edit",
		"qwen-image-edit-max",
		"qwen-image-edit-max-2026-01-16",
		"qwen-image-edit-plus",
		"qwen-image-edit-plus-2025-12-15",
		"qwen-image-edit-plus-2025-10-30",
	},
}

// 全局实例
var qwenSettings = defaultQwenSettings

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("qwen", &qwenSettings)
}

// GetQwenSettings
func GetQwenSettings() *QwenSettings {
	return &qwenSettings
}

// IsSyncImageModel
func IsSyncImageModel(model string) bool {
	for _, m := range qwenSettings.SyncImageModels {
		if strings.Contains(model, m) {
			return true
		}
	}
	return false
}
