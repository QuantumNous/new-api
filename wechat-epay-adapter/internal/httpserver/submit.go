package httpserver

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/epay"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const cashierCookiePrefix = "epay_cashier_"

type SubmitHandler struct {
	store           *store.Store
	partnerID       string
	key             string
	notifyURL       string
	maximumAmount   string
	returnURLPolicy *order.ReturnURLPolicy
	nativeOrders    *order.NativeOrderService
}

func NewSubmitHandler(store *store.Store, appConfig config.Config, returnURLPolicy *order.ReturnURLPolicy, nativeOrders ...*order.NativeOrderService) *SubmitHandler {
	handler := &SubmitHandler{
		store: store, partnerID: appConfig.EpayPartnerID, key: appConfig.EpayKey,
		notifyURL: appConfig.NewAPINotifyURL, maximumAmount: appConfig.MaxOrderAmountYuan, returnURLPolicy: returnURLPolicy,
	}
	if len(nativeOrders) > 0 {
		handler.nativeOrders = nativeOrders[0]
	}
	return handler
}

func (handler *SubmitHandler) Handle(context *gin.Context) {
	if err := context.Request.ParseForm(); err != nil {
		AbortErrorPage(context, http.StatusBadRequest)
		return
	}
	if len(context.Request.PostForm) > 10 || hasDuplicateField(context.Request.PostForm) {
		AbortErrorPage(context, http.StatusBadRequest)
		return
	}
	params := make(map[string]string, len(context.Request.PostForm))
	for name, values := range context.Request.PostForm {
		params[name] = values[0]
	}
	request := SubmitRequest{
		PartnerID: params["pid"], PaymentType: params["type"], MerchantOrder: params["out_trade_no"],
		NotifyURL: params["notify_url"], ReturnURL: params["return_url"], Subject: params["name"], Money: params["money"],
		Device: params["device"], SignType: params["sign_type"], Signature: params["sign"],
	}
	if request.PartnerID == "" || request.PaymentType == "" || request.MerchantOrder == "" || request.NotifyURL == "" || request.ReturnURL == "" || request.Subject == "" || request.Money == "" || request.SignType == "" || request.Signature == "" {
		AbortErrorPage(context, http.StatusBadRequest)
		return
	}
	if request.PartnerID != handler.partnerID || request.PaymentType != epay.PaymentTypeWechat || request.SignType != epay.SignTypeMD5 || !epay.Verify(params, handler.key) {
		AbortErrorPage(context, http.StatusForbidden)
		return
	}
	if err := order.ValidateMerchantOrder(request.MerchantOrder); err != nil || len(request.Subject) > 128 || len(request.NotifyURL) > 2048 || len(request.ReturnURL) > 2048 {
		AbortErrorPage(context, http.StatusBadRequest)
		return
	}
	amountFen, amountText, err := order.ParseAmountFen(request.Money, handler.maximumAmount)
	if err != nil || !order.NotifyURLMatches(request.NotifyURL, handler.notifyURL) {
		AbortErrorPage(context, http.StatusBadRequest)
		return
	}
	returnURL, err := handler.returnURLPolicy.Validate(context.Request.Context(), request.ReturnURL)
	if err != nil {
		AbortErrorPage(context, http.StatusBadRequest)
		return
	}
	fingerprint := order.Fingerprint(request.PartnerID, request.PaymentType, request.MerchantOrder, request.Subject, amountText, request.NotifyURL, returnURL.String())
	requestID, _ := context.Get(RequestIDHeader)

	token, err := newCashierToken()
	if err != nil {
		AbortErrorPage(context, http.StatusServiceUnavailable)
		return
	}
	result, err := handler.store.CreatePaymentOrder(store.CreatePaymentOrderInput{
		ID: uuid.NewString(), OutTradeNo: request.MerchantOrder, GatewayTradeNo: "GW" + strings.ReplaceAll(uuid.NewString(), "-", ""),
		RequestFingerprint: fingerprint, EpayPID: request.PartnerID, PaymentType: request.PaymentType, Subject: request.Subject,
		AmountText: amountText, AmountFen: amountFen, NotifyURL: request.NotifyURL, ReturnURL: returnURL.String(),
		CashierTokenHash: order.HashCashierToken(token), ExpiresAt: time.Now().UTC().Add(order.OrderTTL), RequestID: requestID.(string),
	})
	if err != nil {
		AbortErrorPage(context, http.StatusServiceUnavailable)
		return
	}
	if result.Conflict {
		AbortErrorPage(context, http.StatusConflict)
		return
	}
	if result.Existing {
		cookie, cookieErr := context.Request.Cookie(cashierCookieName(result.Order.ID))
		if cookieErr != nil || order.HashCashierToken(cookie.Value) != result.Order.CashierTokenHash {
			AbortErrorPage(context, http.StatusConflict)
			return
		}
		token = cookie.Value
	} else {
		context.SetCookie(cashierCookieName(result.Order.ID), token, int(order.OrderTTL.Seconds()), "/", "", true, true)
		if handler.nativeOrders != nil {
			if err := handler.nativeOrders.Create(context.Request.Context(), order.NativeOrderRecord{
				ID: result.Order.ID, OutTradeNo: result.Order.OutTradeNo, Subject: result.Order.Subject,
				AmountFen: result.Order.AmountFen, NotifyURL: result.Order.NotifyURL, ExpiresAt: result.Order.ExpiresAt,
				Status: result.Order.Status, Version: result.Order.Version, CreatedAt: result.Order.CreatedAt,
			}); err != nil {
				AbortErrorPage(context, http.StatusServiceUnavailable)
				return
			}
		}
	}
	context.Redirect(http.StatusSeeOther, "/cashier/"+token)
}

func hasDuplicateField(form map[string][]string) bool {
	for _, values := range form {
		if len(values) != 1 {
			return true
		}
	}
	return false
}

func newCashierToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func cashierCookieName(orderID string) string {
	return cashierCookiePrefix + orderID
}
