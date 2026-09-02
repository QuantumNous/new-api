package controller

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func StripeBrowserReturn(c *gin.Context) {
	setTopUpReturnNoStore(c)
	if !isMainDomainCallback(c) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	tradeNo := strings.TrimSpace(c.Query("trade_no"))
	result := strings.TrimSpace(c.Query("result"))
	if tradeNo == "" || (result != "success" && result != "cancel") {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.PaymentProvider != model.PaymentProviderStripe {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	targetPath := "/wallet"
	if result == "success" {
		targetPath = "/usage-logs"
	}
	c.Redirect(http.StatusFound, paymentReturnURLForTopUp(topUp, targetPath))
}

func EpayBrowserReturn(c *gin.Context) {
	setTopUpReturnNoStore(c)
	if !isMainDomainCallback(c) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	params := make(map[string]string, len(c.Request.URL.Query()))
	for key, values := range c.Request.URL.Query() {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}
	client := GetEpayClient()
	if client == nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	verified, err := client.Verify(params)
	if err != nil || !verified.VerifyStatus || strings.TrimSpace(verified.ServiceTradeNo) == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	topUp := model.GetTopUpByTradeNo(verified.ServiceTradeNo)
	if topUp == nil || topUp.PaymentProvider != model.PaymentProviderEpay {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	targetPath := "/wallet"
	if verified.TradeStatus == epay.StatusTradeSuccess {
		LockOrder(verified.ServiceTradeNo)
		_, err = model.RechargeEpay(verified.ServiceTradeNo, verified.Type, c.ClientIP())
		UnlockOrder(verified.ServiceTradeNo)
		if err != nil {
			c.AbortWithStatus(http.StatusServiceUnavailable)
			return
		}
		targetPath = "/usage-logs"
	}
	c.Redirect(http.StatusFound, paymentReturnURLForTopUp(topUp, targetPath))
}

func stripeCheckoutReturnURLs(referenceID, originHost, successURL, cancelURL string) (string, string) {
	if strings.TrimSpace(originHost) == "" {
		return successURL, cancelURL
	}
	returnURL := func(result string) string {
		query := url.Values{"result": {result}, "trade_no": {referenceID}}
		return fixedPaymentReturnPath("/api/stripe/return?") + query.Encode()
	}
	return returnURL("success"), returnURL("cancel")
}

func epayBrowserReturnURL() string {
	return fixedPaymentReturnPath("/api/user/epay/return")
}

func epayNotifyURL() string {
	if common.CustomDomainEnabled {
		return fixedPaymentReturnPath("/api/user/epay/notify")
	}
	return strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/user/epay/notify"
}

func isMainDomainCallback(c *gin.Context) bool {
	context, found := middleware.GetCustomDomainContext(c)
	return !found || context.Kind == service.CustomDomainKindMain
}

func setTopUpReturnNoStore(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Header("Referrer-Policy", "no-referrer")
}
