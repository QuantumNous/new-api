package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const (
	partnerServerAccountHourlyOrderLimit = 20
	partnerServerAccountPendingLimit     = 5
	partnerServerClientHourlyOrderLimit  = 2000
	partnerServerMapiResponseLimit       = 64 << 10
	// partnerServerCheckoutClaimSeconds outlasts the gateway timeout, so a
	// claim is only taken over once its holder has certainly given up.
	partnerServerCheckoutClaimSeconds = 15
)

// partnerServerMapiHTTPClient calls the Epay gateway's API ordering endpoint.
// Tests point it at a local TLS server.
var partnerServerMapiHTTPClient = &http.Client{Timeout: 10 * time.Second}

var errPartnerServerPaymentInsecure = errors.New("the payment gateway address is not https")

// partnerServerCheckout is what the payer needs to pay: a QR code payload to
// render, or failing that a payment URL.
type partnerServerCheckout struct {
	QRCode string
	PayURL string
}

// partnerServerEpayAPIPurchase places the order with the Epay gateway's API
// (mapi.php) so the partner can show the payment QR code itself. It never
// logs the gateway response; the QR code and payment URL are payment links.
func partnerServerEpayAPIPurchase(topUp *model.TopUp, requestAmount int64, clientIP string) (*partnerServerCheckout, error) {
	base, err := url.Parse(strings.TrimSpace(operation_setting.PayAddress))
	if err != nil || !strings.EqualFold(base.Scheme, "https") || base.Host == "" {
		return nil, errPartnerServerPaymentInsecure
	}
	base.Path = path.Join(base.Path, "mapi.php")
	params, err := epay.GenerateParamsWithError(map[string]string{
		"pid":          operation_setting.EpayId,
		"type":         topUp.PaymentMethod,
		"out_trade_no": topUp.TradeNo,
		"notify_url":   epayNotifyURL(),
		"name":         fmt.Sprintf("TUC%d", requestAmount),
		"money":        strconv.FormatFloat(topUp.Money, 'f', 2, 64),
		"clientip":     clientIP,
		"device":       "pc",
	}, operation_setting.EpayKey)
	if err != nil {
		return nil, err
	}
	form := url.Values{}
	for key, value := range params {
		form.Set(key, value)
	}
	resp, err := partnerServerMapiHTTPClient.PostForm(base.String(), form)
	if err != nil {
		return nil, fmt.Errorf("payment gateway request failed: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, partnerServerMapiResponseLimit))
	if err != nil {
		return nil, errors.New("payment gateway response could not be read")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("payment gateway returned HTTP %d", resp.StatusCode)
	}
	var result struct {
		Code   json.RawMessage `json:"code"`
		QRCode string          `json:"qrcode"`
		PayURL string          `json:"payurl"`
	}
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, errors.New("payment gateway response is not JSON")
	}
	if code := strings.Trim(string(result.Code), `"`); code != "1" {
		return nil, fmt.Errorf("payment gateway refused the order (code %s)", code)
	}
	if result.QRCode == "" && result.PayURL == "" {
		return nil, errors.New("payment gateway returned no QR code or payment URL")
	}
	return &partnerServerCheckout{QRCode: result.QRCode, PayURL: result.PayURL}, nil
}

type partnerServerOrderResponse struct {
	partnerPaymentOrderResponse
	ExternalUserID string `json:"external_user_id"`
	QRCode         string `json:"qr_code,omitempty"`
	PayURL         string `json:"pay_url,omitempty"`
}

func partnerServerOrderView(order *model.PartnerAccountPaymentOrder, topUp *model.TopUp, externalUserID string) partnerServerOrderResponse {
	view := partnerServerOrderResponse{partnerPaymentOrderResponse: partnerPaymentOrderView(topUp, order.RequestedAmount), ExternalUserID: externalUserID}
	if topUp.Status == common.TopUpStatusPending {
		view.QRCode = order.QRCode
		view.PayURL = order.PayURL
	}
	return view
}

func PartnerServerPaymentOptions(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) || rejectPartnerIntegrationQuery(c) {
		return
	}
	principal := middleware.PartnerServerPrincipalFrom(c)
	c.JSON(http.StatusOK, buildPartnerPaymentOptions(principal.Partner.AccountGroup))
}

func partnerServerPaymentUnavailable() *service.PartnerOAuthError {
	return &service.PartnerOAuthError{Status: http.StatusServiceUnavailable, Code: "payment_unavailable", Description: "payment is temporarily unavailable"}
}

