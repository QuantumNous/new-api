package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// BankTransferSetting 对公转账收款配置（docs/enterprise-features-design.md §2.2）。
// 收款四要素是公开信息（用户必须看到才能转账），明文存储、随用户侧接口下发。
type BankTransferSetting struct {
	Enabled       bool   `json:"enabled"`
	CompanyName   string `json:"company_name"`    // 公司名称
	PayeeName     string `json:"payee_name"`      // 收款单位
	AccountNumber string `json:"account_number"`  // 收款账号
	BankName      string `json:"bank_name"`       // 开户行
	MinAmountFen  int64  `json:"min_amount_fen"`  // 最低单笔转账金额（分），0=不限
	Tips          string `json:"tips"`            // 卡片附加说明（如"转账请备注注册邮箱"）
}

var bankTransferSetting = BankTransferSetting{}

func init() {
	config.GlobalConfig.Register("bank_transfer_setting", &bankTransferSetting)
}

func GetBankTransferSetting() *BankTransferSetting {
	return &bankTransferSetting
}

// IsAvailable 启用且收款四要素齐备时对公转账才可用。
func (s *BankTransferSetting) IsAvailable() bool {
	return s.Enabled && s.CompanyName != "" && s.PayeeName != "" && s.AccountNumber != "" && s.BankName != ""
}
