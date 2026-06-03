package operation_setting

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type QuotaSetting struct {
	EnableFreeModelPreConsume        bool   `json:"enable_free_model_pre_consume"`         // 是否对免费模型启用预消耗
	ZeroOutputQuotaExemptionEnabled  bool   `json:"zero_output_quota_exemption_enabled"`   // 是否启用 0 输出额度豁免
	ZeroOutputQuotaExemptionGlobal   bool   `json:"zero_output_quota_exemption_global"`    // 是否对所有用户启用 0 输出额度豁免
	ZeroOutputQuotaExemptionUserList string `json:"zero_output_quota_exemption_user_list"` // 0 输出额度豁免用户列表，支持用户 ID 或用户名
}

// 默认配置
var quotaSetting = QuotaSetting{
	EnableFreeModelPreConsume: true,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("quota_setting", &quotaSetting)
}

func GetQuotaSetting() *QuotaSetting {
	return &quotaSetting
}

func splitZeroOutputQuotaExemptionUsers(raw string) []string {
	return strings.FieldsFunc(raw, func(r rune) bool {
		switch r {
		case ',', '，', ';', '；', '\n', '\r', '\t', ' ':
			return true
		default:
			return false
		}
	})
}

func IsZeroOutputQuotaExemptUser(userId int, username string) bool {
	if !quotaSetting.ZeroOutputQuotaExemptionEnabled {
		return false
	}
	if quotaSetting.ZeroOutputQuotaExemptionGlobal {
		return true
	}

	userIdText := strconv.Itoa(userId)
	username = strings.TrimSpace(username)
	for _, item := range splitZeroOutputQuotaExemptionUsers(quotaSetting.ZeroOutputQuotaExemptionUserList) {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if userId > 0 && item == userIdText {
			return true
		}
		if username != "" && strings.EqualFold(item, username) {
			return true
		}
	}
	return false
}
