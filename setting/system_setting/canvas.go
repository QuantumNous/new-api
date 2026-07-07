package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// CanvasSettings 画布模块配置。
// 素材库存储配额:普通用户默认 200MB,高级(有生效订阅)用户默认 1TB;
// 亦可通过 GroupStorageLimits(JSON: {"组名": 字节数})按用户组覆盖。
// -1 表示不限制;0 视为未配置,回落默认值。
type CanvasSettings struct {
	DefaultStorageLimitBytes int64  `json:"default_storage_limit_bytes"`
	PremiumStorageLimitBytes int64  `json:"premium_storage_limit_bytes"`
	GroupStorageLimits       string `json:"group_storage_limits"`
}

var canvasSettings = CanvasSettings{
	DefaultStorageLimitBytes: 200 * 1024 * 1024,
	PremiumStorageLimitBytes: 1024 * 1024 * 1024 * 1024,
	GroupStorageLimits:       "",
}

func init() {
	config.GlobalConfig.Register("canvas", &canvasSettings)
}

func GetCanvasSettings() *CanvasSettings {
	return &canvasSettings
}
