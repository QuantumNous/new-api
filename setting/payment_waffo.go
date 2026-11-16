package setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

var (
	WaffoEnabled               bool
	WaffoApiKey                string
	WaffoPrivateKey            string
	WaffoPublicCert            string
	WaffoSandboxPublicCert     string
	WaffoSandboxApiKey         string
	WaffoSandboxPrivateKey     string
	WaffoSandbox               bool
	WaffoMerchantId            string
	WaffoNotifyUrl             string
	WaffoReturnUrl             string
	WaffoSubscriptionReturnUrl string
	WaffoCurrency              string
	WaffoUnitPrice             float64 = 1.0
	WaffoMinTopUp              int     = 1
)

// GetWaffoPayMethods reads Waffo payment method configuration from options
func GetWaffoPayMethods() []constant.WaffoPayMethod {
	common.OptionMapRWMutex.RLock()
	jsonStr := common.OptionMap["WaffoPayMethods"]
	common.OptionMapRWMutex.RUnlock()

	if jsonStr == "" {
		return copyDefaultWaffoPayMethods()
	}
	var methods []constant.WaffoPayMethod
	if err := common.UnmarshalJsonStr(jsonStr, &methods); err != nil {
		return copyDefaultWaffoPayMethods()
	}
	return methods
}

// SetWaffoPayMethods serializes Waffo payment method configuration and updates OptionMap
func SetWaffoPayMethods(methods []constant.WaffoPayMethod) error {
	jsonBytes, err := common.Marshal(methods)
	if err != nil {
		return err
	}
	common.OptionMapRWMutex.Lock()
	common.OptionMap["WaffoPayMethods"] = string(jsonBytes)
	common.OptionMapRWMutex.Unlock()
	return nil
}

func copyDefaultWaffoPayMethods() []constant.WaffoPayMethod {
	cp := make([]constant.WaffoPayMethod, len(constant.DefaultWaffoPayMethods))
	copy(cp, constant.DefaultWaffoPayMethods)
	return cp
}

// WaffoPayMethods2JsonString Serializes default WaffoPayMethods to a JSON string (for use by InitOptionMap)
func WaffoPayMethods2JsonString() string {
	jsonBytes, err := common.Marshal(constant.DefaultWaffoPayMethods)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}
