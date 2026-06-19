package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// SubAccountSetting 企业子账户配置（docs/enterprise-features-design.md 功能C，决策点 D7）。
type SubAccountSetting struct {
	MaxCount int `json:"max_count"` // 单个企业账户可创建的子账户数量上限
}

// 默认配置：每个企业账户最多 10 个子账户（D7）。
var subAccountSetting = SubAccountSetting{
	MaxCount: 10,
}

func init() {
	config.GlobalConfig.Register("sub_account_setting", &subAccountSetting)
}

// GetSubAccountMaxCount 返回子账户数量上限；非法配置回退到默认 10，避免上限被误设为 0 后无法创建。
func GetSubAccountMaxCount() int {
	if subAccountSetting.MaxCount <= 0 {
		return 10
	}
	return subAccountSetting.MaxCount
}
