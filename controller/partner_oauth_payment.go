package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
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
	"github.com/shopspring/decimal"
)

const (
	partnerPaymentHourlyOrderLimit = 20
	partnerPaymentPendingLimit     = 5
	partnerPaymentPendingWindow    = 30 * time.Minute
)

type partnerPaymentMethod struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type partnerPaymentAmountOption struct {
	Amount   int64  `json:"amount"`
	PayMoney string `json:"pay_money"`
}

type partnerPaymentOptionsResponse struct {
	Available       bool                         `json:"available"`
	Currency        string                       `json:"currency"`
	AmountUnitQuota string                       `json:"amount_unit_quota"`
	PayCurrency     string                       `json:"pay_currency"`
	MinAmount       int64                        `json:"min_amount"`
	MaxAmount       int64                        `json:"max_amount"`
	AmountOptions   []partnerPaymentAmountOption `json:"amount_options"`
	Methods         []partnerPaymentMethod       `json:"methods"`
}

type partnerPaymentOrderResponse struct {
	OrderID       string `json:"order_id"`
	Status        string `json:"status"`
	Amount        int64  `json:"amount"`
	Currency      string `json:"currency"`
	PayMoney      string `json:"pay_money"`
	PayCurrency   string `json:"pay_currency"`
	PaymentMethod string `json:"payment_method"`
	CheckoutURL   string `json:"checkout_url,omitempty"`
	CreatedAt     string `json:"created_at"`
	PaidAt        string `json:"paid_at,omitempty"`
}

type partnerPaymentOrderRequest struct {
	Amount        int64
	PaymentMethod string
	ReturnURL     string
}

func rejectPartnerIntegrationQuery(c *gin.Context) bool {
	if c.Request.URL.RawQuery == "" {
		return false
	}
	writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: "query parameters are not allowed"})
	return true
}

// partnerEpayMethods lists the configured Epay channels. Other gateways may
// share the pay method list but are not offered to partners yet.
func partnerEpayMethods() []partnerPaymentMethod {
	methods := make([]partnerPaymentMethod, 0, len(operation_setting.PayMethods))
	for _, method := range operation_setting.PayMethods {
		switch method["type"] {
		case "", model.PaymentMethodStripe, model.PaymentMethodCreem, model.PaymentMethodWaffo, model.PaymentMethodWaffoPancake:
			continue
		}
		methods = append(methods, partnerPaymentMethod{ID: method["type"], Name: method["name"]})
	}
	return methods
}

// partnerEpayMethodAvailable reports whether new payments can start with this
// Epay method right now; settlement rejects payments made while it is off.
func partnerEpayMethodAvailable(method string) bool {
	if !isEpayTopUpEnabled() || GetEpayClient() == nil {
		return false
	}
	return slices.ContainsFunc(partnerEpayMethods(), func(item partnerPaymentMethod) bool {
		return item.ID == method
	})
}

func partnerPaymentCurrency() string {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return "TOKENS"
	}
	return "USD"
}

func partnerPaymentAmountUnitQuota() string {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return "1"
	}
	return decimal.NewFromFloat(common.QuotaPerUnit).String()
}

func PartnerOAuthBalance(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) || rejectPartnerIntegrationQuery(c) {
		return
	}
	balance, err := service.BuildPartnerOAuthBalance(middleware.PartnerOAuthPrincipal(c))
	if err != nil {
		writePartnerIntegrationAPIError(c, err)
		return
	}
	c.JSON(http.StatusOK, balance)
}

func PartnerOAuthPaymentOptions(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) || rejectPartnerIntegrationQuery(c) {
		return
	}
	principal := middleware.PartnerOAuthPrincipal(c)
	c.JSON(http.StatusOK, buildPartnerPaymentOptions(principal.User.Group))
}

// buildPartnerPaymentOptions lists the Epay methods and preset amounts a
// partner may offer, priced for the payer's user group.
func buildPartnerPaymentOptions(group string) partnerPaymentOptionsResponse {
	response := partnerPaymentOptionsResponse{
		Currency:        partnerPaymentCurrency(),
		AmountUnitQuota: partnerPaymentAmountUnitQuota(),
		PayCurrency:     "CNY",
		MinAmount:       getMinTopup(),
		MaxAmount:       getMaxTopUpAmount(),
		AmountOptions:   []partnerPaymentAmountOption{},
		Methods:         []partnerPaymentMethod{},
	}
	if isEpayTopUpEnabled() {
		response.Methods = partnerEpayMethods()
	}
	response.Available = len(response.Methods) > 0
	if response.Available {
		for _, amount := range operation_setting.GetPaymentSetting().AmountOptions {
			if int64(amount) < response.MinAmount || int64(amount) > response.MaxAmount {
				continue
			}
			response.AmountOptions = append(response.AmountOptions, partnerPaymentAmountOption{
				Amount:   int64(amount),
				PayMoney: strconv.FormatFloat(getPayMoney(int64(amount), group), 'f', 2, 64),
			})
		}
	}
	return response
}

