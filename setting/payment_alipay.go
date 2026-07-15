package setting

var AlipayEnabled = false
var AlipaySandbox = false
var AlipayAppID = ""
var AlipayPrivateKey = ""
var AlipayPublicKey = ""
var AlipayGateway = "https://openapi.alipay.com/gateway.do"
var AlipayNotifyURL = ""
var AlipayReturnURL = ""
var AlipaySellerID = ""
var AlipayMinTopUp = 1

// Cycle-pay (auto-renew) product parameters. Merchants must configure values that match
// their Alipay contract; defaults follow common CYCLE_PAY_AUTH_P documentation samples.
var AlipayCyclePayEnabled = false
var AlipayCyclePayPersonalProductCode = "CYCLE_PAY_AUTH_P"
var AlipayCyclePayProductCode = "GENERAL_WITHHOLDING"
var AlipayCyclePaySignScene = "INDUSTRY|DEFAULT"
