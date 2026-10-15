package service

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

var mixPayDecimalPattern = regexp.MustCompile(`^[0-9]{1,16}(\.[0-9]{1,18})?$`)
var mixPayCodePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
var mixPayHTTPClient = &http.Client{Timeout: 12 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return errors.New("MixPay redirect rejected") }}

func ValidateMixPayConfig(c *model.MixPayConfig) error {
	if c.MinTopUp < 1 || c.MinTopUp > 1000000 || c.TTLSeconds < 60 || c.TTLSeconds > 86400 {
		return errors.New("invalid MixPay limits")
	}
	if !c.Enabled && c.PayeeID == "" {
		return nil
	}
	if id, err := uuid.Parse(c.PayeeID); err != nil || id == uuid.Nil {
		return errors.New("invalid MixPay payee ID")
	}
	if id, err := uuid.Parse(c.SettlementAssetID); err != nil || id == uuid.Nil {
		return errors.New("invalid MixPay settlement asset")
	}
	for _, raw := range []string{c.NotifyBaseURL, c.ReturnURL} {
		u, err := url.Parse(raw)
		if err != nil || len(raw) > 450 || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Fragment != "" || u.RawQuery != "" {
			return errors.New("MixPay requires HTTPS callback and return URLs without query parameters")
		}
	}
	return nil
}

func MixPayAmount(value string) (decimal.Decimal, error) {
	if !mixPayDecimalPattern.MatchString(value) {
		return decimal.Zero, errors.New("invalid payment amount")
	}
	d, err := decimal.NewFromString(value)
	if err != nil || !d.IsPositive() {
		return decimal.Zero, errors.New("invalid payment amount")
	}
	return d, nil
}

func QuoteMixPay(config *model.MixPayConfig, amount int64, group string, planID int) (string, int, *model.SubscriptionPlan, error) {
	var money decimal.Decimal
	quota := 0
	var plan *model.SubscriptionPlan
	if planID > 0 {
		var err error
		plan, err = model.GetSubscriptionPlanById(planID)
		if err != nil {
			return "", 0, nil, err
		}
		if !plan.Enabled {
			return "", 0, nil, errors.New("subscription plan unavailable")
		}
		money, err = model.SubscriptionPriceUSD(plan.PriceAmount, plan.Currency)
		if err != nil {
			return "", 0, nil, err
		}
	} else {
		fen, q, err := QuoteCNYTopUp(config.MinTopUp, amount, group)
		if err != nil {
			return "", 0, nil, err
		}
		rate := operation_setting.USDExchangeRate
		if !(rate > 0 && rate <= 1000000) {
			return "", 0, nil, errors.New("invalid USD exchange rate")
		}
		money = decimal.NewFromInt(fen).Div(decimal.NewFromInt(100)).Div(decimal.NewFromFloat(rate))
		quota = q
	}
	money = money.Round(2)
	if !money.IsPositive() || money.GreaterThan(decimal.NewFromInt(1000000)) {
		return "", 0, nil, errors.New("MixPay amount outside supported range")
	}
	return money.StringFixed(2), quota, plan, nil
}

type mixPayResponse struct {
	Success bool `json:"success"`
	Code    int  `json:"code"`
	Data    struct {
		Code         string `json:"code"`
		Status       string `json:"status"`
		TraceID      string `json:"traceId"`
		PayeeID      string `json:"payeeId"`
		QuoteAmount  string `json:"quoteAmount"`
		QuoteAssetID string `json:"quoteAssetId"`
		FailureCode  string `json:"failureCode"`
		SettleStatus string `json:"settleStatus"`
		SettleAmount string `json:"settleAmount"`
		SettleAsset  string `json:"settleAsset"`
	} `json:"data"`
}

func mixPayRequest(ctx context.Context, method, path string, body any) (*mixPayResponse, error) {
	var reader io.Reader
	if body != nil {
		b, err := common.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, "https://api.mixpay.me/v1/"+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	rsp, err := mixPayHTTPClient.Do(req)
	if err != nil {
		return nil, errors.New("MixPay request unavailable")
	}
	defer rsp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(rsp.Body, 65537))
	if err != nil || len(raw) > 65536 {
		return nil, errors.New("invalid MixPay response")
	}
	var result mixPayResponse
	if rsp.StatusCode == http.StatusTooManyRequests {
		_ = model.DeferMixPayRequests()
		return nil, errors.New("MixPay rate limited")
	}
	if rsp.StatusCode != http.StatusOK || common.Unmarshal(raw, &result) != nil {
		return nil, errors.New("MixPay response unavailable")
	}
	if result.Code == 1429 {
		_ = model.DeferMixPayRequests()
		return nil, errors.New("MixPay rate limited")
	}
	if !result.Success || result.Code != 0 {
		return nil, errors.New("MixPay result not available")
	}
	return &result, nil
}

