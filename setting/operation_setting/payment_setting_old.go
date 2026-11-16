/* *
This file is an old version of the payment settings file. If you need to add new parameters, variables, etc., please add them in payment_setting.go
This file is the old version of the payment settings file. If you need to add new parameters, variables, etc., please add them in payment_setting.go */

package operation_setting

import (
	"github.com/QuantumNous/new-api/common"
)

var PayAddress = ""
var CustomCallbackAddress = ""
var EpayId = ""
var EpayKey = ""
var Price = 7.3
var MinTopUp = 1
var USDExchangeRate = 7.3

var PayMethods = []map[string]string{
	{
		"name": "Alipay",
		"icon": "SiAlipay",
		"type": "alipay",
	},
	{
		"name": "WeChat Pay",
		"icon": "SiWechat",
		"type": "wxpay",
	},
	{
		"name":      "Custom 1",
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