func parsePartnerPaymentOrderRequest(c *gin.Context) (*partnerPaymentOrderRequest, error) {
	invalid := func(description string) error {
		return &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: description}
	}
	media := strings.ToLower(strings.TrimSpace(strings.Split(c.GetHeader("Content-Type"), ";")[0]))
	if media != "application/json" {
		return nil, &service.PartnerOAuthError{Status: http.StatusUnsupportedMediaType, Code: "unsupported_media_type", Description: "content type must be application/json"}
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.PartnerOAuthJSONLimit)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, invalid("request body is invalid")
	}
	var fields map[string]json.RawMessage
	if err := common.Unmarshal(body, &fields); err != nil || fields == nil {
		return nil, invalid("request body must be a JSON object")
	}
	var req partnerPaymentOrderRequest
	for name, value := range fields {
		switch name {
		case "amount":
			err = common.Unmarshal(value, &req.Amount)
		case "payment_method":
			err = common.Unmarshal(value, &req.PaymentMethod)
		case "return_url":
			err = common.Unmarshal(value, &req.ReturnURL)
		default:
			return nil, invalid(fmt.Sprintf("unknown field %q", name))
		}
		if err != nil {
			return nil, invalid(fmt.Sprintf("field %q is invalid", name))
		}
	}
	if _, ok := fields["amount"]; !ok {
		return nil, invalid(`field "amount" is required`)
	}
	if req.PaymentMethod == "" {
		return nil, invalid(`field "payment_method" is required`)
	}
	return &req, nil
}

func partnerPaymentRequestHash(req *partnerPaymentOrderRequest) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%d\n%s\n%s", req.Amount, req.PaymentMethod, req.ReturnURL)))
	return hex.EncodeToString(sum[:])
}

// partnerEpayCheckout signs the Epay page-jump request as a GET URL. Signing is
// local and deterministic, so an idempotent replay rebuilds the same URL.
func partnerEpayCheckout(topUp *model.TopUp, requestAmount int64) (string, error) {
	client := GetEpayClient()
	if client == nil {
		return "", errors.New("epay client is not configured")
	}
	returnURL, err := url.Parse(epayBrowserReturnURL())
	if err != nil {
		return "", err
	}
	notifyURL, err := url.Parse(epayNotifyURL())
	if err != nil {
		return "", err
	}
	uri, params, err := client.Purchase(&epay.PurchaseArgs{
		Type:           topUp.PaymentMethod,
		ServiceTradeNo: topUp.TradeNo,
		Name:           fmt.Sprintf("TUC%d", requestAmount),
		Money:          strconv.FormatFloat(topUp.Money, 'f', 2, 64),
		Device:         epay.PC,
		NotifyUrl:      notifyURL,
		ReturnUrl:      returnURL,
	})
	if err != nil {
		return "", err
	}
	query := url.Values{}
	for key, value := range params {
		query.Set(key, value)
	}
	return uri + "?" + query.Encode(), nil
}

func partnerPaymentOrderView(topUp *model.TopUp, requestAmount int64) partnerPaymentOrderResponse {
	view := partnerPaymentOrderResponse{
		OrderID:       topUp.TradeNo,
		Status:        topUp.Status,
		Amount:        requestAmount,
		Currency:      partnerPaymentCurrency(),
		PayMoney:      strconv.FormatFloat(topUp.Money, 'f', 2, 64),
		PayCurrency:   "CNY",
		PaymentMethod: topUp.PaymentMethod,
		CreatedAt:     time.Unix(topUp.CreateTime, 0).UTC().Format(time.RFC3339),
	}
	if topUp.Status == common.TopUpStatusSuccess && topUp.CompleteTime > 0 {
		view.PaidAt = time.Unix(topUp.CompleteTime, 0).UTC().Format(time.RFC3339)
	}
	return view
}

func replayPartnerPaymentOrder(c *gin.Context, requestHash string, order *model.PartnerOAuthPaymentOrder, topUp *model.TopUp) {
	if order.RequestHash != requestHash {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusConflict, Code: "idempotency_conflict", Description: "the Idempotency-Key was already used with a different request"})
		return
	}
	view := partnerPaymentOrderView(topUp, order.RequestedAmount)
	if topUp.Status == common.TopUpStatusPending {
		// A fresh checkout URL for a method that was switched off would take a
		// payment the notify callback then refuses to credit.
		if !partnerEpayMethodAvailable(topUp.PaymentMethod) {
			writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusServiceUnavailable, Code: "payment_unavailable", Description: "payment is not available"})
			return
		}
		checkoutURL, err := partnerEpayCheckout(topUp, view.Amount)
		if err != nil {
			writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusServiceUnavailable, Code: "payment_unavailable", Description: "payment is temporarily unavailable"})
			return
		}
		view.CheckoutURL = checkoutURL
	}
	c.JSON(http.StatusOK, view)
}