// One order lease fences every network result; no network call runs in a transaction.
func ReconcileMixPayOrder(ctx context.Context, trade string) (resultErr error) {
	return reconcileMixPayOrder(ctx, trade, false)
}

// RecheckMixPayOrder obtains fresh server evidence before any manual fulfillment.
// It retains review holds and never creates a new checkout.
func RecheckMixPayOrder(ctx context.Context, trade string) error {
	return reconcileMixPayOrder(ctx, trade, true)
}

func reconcileMixPayOrder(ctx context.Context, trade string, manual bool) (resultErr error) {
	o, err := model.ClaimMixPayOrder(trade)
	if err != nil || o == nil {
		if err == nil && manual {
			return errors.New("MixPay order is already being checked")
		}
		return err
	}
	defer func() { resultErr = errors.Join(resultErr, model.FinishMixPayCheck(o, resultErr)) }()
	if !manual && o.Status == "paid" && !o.ReviewRequired {
		if err := model.CompleteMixPayOrder(trade); err != nil {
			return err
		}
	}
	if err := model.SyncMixPayFulfillment(trade); err != nil {
		return err
	}
	if !manual && (o.Status == "failed" || (o.Status == "success" && o.SettleStatus == "success")) {
		return nil
	}
	if manual && o.CreationState == "queued" {
		return errors.New("MixPay payment has not been created")
	}
	allowed, err := model.ClaimMixPayRequest()
	if err != nil {
		return err
	}
	if !allowed {
		return errors.New("MixPay request queued")
	}
	if o.CreationState == "queued" {
		if common.GetTimestamp() >= o.ExpiresAt {
			// This request was never sent. Do not fabricate an upstream failure result.
			return model.RejectUnsentMixPayOrder(o)
		}
		r := model.DB.Model(&model.MixPayOrder{}).Where("id = ? AND lease_token = ? AND creation_state = ?", o.ID, o.LeaseToken, "queued").Update("creation_state", "uncertain")
		if r.Error != nil {
			return r.Error
		}
		if r.RowsAffected != 1 {
			return errors.New("MixPay creation already started")
		}
		strict := o.StrictMode
		payload := struct {
			PayeeID           string `json:"payeeId"`
			QuoteAmount       string `json:"quoteAmount"`
			QuoteAssetID      string `json:"quoteAssetId"`
			SettlementAssetID string `json:"settlementAssetId"`
			StrictMode        *bool  `json:"strictMode,omitempty"`
			OrderID           string `json:"orderId"`
			TraceID           string `json:"traceId"`
			CallbackURL       string `json:"callbackUrl"`
			ReturnTo          string `json:"returnTo"`
			FailedReturnTo    string `json:"failedReturnTo"`
			CallbackEvent     string `json:"callbackEvent"`
			ExpiredTimestamp  *int64 `json:"expiredTimestamp,omitempty"`
		}{o.PayeeID, o.QuoteAmount, o.QuoteAssetID, o.SettlementAssetID, &strict, o.TradeNo, o.TraceID, o.CallbackURL, o.ReturnURL, o.ReturnURL, "settle|pending|paid_less", &o.ExpiresAt}
		rsp, err := mixPayRequest(ctx, http.MethodPost, "one_time_payment", payload)
		if err != nil {
			return err
		}
		if !mixPayCodePattern.MatchString(rsp.Data.Code) {
			return errors.New("invalid MixPay checkout code")
		}
		return model.DB.Model(&model.MixPayOrder{}).Where("id = ? AND lease_token = ? AND lease_until > ?", o.ID, o.LeaseToken, common.GetTimestamp()).Updates(map[string]any{"code": rsp.Data.Code, "creation_state": "ready"}).Error
	}
	// Uncertain creates are queried with their original trace, never blindly recreated.
	rsp, err := mixPayRequest(ctx, http.MethodGet, "payments_result?"+url.Values{"traceId": {o.TraceID}}.Encode(), nil)
	if err != nil {
		return err
	}
	data := rsp.Data
	if !slices.Contains([]string{"unpaid", "confirming", "paid_less", "pending", "auditing", "success", "failed"}, data.Status) {
		return errors.New("unknown MixPay status")
	}
	actual, e1 := MixPayAmount(data.QuoteAmount)
	expected, e2 := MixPayAmount(o.QuoteAmount)
	completeIdentity := data.TraceID != "" && data.PayeeID != "" && data.QuoteAssetID != "" && data.QuoteAmount != ""
	// MixPay's not-yet-started checkout response uses zero as a placeholder,
	// with empty identity fields. It is not a quote or evidence of payment.
	unstarted := data.Status == "unpaid" && data.QuoteAmount == "0" &&
		data.TraceID == "" && data.PayeeID == "" && data.QuoteAssetID == "" &&
		data.SettleStatus != "success"
	terminal := data.Status == "success" || data.Status == "failed"
	// Intermediate results may not contain payment identity yet. Missing fields
	// are not mismatches, but explicit mismatches and incomplete final evidence
	// must never authorize fulfillment.
	if (terminal && !completeIdentity) ||
		(data.TraceID != "" && data.TraceID != o.TraceID) ||
		(data.PayeeID != "" && data.PayeeID != o.PayeeID) ||
		(data.QuoteAssetID != "" && data.QuoteAssetID != o.QuoteAssetID) ||
		(!unstarted && data.QuoteAmount != "" && (e1 != nil || e2 != nil || !actual.Equal(expected))) {
		_ = model.DB.Model(o).Where("lease_token = ?", o.LeaseToken).Updates(map[string]any{"review_required": true, "last_error": "payment_identity_mismatch"}).Error
		return errors.New("MixPay payment identity mismatch")
	}
	if len(data.FailureCode) > 32 || len(data.SettleAmount) > 64 || len(data.SettleAsset) > 64 || !slices.Contains([]string{"", "pending", "success"}, data.SettleStatus) {
		return errors.New("invalid MixPay settlement result")
	}
	if data.SettleStatus == "success" {
		if _, err := MixPayAmount(data.SettleAmount); err != nil {
			return err
		}
		if o.StrictMode && data.SettleAsset != o.SettlementAssetID {
			return errors.New("MixPay settlement asset mismatch")
		}
	}
	// Repair the old false positive only for a checkout that has never had a
	// verified payment status. Other review reasons and terminal states remain held.
	legacyUnstarted := unstarted && o.Status == "pending" && o.GatewayStatus == "" && o.CreationState == "ready" && o.VerifiedAt == 0
	if (completeIdentity || legacyUnstarted) && o.ReviewRequired && o.LastError == "payment_identity_mismatch" {
		resolved := model.DB.Model(&model.MixPayOrder{}).
			Where("id = ? AND lease_token = ? AND lease_until > ? AND last_error = ?", o.ID, o.LeaseToken, common.GetTimestamp(), "payment_identity_mismatch").
			Updates(map[string]any{"review_required": false, "last_error": ""})
		if resolved.Error != nil {
			return resolved.Error
		}
		if resolved.RowsAffected != 1 {
			return errors.New("MixPay verification lease lost")
		}
		o.ReviewRequired = false
	}
	if err := model.SaveMixPayResult(o, data.Status, data.FailureCode, data.SettleStatus, data.SettleAmount, data.SettleAsset); err != nil {
		return err
	}
	if data.Status == "success" && !o.ReviewRequired {
		return model.CompleteMixPayOrder(trade)
	}
	return nil
}

