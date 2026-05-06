package controller

import "github.com/QuantumNous/new-api/service"

func init() {
	service.DirectPaymentExpiryScanHook = func() {
		CloseExpiredAlipayOrders()
		CloseExpiredWxpayOrders()
		CloseExpiredSubscriptionAlipayOrders()
		CloseExpiredSubscriptionWxpayOrders()
	}
}
