package setting

// Alipay official gateway configuration for browser checkout.
// Gateway is enabled once AppID + PrivateKey + PublicKey are populated.
var (
	AlipayAppId      string
	AlipayGateway    string = "https://openapi.alipay.com/gateway.do"
	AlipayPrivateKey string
	AlipayPublicKey  string
)
