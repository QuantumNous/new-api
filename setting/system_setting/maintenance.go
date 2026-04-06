package system_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// MaintenanceSetting 维护模式配置
type MaintenanceSetting struct {
	Enabled          bool   `json:"enabled"`            // 是否处于维护中
	Title            string `json:"title"`              // 维护标题
	Message          string `json:"message"`            // 维护说明
	NoticeEnabled    bool   `json:"notice_enabled"`     // 是否启用预告
	NoticeStartAt    int64  `json:"notice_start_at"`    // 预告开始时间（Unix 秒）
	StartAt          int64  `json:"start_at"`           // 维护开始时间
	EndAt            int64  `json:"end_at"`             // 维护结束时间（0=不限）
	WhitelistUserIds string `json:"whitelist_user_ids"` // 白名单用户ID（JSON数组字符串，如 "[1,2,3]"）
	AllowAdminPass   bool   `json:"allow_admin_pass"`   // 是否放行管理员（默认 true）
}

// MaintenancePublicInfo 对外公开的维护信息（不含白名单等敏感数据）
type MaintenancePublicInfo struct {
	Enabled       bool   `json:"enabled"`
	NoticeEnabled bool   `json:"notice_enabled"`
	Title         string `json:"title"`
	Message       string `json:"message"`
	StartAt       int64  `json:"start_at"`
	EndAt         int64  `json:"end_at"`
}

// 默认配置：维护关闭，管理员默认放行
var maintenanceSetting = MaintenanceSetting{
	Enabled:          false,
	Title:            "系统维护中",
	Message:          "系统正在维护，请稍后再试",
	NoticeEnabled:    false,
	NoticeStartAt:    0,
	StartAt:          0,
	EndAt:            0,
	WhitelistUserIds: "[]",
	AllowAdminPass:   true,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("maintenance_setting", &maintenanceSetting)
}

// GetMaintenanceSetting 获取完整维护配置
func GetMaintenanceSetting() *MaintenanceSetting {
	return &maintenanceSetting
}

// GetMaintenancePublicInfo 获取对外公开的维护信息
func GetMaintenancePublicInfo() *MaintenancePublicInfo {
	return &MaintenancePublicInfo{
		Enabled:       maintenanceSetting.Enabled,
		NoticeEnabled: maintenanceSetting.NoticeEnabled,
		Title:         maintenanceSetting.Title,
		Message:       maintenanceSetting.Message,
		StartAt:       maintenanceSetting.StartAt,
		EndAt:         maintenanceSetting.EndAt,
	}
}

// IsMaintenanceEnabled 是否处于维护模式
func IsMaintenanceEnabled() bool {
	return maintenanceSetting.Enabled
}

// UpdateMaintenanceSetting 更新维护配置（用于从控制器调用）
func UpdateMaintenanceSetting(newSetting MaintenanceSetting) {
	maintenanceSetting = newSetting
}

// GetWhitelistUserIds 解析白名单用户ID列表
func GetWhitelistUserIds() []int {
	var ids []int
	err := common.UnmarshalJsonStr(maintenanceSetting.WhitelistUserIds, &ids)
	if err != nil {
		return []int{}
	}
	return ids
}
