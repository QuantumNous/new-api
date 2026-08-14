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

const cashierPageTemplate = `<!doctype html><html><head><meta charset="utf-8"><title>Payment</title></head><body><main><h1>{{.Subject}}</h1><p>{{.Amount}}</p><p id="status">{{.Status}}</p>{{if .QRCode}}<img id="payment-code" src="{{.QRCode}}" alt="Payment QR code">{{end}}</main><script>(function(){var endpoint={{printf "%q" .StatusEndpoint}};var redirect="";setInterval(function(){fetch(endpoint,{cache:"no-store",credentials:"same-origin"}).then(function(r){if(!r.ok){return;}return r.json();}).then(function(s){if(!s){return;}document.getElementById("status").textContent=s.status;if(s.redirect_allowed&&s.return_url){location.assign(s.return_url);}});},3000);}());</script></body></html>`

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
	}{
		Subject: paymentOrder.Subject, Amount: paymentOrder.AmountText, Status: status,
		StatusEndpoint: "/api/v1/cashier/" + context.Param("access_token") + "/status",
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
