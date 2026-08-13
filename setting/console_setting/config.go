package console_setting

import "github.com/QuantumNous/new-api/setting/config"

const defaultSafetyAnnouncement = `[{"id":1,"content":"## 内容安全与合规提示\n\n请依法合规使用本站 AI 服务。“宽审核”“低审核”“Global”等仅说明上游审核特征，不代表允许违法违规内容，也不保证内容合法、安全或可商用。禁止生成侵权、诈骗、暴力色情、未成年人伤害或侵犯隐私的内容。发布或商用前请人工复核并确认权利；依法需标识 AI 生成合成内容时，不得删除或篡改标识。违规可能导致密钥或账户受限。","publishDate":"2026-08-12T20:28:00+08:00","type":"warning","extra":"本提示仅用于风险告知，不构成法律意见。具体要求以用户协议、隐私政策及适用法律为准。"}]`

type ConsoleSetting struct {
	ApiInfo              string `json:"api_info"`              // 控制台 API 信息 (JSON 数组字符串)
	UptimeKumaGroups     string `json:"uptime_kuma_groups"`    // Uptime Kuma 分组配置 (JSON 数组字符串)
	Announcements        string `json:"announcements"`         // 系统公告 (JSON 数组字符串)
	FAQ                  string `json:"faq"`                   // 常见问题 (JSON 数组字符串)
	ApiInfoEnabled       bool   `json:"api_info_enabled"`      // 是否启用 API 信息面板
	UptimeKumaEnabled    bool   `json:"uptime_kuma_enabled"`   // 是否启用 Uptime Kuma 面板
	AnnouncementsEnabled bool   `json:"announcements_enabled"` // 是否启用系统公告面板
	FAQEnabled           bool   `json:"faq_enabled"`           // 是否启用常见问答面板
}

// 默认配置
var defaultConsoleSetting = ConsoleSetting{
	ApiInfo:              "",
	UptimeKumaGroups:     "",
	Announcements:        defaultSafetyAnnouncement,
	FAQ:                  "",
	ApiInfoEnabled:       true,
	UptimeKumaEnabled:    true,
	AnnouncementsEnabled: true,
	FAQEnabled:           true,
}

// 全局实例
var consoleSetting = defaultConsoleSetting

func init() {
	// 注册到全局配置管理器，键名为 console_setting
	config.GlobalConfig.Register("console_setting", &consoleSetting)
}

// GetConsoleSetting 获取 ConsoleSetting 配置实例
func GetConsoleSetting() *ConsoleSetting {
	return &consoleSetting
}