func RunMixPayReconciliation(ctx context.Context) error {
	var orders []model.MixPayOrder
	now := common.GetTimestamp()
	if err := model.DB.Where("next_check_at > 0 AND next_check_at <= ? AND lease_until <= ?", now, now).Order("next_check_at, id").Limit(10).Find(&orders).Error; err != nil {
		return err
	}
	var failures []error
	for _, o := range orders {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := ReconcileMixPayOrder(ctx, o.TradeNo); err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

func MixPayCheckout(o *model.MixPayOrder) map[string]any {
	link := ""
	if o.Code != "" && mixPayCodePattern.MatchString(o.Code) && o.Status == "pending" && !o.ReviewRequired && common.GetTimestamp() < o.ExpiresAt {
		link = "https://mixpay.me/code/" + o.Code
	}
	return map[string]any{"payment_provider": model.PaymentProviderMixPay, "trade_no": o.TradeNo, "status": o.Status, "gateway_status": o.GatewayStatus, "creation_state": o.CreationState, "pay_link": link, "amount": o.QuoteAmount, "currency": "USD", "expires_at": o.ExpiresAt, "review_required": o.ReviewRequired, "settle_status": o.SettleStatus, "can_cancel": false}
}

func MixPayCallbackURL(c *model.MixPayConfig) string {
	return strings.TrimRight(c.NotifyBaseURL, "/") + "/api/user/mixpay/notify"
}