func PartnerOAuthCreatePaymentOrder(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) || rejectPartnerIntegrationQuery(c) {
		return
	}
	principal := middleware.PartnerOAuthPrincipal(c)
	keyHash, err := service.ValidatePartnerOAuthIdempotencyKey(c.GetHeader("Idempotency-Key"))
	if err != nil {
		writePartnerIntegrationAPIError(c, err)
		return
	}
	req, err := parsePartnerPaymentOrderRequest(c)
	if err != nil {
		writePartnerIntegrationAPIError(c, err)
		return
	}
	requestHash := partnerPaymentRequestHash(req)
	if order, topUp, err := model.FindPartnerOAuthPaymentOrderByIdempotency(principal.Binding.BindingId, keyHash); err == nil {
		replayPartnerPaymentOrder(c, requestHash, order, topUp)
		return
	} else if !errors.Is(err, model.ErrPartnerOAuthPaymentOrderNotFound) {
		writePartnerIntegrationAPIError(c, err)
		return
	}

	if !isEpayTopUpEnabled() || GetEpayClient() == nil {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusServiceUnavailable, Code: "payment_unavailable", Description: "payment is not available"})
		return
	}
	if !partnerEpayMethodAvailable(req.PaymentMethod) {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_payment_method", Description: "payment_method is not available"})
		return
	}
	if req.ReturnURL != "" {
		if err := service.ValidatePartnerOAuthPaymentReturnURL(principal.Client, req.ReturnURL); err != nil {
			writePartnerIntegrationAPIError(c, err)
			return
		}
	}
	userID := principal.User.Id
	quote, err := quotePartnerTopUp(req.Amount)
	if err != nil {
		writePartnerIntegrationAPIError(c, err)
		return
	}
	if err := model.ValidateTopUpQuotaCapacity(userID, quote.CreditedQuota); err != nil {
		if errors.Is(err, model.ErrTopUpQuotaLimitExceeded) {
			writePartnerIntegrationAPIError(c, partnerInvalidAmount("the account balance would exceed the top-up limit"))
			return
		}
		writePartnerIntegrationAPIError(c, err)
		return
	}

	now := time.Now()
	bindingID := principal.Binding.BindingId

	// The bearer middleware read this user row from the database for this request.
	payMoney, err := partnerTopUpPayMoney(req.Amount, principal.User.Group)
	if err != nil {
		writePartnerIntegrationAPIError(c, err)
		return
	}
	baseQuota := quote.BaseQuota
	topUp := &model.TopUp{
		UserId:          userID,
		Amount:          quote.StoredAmount,
		Money:           payMoney,
		TradeNo:         fmt.Sprintf("USR%dNO%s%d", userID, common.GetRandomString(6), now.Unix()),
		PaymentMethod:   req.PaymentMethod,
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      now.Unix(),
		Status:          common.TopUpStatusPending,
	}
	checkoutURL, err := partnerEpayCheckout(topUp, req.Amount)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Partner OAuth epay checkout failed binding_id=%s user_id=%d trade_no=%s error=%q", bindingID, userID, topUp.TradeNo, err.Error()))
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusServiceUnavailable, Code: "payment_unavailable", Description: "payment is temporarily unavailable"})
		return
	}
	order := &model.PartnerOAuthPaymentOrder{
		BindingId:          bindingID,
		IdempotencyKeyHash: keyHash,
		RequestHash:        requestHash,
		RequestedAmount:    req.Amount,
		ClientId:           principal.Client.ClientId,
		ReturnURL:          req.ReturnURL,
		CreatedAt:          now.Unix(),
	}
	limits := model.PartnerOAuthPaymentOrderLimits{
		RecentSince:  now.Add(-time.Hour).Unix(),
		MaxRecent:    partnerPaymentHourlyOrderLimit,
		PendingSince: now.Add(-partnerPaymentPendingWindow).Unix(),
		MaxPending:   partnerPaymentPendingLimit,
	}
	err = model.CreatePartnerOAuthPaymentOrder(order, topUp, baseQuota, onlineTopUpCashbackMetadata(c, baseQuota, req.Amount, false), limits)
	if errors.Is(err, model.ErrPartnerOAuthPaymentRateLimited) {
		c.Header("Retry-After", "60")
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusTooManyRequests, Code: "rate_limited", Description: "too many payment orders, please retry later"})
		return
	}
	if errors.Is(err, model.ErrPartnerOAuthBindingNotFound) {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_token", Description: "access token is invalid", WWWAuth: `Bearer realm="integration", error="invalid_token"`})
		return
	}
	if errors.Is(err, model.ErrPartnerOAuthPaymentIdempotencyRace) {
		existing, existingTopUp, findErr := model.FindPartnerOAuthPaymentOrderByIdempotency(bindingID, keyHash)
		if findErr != nil {
			writePartnerIntegrationAPIError(c, findErr)
			return
		}
		replayPartnerPaymentOrder(c, requestHash, existing, existingTopUp)
		return
	}
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Partner OAuth failed to create top-up order binding_id=%s user_id=%d trade_no=%s error=%q", bindingID, userID, topUp.TradeNo, err.Error()))
		writePartnerIntegrationAPIError(c, err)
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("Partner OAuth top-up order created binding_id=%s user_id=%d trade_no=%s payment_method=%s amount=%d money=%.2f", bindingID, userID, topUp.TradeNo, req.PaymentMethod, req.Amount, payMoney))
	model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: "partner_oauth.payment.order_create", Success: true,
		ClientId: principal.Client.ClientId, BindingId: bindingID, TargetUserId: userID, Status: http.StatusCreated})
	view := partnerPaymentOrderView(topUp, req.Amount)
	view.CheckoutURL = checkoutURL
	c.JSON(http.StatusCreated, view)
}

