package operation_setting

import (
	"slices"
	"strings"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`

	// 易支付签名方式：MD5 使用 EpayKey；RSA 使用商户私钥签名请求、平台公钥验证回调。
	EpaySignType           string `json:"epay_sign_type"`
	EpayMerchantPrivateKey string `json:"epay_merchant_private_key"`
	EpayPlatformPublicKey  string `json:"epay_platform_public_key"`
}

const CurrentComplianceTermsVersion = "v1"

const (
	EpaySignTypeMD5 = "MD5"
	EpaySignTypeRSA = "RSA"

	EpaySignTypeOptionKey           = "payment_setting.epay_sign_type"
	EpayMerchantPrivateKeyOptionKey = "payment_setting.epay_merchant_private_key"
	EpayPlatformPublicKeyOptionKey  = "payment_setting.epay_platform_public_key"
)

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
	// 没有保存过签名方式的站点按 MD5 运行，升级后行为不变。
	EpaySignType: EpaySignTypeMD5,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

func IsPaymentComplianceConfirmed() bool {
	return paymentSetting.ComplianceConfirmed &&
		paymentSetting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}

// ValidateEpaySignOption checks a change to the Epay signing settings against
// the saved ones. While RSA is active, both keys must parse; under MD5 only a
// newly entered key is checked.
func ValidateEpaySignOption(key, value string) error {
	if key != EpaySignTypeOptionKey && key != EpayMerchantPrivateKeyOptionKey && key != EpayPlatformPublicKeyOptionKey {
		return nil
	}
	// Saved values are written under OptionMapRWMutex by the option update path.
	common.OptionMapRWMutex.RLock()
	signType := paymentSetting.EpaySignType
	privateKey := paymentSetting.EpayMerchantPrivateKey
	publicKey := paymentSetting.EpayPlatformPublicKey
	common.OptionMapRWMutex.RUnlock()
	switch key {
	case EpaySignTypeOptionKey:
		if value != EpaySignTypeMD5 && value != EpaySignTypeRSA {
			return common.NewMessage("Epay signature type must be MD5 or RSA")
		}
		signType = value
	case EpayMerchantPrivateKeyOptionKey:
		privateKey = value
	case EpayPlatformPublicKeyOptionKey:
		publicKey = value
	}
	rsaActive := signType == EpaySignTypeRSA
	if rsaActive || (key == EpayMerchantPrivateKeyOptionKey && strings.TrimSpace(value) != "") {
		if _, err := epay.ParseRSAPrivateKey(privateKey); err != nil {
			return common.NewMessage("The Epay merchant private key is missing or invalid")
		}
	}
	if rsaActive || (key == EpayPlatformPublicKeyOptionKey && strings.TrimSpace(value) != "") {
		if _, err := epay.ParseRSAPublicKey(publicKey); err != nil {
			return common.NewMessage("The Epay platform public key is missing or invalid")
		}
	}
	return nil
}

// Payment providers a PayMethods entry can be routed through. An entry without
// a "provider" field is an Epay method, which is how every entry behaved before
// the field existed.
const (
	PayMethodProviderEpay   = "epay"
	PayMethodProviderStripe = "stripe"
)

// PayMethods types that may be routed through Stripe Checkout instead of Epay.
const (
	PayMethodTypeAlipay = "alipay"
	PayMethodTypeWxpay  = "wxpay"
)

var stripeCheckoutPayMethodTypes = []string{PayMethodTypeAlipay, PayMethodTypeWxpay}

// PayMethodProvider returns the provider a PayMethods entry is routed through.
func PayMethodProvider(payMethod map[string]string) string {
	if payMethod["provider"] == PayMethodProviderStripe {
		return PayMethodProviderStripe
	}
	return PayMethodProviderEpay
}

// HasEpayPayMethods reports whether at least one configured payment method is
// routed through Epay.
func HasEpayPayMethods() bool {
	for _, payMethod := range PayMethods {
		if PayMethodProvider(payMethod) == PayMethodProviderEpay {
			return true
		}
	}
	return false
}

// ContainsStripePayMethod reports whether method is an alipay or wxpay entry
// configured to pay through Stripe Checkout.
func ContainsStripePayMethod(method string) bool {
	if !slices.Contains(stripeCheckoutPayMethodTypes, method) {
		return false
	}
	for _, payMethod := range PayMethods {
		if payMethod["type"] == method && PayMethodProvider(payMethod) == PayMethodProviderStripe {
			return true
		}
	}
	return false
}

// ValidatePayMethodsJsonString checks a PayMethods option value before it is
// saved: provider must be empty, epay or stripe; only alipay and wxpay may use
// stripe; and a type routed through Stripe may appear only once, because the
// payment endpoints look methods up by type.
func ValidatePayMethodsJsonString(jsonString string) error {
	var payMethods []map[string]string
	if err := common.Unmarshal([]byte(jsonString), &payMethods); err != nil {
		return common.NewMessage("Payment methods must be a JSON array of objects with string values")
	}
	typeCount := make(map[string]int, len(payMethods))
	stripeTypes := make([]string, 0)
	for _, payMethod := range payMethods {
		methodType := payMethod["type"]
		typeCount[methodType]++
		switch payMethod["provider"] {
		case "", PayMethodProviderEpay:
		case PayMethodProviderStripe:
			if !slices.Contains(stripeCheckoutPayMethodTypes, methodType) {
				return common.NewMessage("Only alipay and wxpay payment methods can use the Stripe channel, got {{type}}", map[string]any{"type": methodType})
			}
			stripeTypes = append(stripeTypes, methodType)
		default:
			return common.NewMessage("Unsupported payment channel {{provider}} for payment method {{type}}", map[string]any{"provider": payMethod["provider"], "type": methodType})
		}
	}
	for _, methodType := range stripeTypes {
		if typeCount[methodType] > 1 {
			return common.NewMessage("Payment method {{type}} uses the Stripe channel and must be configured only once", map[string]any{"type": methodType})
		}
	}
	return nil
}