// completePartnerServerCheckout obtains the order's QR code from the gateway
// and stores it so replays return it without ordering again.
func completePartnerServerCheckout(c *gin.Context, order *model.PartnerAccountPaymentOrder, topUp *model.TopUp, clientIP string) error {
	checkout, err := partnerServerEpayAPIPurchase(topUp, order.RequestedAmount, clientIP)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("partner server payment checkout failed (request_id=%s) trade_no=%s: %s", c.GetString(common.RequestIdKey), topUp.TradeNo, err.Error()))
		if releaseErr := model.ReleasePartnerAccountPaymentCheckout(order.Id); releaseErr != nil {
			logger.LogError(c.Request.Context(), common.LogText("partner server payment claim release failed (request_id=%s) trade_no=%s: %s", c.GetString(common.RequestIdKey), topUp.TradeNo, releaseErr.Error()))
		}
		return partnerServerPaymentUnavailable()
	}
	if err := model.SetPartnerAccountPaymentCheckout(order.Id, checkout.QRCode, checkout.PayURL); err != nil {
		return err
	}
	order.QRCode, order.PayURL = checkout.QRCode, checkout.PayURL
	return nil
}

// replayPartnerServerOrder answers a repeated Idempotency-Key. A pending order
// that never got its QR code (the gateway call failed) is retried here.
func replayPartnerServerOrder(c *gin.Context, requestHash, externalUserID, clientIP string, order *model.PartnerAccountPaymentOrder, topUp *model.TopUp) {
	if order.RequestHash != requestHash {
		writePartnerServerError(c, &service.PartnerOAuthError{Status: http.StatusConflict, Code: "idempotency_conflict", Description: "the Idempotency-Key was already used with a different request"})
		return
	}
	if topUp.Status == common.TopUpStatusPending {
		// The notify callback refuses payments for a method that was switched off.
		if !partnerEpayMethodAvailable(topUp.PaymentMethod) {
			writePartnerServerError(c, partnerServerPaymentUnavailable())
			return
		}
		if order.QRCode == "" && order.PayURL == "" {
			// Only one request may contact the gateway for an order; another
			// one still waiting for it means this replay retries shortly.
			now := time.Now().Unix()
			claimed, err := model.ClaimPartnerAccountPaymentCheckout(order.Id, now, now-partnerServerCheckoutClaimSeconds)
			if err != nil {
				writePartnerServerError(c, err)
				return
			}
			if !claimed {
				c.Header("Retry-After", "3")
				writePartnerServerError(c, &service.PartnerOAuthError{Status: http.StatusServiceUnavailable, Code: "payment_unavailable", Description: "the payment is being prepared, please retry shortly"})
				return
			}
			if err := completePartnerServerCheckout(c, order, topUp, clientIP); err != nil {
				writePartnerServerError(c, err)
				return
			}
		}
	}
	c.JSON(http.StatusOK, partnerServerOrderView(order, topUp, externalUserID))
}