func PartnerOAuthGetPaymentOrder(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) || rejectPartnerIntegrationQuery(c) {
		return
	}
	principal := middleware.PartnerOAuthPrincipal(c)
	orderID := c.Param("order_id")
	notFound := &service.PartnerOAuthError{Status: http.StatusNotFound, Code: "order_not_found", Description: "the payment order was not found"}
	if orderID == "" || len(orderID) > 255 {
		writePartnerIntegrationAPIError(c, notFound)
		return
	}
	order, topUp, err := model.GetPartnerOAuthPaymentOrder(principal.Binding.BindingId, orderID)
	if errors.Is(err, model.ErrPartnerOAuthPaymentOrderNotFound) {
		writePartnerIntegrationAPIError(c, notFound)
		return
	}
	if err != nil {
		writePartnerIntegrationAPIError(c, err)
		return
	}
	c.JSON(http.StatusOK, partnerPaymentOrderView(topUp, order.RequestedAmount))
}

// partnerPaymentReturnTarget sends the payer back to the partner when the
// order registered a return URL; status is only a hint for the partner UI.
func partnerPaymentReturnTarget(topUp *model.TopUp, paid bool) string {
	returnURL := service.PartnerOAuthPaymentReturnURL(topUp.Id)
	if returnURL == "" {
		return ""
	}
	parsed, err := url.Parse(returnURL)
	if err != nil {
		return ""
	}
	status := common.TopUpStatusPending
	if paid {
		status = common.TopUpStatusSuccess
	}
	query := parsed.Query()
	query.Set("order_id", topUp.TradeNo)
	query.Set("status", status)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

// partnerTopUpQuote is a partner top-up amount checked against the web Epay
// checkout rules: minimum, quota conversion and wallet bounds.
type partnerTopUpQuote struct {
	CreditedQuota int
	BaseQuota     int
	StoredAmount  int64
}

func partnerInvalidAmount(description string) *service.PartnerOAuthError {
	return &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_amount", Description: description}
}

// quotePartnerTopUp validates a requested top-up amount the way the web Epay
// checkout does and converts it for storage.
func quotePartnerTopUp(amount int64) (*partnerTopUpQuote, error) {
	if amount < getMinTopup() {
		return nil, partnerInvalidAmount(fmt.Sprintf("amount must be at least %d", getMinTopup()))
	}
	creditedQuota, err := validateTopUpQuota(amount)
	if err != nil {
		return nil, partnerInvalidAmount(err.Error())
	}
	baseQuota, err := cashbackBaseQuotaFromTopUpAmount(amount)
	if err != nil || baseQuota <= 0 {
		return nil, partnerInvalidAmount("invalid top-up amount")
	}
	storedAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		storedAmount = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}
	return &partnerTopUpQuote{CreditedQuota: creditedQuota, BaseQuota: baseQuota, StoredAmount: storedAmount}, nil
}

// partnerTopUpPayMoney prices a top-up for the payer's user group, including
// the group top-up ratio and preset discounts.
func partnerTopUpPayMoney(amount int64, group string) (float64, error) {
	payMoney := getPayMoney(amount, group)
	if payMoney < 0.01 {
		return 0, partnerInvalidAmount("payment amount is too low")
	}
	return payMoney, nil
}
