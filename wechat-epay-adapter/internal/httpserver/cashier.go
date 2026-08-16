package httpserver

import (
	"encoding/base64"
	"html/template"
	"net/http"
	"regexp"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/gin-gonic/gin"
	qrcode "github.com/skip2/go-qrcode"
)

const cashierPageTemplate = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#07c160">
  <title>微信支付</title>
  <style nonce="{{.CSPNonce}}">
    :root { color: #182230; background: #f4f7fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at top, #e4f7eb 0, #f4f7fb 42rem); }
    main { width: min(100%, 420px); overflow: hidden; border: 1px solid #dfe6ee; border-radius: 16px; background: #fff; box-shadow: 0 20px 56px rgba(21, 42, 63, .12); }
    .header { padding: 24px 28px 20px; text-align: center; background: linear-gradient(135deg, #07c160, #2acb76); color: #fff; }
    .brand { margin: 0 0 8px; font-size: 15px; font-weight: 600; letter-spacing: .04em; }
    h1 { margin: 0; font-size: 22px; font-weight: 650; overflow-wrap: anywhere; }
    .content { display: grid; justify-items: center; gap: 18px; padding: 28px; text-align: center; }
    .amount-label { margin: 0 0 4px; color: #687789; font-size: 14px; }
    .amount { margin: 0; color: #142033; font-size: 36px; font-weight: 700; line-height: 1.1; }
    .qr-frame { display: grid; place-items: center; width: 232px; height: 232px; padding: 10px; border: 1px solid #e0e7ef; border-radius: 12px; background: #fff; }
    #payment-code { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
    .hint { margin: 0; color: #526173; font-size: 14px; line-height: 1.6; }
    .status { display: inline-flex; align-items: center; gap: 8px; min-height: 32px; margin: 0; padding: 6px 11px; border-radius: 999px; background: #eff4f8; color: #526173; font-size: 13px; font-weight: 600; }
    .status::before { width: 8px; height: 8px; border-radius: 50%; background: currentColor; content: ""; }
    .status[data-state="PAYABLE"] { background: #eaf8ef; color: #16834a; }
    .status[data-state="PAID_PENDING_NOTIFY"] { background: #fff7e7; color: #a56500; }
    .status[data-state="NOTIFIED"] { background: #eaf8ef; color: #16834a; }
    .status[data-state="EXPIRED"], .status[data-state="CREATE_FAILED"], .status[data-state="MANUAL_REVIEW"] { background: #fff0f0; color: #bb3030; }
    .footer { margin: 0; padding: 0 28px 24px; color: #8b98a8; font-size: 12px; line-height: 1.6; text-align: center; }
    @media (max-width: 480px) { body { padding: 16px; } .header { padding: 20px; } .content { padding: 24px 20px; } .footer { padding: 0 20px 20px; } }
  </style>
</head>
<body>
  <main>
    <section class="header">
      <p class="brand">WECHAT PAY</p>
      <h1>{{.Subject}}</h1>
    </section>
    <section class="content">
      <div>
        <p class="amount-label">应付金额</p>
        <p class="amount">¥{{.Amount}}</p>
      </div>
      {{if .QRCode}}<div class="qr-frame"><img id="payment-code" src="{{.QRCode}}" alt="微信支付二维码"></div>{{end}}
      <p class="hint" id="hint">请使用微信扫码完成支付</p>
      <p class="status" id="status" data-state="{{.Status}}" role="status" aria-live="polite">{{.Status}}</p>
    </section>
    <p class="footer">支付成功后将自动跳转并更新账户余额</p>
  </main>
  <script nonce="{{.CSPNonce}}">
    (function () {
      var endpoint = {{.StatusEndpoint}};
      var statusElement = document.getElementById("status");
      var hintElement = document.getElementById("hint");
      var intervalId;
      var inFlight = false;
      var statusText = {
        PAYABLE: "等待微信支付",
        PAID_PENDING_NOTIFY: "支付成功，正在更新余额",
        NOTIFIED: "充值成功，正在跳转",
        EXPIRED: "订单已过期",
        CREATE_FAILED: "订单创建失败",
        MANUAL_REVIEW: "订单需要人工处理"
      };

      function updateStatus(status) {
        statusElement.dataset.state = status;
        statusElement.textContent = statusText[status] || status;
        if (status === "PAID_PENDING_NOTIFY") hintElement.textContent = "支付已完成，请稍候确认充值结果";
        if (status === "NOTIFIED") hintElement.textContent = "充值已到账，正在返回钱包";
        if (status === "EXPIRED") hintElement.textContent = "请返回后重新发起支付";
      }

      function checkStatus() {
        if (inFlight) return;
        inFlight = true;
        fetch(endpoint, { cache: "no-store", credentials: "same-origin" })
          .then(function (response) { return response.ok ? response.json() : null; })
          .then(function (payment) {
            if (!payment) return;
            updateStatus(payment.status);
            if (payment.redirect_allowed && payment.return_url) {
              window.clearInterval(intervalId);
              window.setTimeout(function () { window.location.assign(payment.return_url); }, 700);
            }
          })
          .catch(function () {})
          .finally(function () { inFlight = false; });
      }

      updateStatus({{.Status}});
      checkStatus();
      intervalId = window.setInterval(checkStatus, 2000);
    }());
  </script>
</body>
</html>`

var cashierTokenPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

type CashierHandler struct {
	store           *store.Store
	returnURLPolicy *order.ReturnURLPolicy
	now             func() time.Time
}

func NewCashierHandler(database *store.Store, returnURLPolicy *order.ReturnURLPolicy) *CashierHandler {
	return &CashierHandler{store: database, returnURLPolicy: returnURLPolicy, now: func() time.Time { return time.Now().UTC() }}
}

func (handler *CashierHandler) Show(context *gin.Context) {
	paymentOrder, ok := handler.findOrder(context)
	if !ok {
		return
	}
	status := handler.displayStatus(paymentOrder)
	page := struct {
		Subject        string
		Amount         string
		Status         order.Status
		QRCode         template.URL
		StatusEndpoint string
		CSPNonce       string
	}{
		Subject: paymentOrder.Subject, Amount: paymentOrder.AmountText, Status: status,
		StatusEndpoint: "/api/v1/cashier/" + context.Param("access_token") + "/status",
		CSPNonce:       context.GetString(CSPNonceContextKey),
	}
	if status == order.StatusPayable && paymentOrder.WechatCodeURL != nil {
		png, err := qrcode.Encode(*paymentOrder.WechatCodeURL, qrcode.Medium, 256)
		if err != nil {
			AbortErrorPage(context, http.StatusServiceUnavailable)
			return
		}
		page.QRCode = template.URL("data:image/png;base64," + base64.StdEncoding.EncodeToString(png))
	}
	parsed, err := template.New("cashier").Parse(cashierPageTemplate)
	if err != nil {
		AbortErrorPage(context, http.StatusInternalServerError)
		return
	}
	context.Header("Cache-Control", "no-store")
	context.Status(http.StatusOK)
	_ = parsed.Execute(context.Writer, page)
}

func (handler *CashierHandler) Status(context *gin.Context) {
	paymentOrder, ok := handler.findOrder(context)
	if !ok {
		return
	}
	status := handler.displayStatus(paymentOrder)
	response := CashierStatusResponse{
		MerchantOrder: paymentOrder.OutTradeNo, Subject: paymentOrder.Subject, Amount: paymentOrder.AmountText,
		Status: string(status), ExpiresAt: paymentOrder.ExpiresAt, PaidAt: paymentOrder.PaidAt, NotifiedAt: paymentOrder.NotifiedAt,
	}
	if status == order.StatusNotified && paymentOrder.ReturnURL != nil {
		validated, err := handler.returnURLPolicy.ValidateStored(*paymentOrder.ReturnURL)
		if err == nil {
			returnURL := validated.String()
			response.RedirectAllowed = true
			response.ReturnURL = &returnURL
		}
	}
	context.Header("Cache-Control", "no-store")
	context.JSON(http.StatusOK, response)
}

func (handler *CashierHandler) findOrder(context *gin.Context) (store.PaymentOrder, bool) {
	token := context.Param("access_token")
	if !cashierTokenPattern.MatchString(token) {
		AbortErrorPage(context, http.StatusNotFound)
		return store.PaymentOrder{}, false
	}
	paymentOrder, err := handler.store.FindPaymentOrderByCashierTokenHash(order.HashCashierToken(token))
	if err != nil {
		AbortErrorPage(context, http.StatusNotFound)
		return store.PaymentOrder{}, false
	}
	return paymentOrder, true
}

func (handler *CashierHandler) displayStatus(paymentOrder store.PaymentOrder) order.Status {
	if paymentOrder.Status == order.StatusPayable && !handler.now().Before(paymentOrder.ExpiresAt) {
		return order.StatusExpired
	}
	return paymentOrder.Status
}