func PartnerServerCreatePaymentOrder(c *gin.Context) {
	partner, externalUserID, ok := partnerServerAccountRequest(c)
	if !ok {
		return
	}
	keyHash, err := service.ValidatePartnerOAuthIdempotencyKey(c.GetHeader("Idempotency-Key"))
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	fields, err := readPartnerServerJSON(c, "amount", "payment_method", "client_ip")
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	invalid := func(code, description string) {
		writePartnerServerError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: code, Description: description})
	}
	var amount int64
	var method, clientIP string
	if raw, present := fields["amount"]; !present || common.Unmarshal(raw, &amount) != nil {
		invalid("invalid_request", `field "amount" must be an integer`)
		return
	}
	if raw, present := fields["payment_method"]; !present || common.Unmarshal(raw, &method) != nil || method == "" {
		invalid("invalid_request", `field "payment_method" is required`)
		return
	}
	if raw, present := fields["client_ip"]; present {
		if common.Unmarshal(raw, &clientIP) != nil || net.ParseIP(clientIP) == nil {
			invalid("invalid_request", `field "client_ip" must be an IP address`)
			return
		}
	}
	if clientIP == "" {
		clientIP = c.ClientIP()
	}
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s\n%d\n%s", externalUserID, amount, method)))
	requestHash := hex.EncodeToString(sum[:])

	if order, topUp, err := model.FindPartnerAccountPaymentOrderByIdempotency(partner.ClientId, keyHash); err == nil {
		replayPartnerServerOrder(c, requestHash, externalUserID, clientIP, order, topUp)
		return
	} else if !errors.Is(err, model.ErrPartnerAccountPaymentOrderNotFound) {
		writePartnerServerError(c, err)
		return
	}

	if !isEpayTopUpEnabled() || GetEpayClient() == nil {
		writePartnerServerError(c, &service.PartnerOAuthError{Status: http.StatusServiceUnavailable, Code: "payment_unavailable", Description: "payment is not available"})
		return
	}
	if !partnerEpayMethodAvailable(method) {
		invalid("invalid_payment_method", "payment_method is not available")
		return
	}
	quote, err := quotePartnerTopUp(amount)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	now := time.Now()
	created, err := model.CreatePartnerAccountPaymentOrder(model.PartnerAccountPaymentOrderInput{
		Owner:              model.PartnerAccountOwner{ClientId: partner.ClientId, ExternalUserId: externalUserID, DisplayName: partner.Name},
		IdempotencyKeyHash: keyHash,
		RequestHash:        requestHash,
		RequestedAmount:    amount,
		StoredAmount:       quote.StoredAmount,
		// Priced for the sub-account user's own group, read in the order
		// transaction, not the partner's current default group.
		Price: func(group string) (float64, error) {
			return partnerTopUpPayMoney(amount, group)
		},
		PaymentMethod:   method,
		PaymentProvider: model.PaymentProviderEpay,
		CreditedQuota:   quote.CreditedQuota,
		BaseQuota:       quote.BaseQuota,
		Metadata:        onlineTopUpCashbackMetadata(c, quote.BaseQuota, amount, false),
	}, model.PartnerAccountPaymentLimits{
		AccountRecentSince:  now.Add(-time.Hour).Unix(),
		AccountMaxRecent:    partnerServerAccountHourlyOrderLimit,
		AccountPendingSince: now.Add(-partnerPaymentPendingWindow).Unix(),
		AccountMaxPending:   partnerServerAccountPendingLimit,
		ClientRecentSince:   now.Add(-time.Hour).Unix(),
		ClientMaxRecent:     partnerServerClientHourlyOrderLimit,
	})
	switch {
	case errors.Is(err, model.ErrPartnerAccountPaymentRateLimited):
		c.Header("Retry-After", "60")
		writePartnerServerError(c, &service.PartnerOAuthError{Status: http.StatusTooManyRequests, Code: "rate_limited", Description: "too many payment orders, please retry later"})
		return
	case errors.Is(err, model.ErrTopUpQuotaLimitExceeded):
		invalid("invalid_amount", "the account balance would exceed the top-up limit")
		return
	case errors.Is(err, model.ErrPartnerAccountPaymentIdempotencyRace):
		existing, existingTopUp, findErr := model.FindPartnerAccountPaymentOrderByIdempotency(partner.ClientId, keyHash)
		if findErr != nil {
			writePartnerServerError(c, findErr)
			return
		}
		replayPartnerServerOrder(c, requestHash, externalUserID, clientIP, existing, existingTopUp)
		return
	case err != nil:
		writePartnerServerError(c, err)
		return
	}
	if created.AccountCreated {
		recordPartnerAccountLog(c, "partner_account.create", partner, created.TopUp.UserId, "", http.StatusCreated)
	}
	model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: "partner_account.payment_order_create", Success: true,
		ClientId: partner.ClientId, TargetUserId: created.TopUp.UserId, Status: http.StatusCreated})
	// The order was created with its gateway call claimed by this request.
	if err := completePartnerServerCheckout(c, created.Order, created.TopUp, clientIP); err != nil {
		writePartnerServerError(c, err)
		return
	}
	c.JSON(http.StatusCreated, partnerServerOrderView(created.Order, created.TopUp, externalUserID))
}

func PartnerServerGetPaymentOrder(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) || rejectPartnerIntegrationQuery(c) {
		return
	}
	principal := middleware.PartnerServerPrincipalFrom(c)
	orderID := c.Param("order_id")
	notFound := &service.PartnerOAuthError{Status: http.StatusNotFound, Code: "order_not_found", Description: "the payment order was not found"}
	if orderID == "" || len(orderID) > 255 {
		writePartnerServerError(c, notFound)
		return
	}
	order, topUp, err := model.GetPartnerAccountPaymentOrder(principal.Partner.ClientId, orderID)
	if errors.Is(err, model.ErrPartnerAccountPaymentOrderNotFound) {
		writePartnerServerError(c, notFound)
		return
	}
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	account, err := model.GetPartnerAccountByUserID(order.UserId)
	if err != nil {
		writePartnerServerError(c, err)
		return
	}
	view := partnerServerOrderView(order, topUp, account.ExternalUserId)
	// Polling only reports status; the checkout is returned when ordering.
	view.QRCode, view.PayURL = "", ""
	c.JSON(http.StatusOK, view)
}
