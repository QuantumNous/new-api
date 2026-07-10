package setting

import "strings"

var (
	XunhuEnabled      bool
	XunhuGatewayUrl   = "https://api.xunhupay.com/payment/do.html"
	XunhuWxAppId      string
	XunhuWxAppSecret  string
	XunhuAliAppId     string
	XunhuAliAppSecret string
	XunhuUnitPrice    float64 = 1.0
	XunhuMinTopUp     int     = 1
)

const (
	XunhuPayMethodWxPay  = "wxpay"
	XunhuPayMethodAlipay = "alipay"
)

type XunhuPayMethod struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

func IsXunhuWxConfigured() bool {
	return strings.TrimSpace(XunhuWxAppId) != "" && strings.TrimSpace(XunhuWxAppSecret) != ""
}

func IsXunhuAliConfigured() bool {
	return strings.TrimSpace(XunhuAliAppId) != "" && strings.TrimSpace(XunhuAliAppSecret) != ""
}

func GetXunhuGatewayUrl() string {
	url := strings.TrimSpace(XunhuGatewayUrl)
	if url == "" {
		return "https://api.xunhupay.com/payment/do.html"
	}
	return url
}

func GetXunhuPayMethods() []XunhuPayMethod {
	methods := make([]XunhuPayMethod, 0, 2)
	if IsXunhuWxConfigured() {
		methods = append(methods, XunhuPayMethod{Name: "微信支付", Type: XunhuPayMethodWxPay})
	}
	if IsXunhuAliConfigured() {
		methods = append(methods, XunhuPayMethod{Name: "支付宝", Type: XunhuPayMethodAlipay})
	}
	return methods
}

func GetXunhuCredentials(paymentMethod string) (appId, appSecret string, ok bool) {
	switch paymentMethod {
	case XunhuPayMethodWxPay:
		if !IsXunhuWxConfigured() {
			return "", "", false
		}
		return strings.TrimSpace(XunhuWxAppId), strings.TrimSpace(XunhuWxAppSecret), true
	case XunhuPayMethodAlipay:
		if !IsXunhuAliConfigured() {
			return "", "", false
		}
		return strings.TrimSpace(XunhuAliAppId), strings.TrimSpace(XunhuAliAppSecret), true
	default:
		return "", "", false
	}
}

func GetXunhuSecretByAppId(appId string) (string, bool) {
	appId = strings.TrimSpace(appId)
	if appId == "" {
		return "", false
	}
	if appId == strings.TrimSpace(XunhuWxAppId) && IsXunhuWxConfigured() {
		return strings.TrimSpace(XunhuWxAppSecret), true
	}
	if appId == strings.TrimSpace(XunhuAliAppId) && IsXunhuAliConfigured() {
		return strings.TrimSpace(XunhuAliAppSecret), true
	}
	return "", false
}
