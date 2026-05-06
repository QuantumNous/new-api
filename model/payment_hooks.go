package model

// AlipayClientResetHook is set by controller/topup_alipay.go init() to break the
// model→controller import cycle. Called when admin updates any Alipay setting key.
var AlipayClientResetHook func()

// WxpayClientResetHook is set by controller/topup_wxpay.go init() to break the
// model→controller import cycle. Called when admin updates any WeChat Pay setting key.
var WxpayClientResetHook func()
