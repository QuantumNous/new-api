/**
此文件为旧版支付设置文件，如需增加新的参数、变量等，请在 payment_setting.go 中添加
This file is the old version of the payment settings file. If you need to add new parameters, variables, etc., please add them in payment_setting.go
*/

package operation_setting

import (
	"github.com/QuantumNous/new-api/common"
)

var PayAddress = ""
var CustomCallbackAddress = ""
var EpayId = ""
var EpayKey = ""
var EpayFee float64 = 0
var Price = 7.3
var MinTopUp = 1
var MaxTopUp = 0 // 0 表示不限制
var USDExchangeRate = 7.3
var CommissionUSDExchangeRate = 7.3

// EpayGateway2 holds configuration for a second epay gateway.
// Stored as JSON in the "EpayGateway2" option key.
type EpayGateway2Config struct {
	Address    string              `json:"address"`
	MerchantID string              `json:"merchant_id"`
	Key        string              `json:"key"`
	Name       string              `json:"name"`
	PayMethods []map[string]string `json:"pay_methods"`
	Bonus      float64             `json:"bonus"` // 充值加赠比例（百分比），例如 10 表示加赠 10%
	Price      float64             `json:"price"` // 独立价格/汇率，0 表示使用全局 Price
}

var EpayGateway2 = EpayGateway2Config{}

func UpdateEpayGateway2ByJsonString(jsonString string) error {
	cfg := EpayGateway2Config{}
	if err := common.Unmarshal([]byte(jsonString), &cfg); err != nil {
		return err
	}
	EpayGateway2 = cfg
	return nil
}

func EpayGateway2ToJsonString() string {
	jsonBytes, err := common.Marshal(EpayGateway2)
	if err != nil {
		return "{}"
	}
	return string(jsonBytes)
}

var PayMethods = []map[string]string{
	{
		"name": "支付宝",
		"icon": "SiAlipay",
		"type": "alipay",
	},
	{
		"name": "微信",
		"icon": "SiWechat",
		"type": "wxpay",
	},
	{
		"name":      "自定义1",
		"icon":      "LuCreditCard",
		"type":      "custom1",
		"min_topup": "50",
	},
}

func UpdatePayMethodsByJsonString(jsonString string) error {
	PayMethods = make([]map[string]string, 0)
	return common.Unmarshal([]byte(jsonString), &PayMethods)
}

func PayMethods2JsonString() string {
	jsonBytes, err := common.Marshal(PayMethods)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

func ContainsPayMethod(method string) bool {
	for _, payMethod := range PayMethods {
		if payMethod["type"] == method {
			return true
		}
	}
	return false
}
