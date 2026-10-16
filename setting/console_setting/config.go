package console_setting

import (
	"fmt"
	"github.com/QuantumNous/new-api/setting/config"
)

type ConsoleSetting struct {
	HomeBusinessQRCode    string `json:"home_business_qrcode"`
	HomeGlobeDomesticOnly bool   `json:"home_globe_domestic_only"`
	DefaultLanguage       string `json:"default_language"`
	ApiInfo               string `json:"api_info"`              // 控制台 API 信息 (JSON 数组字符串)
	UptimeKumaGroups      string `json:"uptime_kuma_groups"`    // Uptime Kuma 分组配置 (JSON 数组字符串)
	Announcements         string `json:"announcements"`         // 系统公告 (JSON 数组字符串)
	FAQ                   string `json:"faq"`                   // 常见问题 (JSON 数组字符串)
	Footer                string `json:"footer"`                // 主页页脚配置 (JSON 对象字符串)
	SupportLinks          string `json:"support_links"`         // 支持页面分类与入口 (JSON 数组字符串)
	WalletPromotion       string `json:"wallet_promotion"`      // 钱包页推广内容 (JSON 对象字符串)
	ApiInfoEnabled        bool   `json:"api_info_enabled"`      // 是否启用 API 信息面板
	UptimeKumaEnabled     bool   `json:"uptime_kuma_enabled"`   // 是否启用 Uptime Kuma 面板
	AnnouncementsEnabled  bool   `json:"announcements_enabled"` // 是否启用系统公告面板
	FAQEnabled            bool   `json:"faq_enabled"`           // 是否启用常见问答面板
}

// 默认配置
var defaultConsoleSetting = ConsoleSetting{
	DefaultLanguage:      "auto",
	ApiInfo:              "",
	UptimeKumaGroups:     "",
	Announcements:        "",
	FAQ:                  "",
	Footer:               "",
	SupportLinks:         "[]",
	WalletPromotion:      "",
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

// ValidateDefaultLanguage accepts the interface languages and browser detection mode.
func ValidateDefaultLanguage(value string) error {
	switch value {
	case "auto", "en", "zhCN", "zhTW", "fr", "ru", "ja", "vi":
		return nil
	default:
		return fmt.Errorf("unsupported site default language: %s", value)
	}
}
