package setting

// 微信/支付宝原生扫码支付（Native QR Pay）配置。
// 与其它支付渠道一致，这些值通过 DB options 持久化（管理端设置页配置），
// 在 model/option.go 的 InitOptionMap / updateOptionMap 中接线。

// 微信支付 V3 Native
var (
	WechatPayEnabled    = false // 是否启用微信原生扫码支付
	WechatPayAppID      = ""    // 公众号/应用 AppID（Native 下单需要）
	WechatPayMchID      = ""    // 商户号
	WechatPayApiV3Key   = ""    // APIv3 密钥（回调 AES-GCM 解密）
	WechatPaySerialNo   = ""    // 商户 API 证书序列号
	WechatPayPrivateKey = ""    // 商户 API 证书私钥 apiclient_key.pem 内容（PEM）
)

// 支付宝 Native（trade.precreate，密钥模式）
var (
	AlipayEnabled    = false // 是否启用支付宝原生扫码支付
	AlipayAppID      = ""    // 应用 AppID
	AlipayPrivateKey = ""    // 应用私钥（PEM，支持 PKCS1/PKCS8）
	AlipayPublicKey  = ""    // 支付宝公钥（PEM，密钥模式验签）
	AlipayIsProd     = true  // true=生产环境，false=沙箱
)
