package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
)

var webMoneyWMID = regexp.MustCompile(`^[0-9]{12}$`)

var webMoneyPurse = regexp.MustCompile(`^T[0-9]{12}$`)
var webMoneyNumber = regexp.MustCompile(`^[0-9]{1,15}$`)
var webMoneyRate = regexp.MustCompile(`^[0-9]{1,7}(\.[0-9]{1,6})?$`)
var webMoneyAmount = regexp.MustCompile(`^[0-9]{1,9}(\.[0-9]{1,2})?$`)

func ValidateWebMoneyConfig(c *model.WebMoneyConfig) error {
	if c.WMID != "" && !webMoneyWMID.MatchString(c.WMID) {
		return errors.New("WebMoney WMID must contain 12 digits")
	}
	if !webMoneyRate.MatchString(c.Rate) {
		return errors.New("invalid WMT/USD rate")
	}
	rate, err := decimal.NewFromString(c.Rate)
	if len(c.Rate) > 24 || err != nil || !rate.IsPositive() || rate.GreaterThan(decimal.NewFromInt(1000000)) || rate.Exponent() < -6 {
		return errors.New("invalid WMT/USD rate")
	}
	c.Rate = rate.String()
	if c.MinTopUp < 1 || c.MinTopUp > 1000000 {
		return errors.New("invalid minimum topup")
	}
	if !c.Enabled && c.Purse == "" {
		return nil
	}
	if !webMoneyPurse.MatchString(c.Purse) || utf8.RuneCountInString(c.Description) < 1 || utf8.RuneCountInString(c.Description) > 255 {
		return errors.New("invalid WebMoney purse or description")
	}
	if len(c.Secret) < 16 || len(c.Secret) > 50 || strings.ContainsAny(c.Secret, ";\r\n") {
		return errors.New("WebMoney Secret Key must contain 16 to 50 characters without semicolons or line breaks")
	}
	for _, raw := range []string{c.NotifyBaseURL, c.ReturnURL} {
		u, e := url.Parse(raw)
		if e != nil || len(raw) > 450 || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.Fragment != "" || u.RawQuery != "" {
			return errors.New("WebMoney requires public HTTPS notification and return URLs without query parameters")
		}
	}
	c.NotifyBaseURL = strings.TrimRight(c.NotifyBaseURL, "/")
	return nil
}
func QuoteWebMoney(c *model.WebMoneyConfig, amount int64, group string) (string, int, error) {
	value, quota, _, err := QuoteWebMoneyOrder(c, amount, group, 0)
	return value, quota, err
}
func QuoteWebMoneyOrder(c *model.WebMoneyConfig, amount int64, group string, planID int) (string, int, *model.SubscriptionPlan, error) {
	// Reuse site-currency conversion, discounts and wallet capacity bounds.
	usd, quota, plan, err := QuoteMixPay(&model.MixPayConfig{MinTopUp: c.MinTopUp}, amount, group, planID)
	if err != nil {
		return "", 0, nil, err
	}
	if !webMoneyRate.MatchString(c.Rate) {
		return "", 0, nil, errors.New("invalid WMT/USD rate")
	}
	rate, e := decimal.NewFromString(c.Rate)
	if e != nil || !rate.IsPositive() {
		return "", 0, nil, errors.New("invalid WebMoney exchange rate")
	}
	money, _ := decimal.NewFromString(usd)
	money = money.Mul(rate).Round(2)
	if !money.IsPositive() || money.GreaterThan(decimal.NewFromInt(1000000)) {
		return "", 0, nil, errors.New("WebMoney amount outside supported range")
	}
	return money.StringFixed(2), quota, plan, nil
}
func WebMoneyCheckout(o *model.WebMoneyOrder, c *model.WebMoneyConfig) map[string]any {
	data := map[string]any{"payment_provider": "webmoney", "trade_no": o.TradeNo, "amount": o.Amount, "currency": "WMT", "expires_at": o.ExpiresAt, "status": o.Status, "pay_link": "", "review_required": model.DirectSubscriptionReviewRequired(o.TradeNo), "creation_state": "ready", "gateway_status": o.GatewayStatus}
	if o.Status == "pending" && o.ExpiresAt > common.GetTimestamp() {
		data["pay_link"] = "https://merchant.wmtransfer.com/lmi/payment_utf.asp"
		data["pay_params"] = map[string]string{"LMI_PAYEE_PURSE": c.Purse, "LMI_PAYMENT_AMOUNT": o.Amount, "LMI_PAYMENT_NO": strconv.FormatInt(o.ID, 10), "LMI_PAYMENT_DESC_BASE64": base64.StdEncoding.EncodeToString([]byte(c.Description)), "LMI_SUCCESS_URL": c.ReturnURL, "LMI_FAIL_URL": c.ReturnURL}
	}
	return data
}
func ValidateWebMoneyPayment(o *model.WebMoneyOrder, c *model.WebMoneyConfig, v url.Values) error {
	for key, values := range v {
		if strings.HasPrefix(key, "LMI_") && len(values) != 1 {
			return errors.New("duplicate WebMoney field")
		}
	}
	if v.Get("LMI_PAYEE_PURSE") != c.Purse || v.Get("LMI_PAYMENT_NO") != strconv.FormatInt(o.ID, 10) || !webMoneyAmount.MatchString(v.Get("LMI_PAYMENT_AMOUNT")) {
		return errors.New("WebMoney identity mismatch")
	}
	amount, err := decimal.NewFromString(v.Get("LMI_PAYMENT_AMOUNT"))
	expected, e := decimal.NewFromString(o.Amount)
	if err != nil || e != nil || !amount.Equal(expected) {
		return errors.New("WebMoney amount mismatch")
	}
	if v.Get("LMI_MODE") != "0" || v.Get("LMI_HOLD") != "" {
		return errors.New("WebMoney test or held payment rejected")
	}
	return nil
}
func VerifyWebMoneyNotification(o *model.WebMoneyOrder, c *model.WebMoneyConfig, v url.Values) error {
	if err := ValidateWebMoneyPayment(o, c, v); err != nil {
		return err
	}
	if v.Get("LMI_PREREQUEST") != "" && v.Get("LMI_PREREQUEST") != "0" {
		return errors.New("not a payment notification")
	}
	for _, field := range []string{"LMI_SYS_INVS_NO", "LMI_SYS_TRANS_NO", "LMI_PAYER_WM"} {
		if !webMoneyNumber.MatchString(v.Get(field)) {
			return errors.New("invalid WebMoney transaction")
		}
	}
	if len(v.Get("LMI_SYS_TRANS_DATE")) != 17 || len(v.Get("LMI_PAYER_PURSE")) != 13 {
		return errors.New("invalid WebMoney receipt")
	}
	parts := []string{c.Purse, v.Get("LMI_PAYMENT_AMOUNT"), v.Get("LMI_PAYMENT_NO"), v.Get("LMI_MODE"), v.Get("LMI_SYS_INVS_NO"), v.Get("LMI_SYS_TRANS_NO"), v.Get("LMI_SYS_TRANS_DATE"), c.Secret, v.Get("LMI_PAYER_PURSE"), v.Get("LMI_PAYER_WM")}
	separator := ""
	hash := v.Get("LMI_HASH")
	if v.Get("LMI_HASH2") != "" {
		separator = ";"
		hash = v.Get("LMI_HASH2")
	}
	expected := sha256.Sum256([]byte(strings.Join(parts, separator)))
	actual, err := hex.DecodeString(hash)
	if err != nil || subtle.ConstantTimeCompare(expected[:], actual) != 1 {
		return errors.New("invalid WebMoney signature")
	}
	return nil
}

// Durable verified evidence is retried even when the buyer closes the browser.
func RunWebMoneyReconciliation(ctx context.Context) error {
	var lastID int64
	var result error
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		var orders []model.WebMoneyOrder
		if err := model.DB.WithContext(ctx).Where("id > ? AND (status = ? OR cache_pending = ? OR log_pending = ?)", lastID, "paid", true, true).Order("id").Limit(100).Find(&orders).Error; err != nil {
			return err
		}
		for _, o := range orders {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if err := model.CompleteWebMoneyOrder(o.TradeNo); err != nil {
				result = errors.New("WebMoney fulfillment requires retry")
			}
			lastID = o.ID
		}
		if len(orders) < 100 {
			return result
		}
	}
}

// ReconcileWebMoneyOrder obtains authoritative X18 evidence using the order's
// frozen purse and secret. The WMID alone may be supplied by a later revision
// for the same purse, so pre-X18 orders remain recoverable.
func ReconcileWebMoneyOrder(ctx context.Context, trade string) error {
	o, config, err := model.GetWebMoneyOrder(trade)
	if err != nil {
		return err
	}
	if o.Status == "paid" || o.Status == "success" {
		return model.CompleteWebMoneyOrder(trade)
	}
	if o.Status != "pending" {
		return errors.New("WebMoney order cannot be queried")
	}
	if config.WMID == "" {
		current, e := model.CurrentWebMoneyConfig()
		if e != nil {
			return e
		}
		if current.Purse == config.Purse {
			config.WMID = current.WMID
		}
	}
	transaction, gatewayStatus, err := QueryWebMoneyPayment(ctx, o, config)
	if err != nil || transaction == "" {
		// A concurrent verified callback takes precedence over an incomplete query.
		if saveErr := model.DB.Model(&model.WebMoneyOrder{}).Where("id = ? AND status = ?", o.ID, "pending").Update("gateway_status", gatewayStatus).Error; saveErr != nil {
			return saveErr
		}
		return err
	}
	if err := model.RecordWebMoneyPayment(o, transaction); err != nil {
		return err
	}
	return model.CompleteWebMoneyOrder(trade)
}

// QueryWebMoneyPayment returns a transaction only for a completed, matching
// merchant payment. An empty transaction means no completed payment was found.
// Authentication uses Secret Key, never Secret Key X20 or plaintext credentials.
func QueryWebMoneyPayment(ctx context.Context, o *model.WebMoneyOrder, c *model.WebMoneyConfig) (string, string, error) {
	if !webMoneyWMID.MatchString(c.WMID) || !webMoneyPurse.MatchString(c.Purse) || c.Secret == "" || o.ID <= 0 {
		return "", "query_failed", errors.New("WebMoney query requires the merchant WMID, purse and Secret Key")
	}
	paymentNo := strconv.FormatInt(o.ID, 10)
	digest := sha256.Sum256([]byte(c.WMID + c.Purse + paymentNo + c.Secret))
	payload, err := xml.Marshal(struct {
		XMLName    xml.Name `xml:"merchant.request"`
		WMID       string   `xml:"wmid"`
		Purse      string   `xml:"lmi_payee_purse"`
		PaymentNo  string   `xml:"lmi_payment_no"`
		NumberType string   `xml:"lmi_payment_no_type"`
		SHA256     string   `xml:"sha256"`
	}{WMID: c.WMID, Purse: c.Purse, PaymentNo: paymentNo, NumberType: "1", SHA256: hex.EncodeToString(digest[:])})
	if err != nil {
		return "", "query_failed", errors.New("cannot encode WebMoney query")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://merchant.webmoney.ru/conf/xml/XMLTransGet.asp", bytes.NewReader(payload))
	if err != nil {
		return "", "query_failed", errors.New("cannot create WebMoney query")
	}
	request.Header.Set("Content-Type", "application/xml; charset=utf-8")
	client := &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(request)
	if err != nil {
		return "", "query_failed", errors.New("WebMoney query unavailable")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", "query_failed", errors.New("WebMoney query returned an HTTP error")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 65537))
	if err != nil || len(body) > 65536 {
		return "", "query_failed", errors.New("invalid WebMoney query response")
	}
	var result struct {
		XMLName    xml.Name `xml:"merchant.response"`
		Codes      []int    `xml:"retval"`
		Operations []struct {
			Transaction string `xml:"wmtransid,attr"`
			Invoice     string `xml:"wminvoiceid,attr"`
			Amount      string `xml:"amount"`
			HoldState   *int   `xml:"hold_state"`
		} `xml:"operation"`
		ErrorLogs []struct {
			Purse     string `xml:"lmi_payee_purse,attr"`
			PaymentNo string `xml:"lmi_payment_no,attr"`
		} `xml:"errorlog"`
	}
	if xml.Unmarshal(body, &result) != nil || len(result.Codes) != 1 {
		return "", "query_failed", errors.New("invalid WebMoney query response")
	}
	for _, entry := range result.ErrorLogs {
		if entry.Purse != c.Purse || entry.PaymentNo != paymentNo {
			return "", "query_failed", errors.New("WebMoney query identity mismatch")
		}
	}
	switch result.Codes[0] {
	case 8, 9:
		if len(result.Operations) != 0 {
			return "", "query_failed", errors.New("conflicting WebMoney query result")
		}
		return "", "x18:" + strconv.Itoa(result.Codes[0]), nil
	case 0:
	default:
		// Authentication failures and rejected invoices are not proof that the
		// merchant order can never receive a subsequent successful payment.
		return "", "x18:" + strconv.Itoa(result.Codes[0]), errors.New("WebMoney did not confirm a completed payment")
	}
	if len(result.Operations) != 1 {
		return "", "query_failed", errors.New("missing or ambiguous WebMoney transaction")
	}
	operation := result.Operations[0]
	if operation.HoldState != nil && (*operation.HoldState == 4 || *operation.HoldState == 12) {
		return "", "hold:" + strconv.Itoa(*operation.HoldState), errors.New("WebMoney payment is held or refunded")
	}
	if operation.HoldState == nil || *operation.HoldState != 0 {
		return "", "query_failed", errors.New("WebMoney payment is held or refunded")
	}
	if !webMoneyNumber.MatchString(operation.Transaction) || !webMoneyNumber.MatchString(operation.Invoice) {
		return "", "query_failed", errors.New("invalid WebMoney transaction")
	}
	transaction, _ := strconv.ParseInt(operation.Transaction, 10, 64)
	invoice, _ := strconv.ParseInt(operation.Invoice, 10, 64)
	if transaction <= 0 || invoice <= 0 || !webMoneyAmount.MatchString(operation.Amount) {
		return "", "query_failed", errors.New("invalid WebMoney transaction")
	}
	amount, err := decimal.NewFromString(operation.Amount)
	expected, expectedErr := decimal.NewFromString(o.Amount)
	if err != nil || expectedErr != nil || !amount.IsPositive() || !amount.Equal(expected) {
		return "", "query_failed", errors.New("WebMoney payment amount mismatch")
	}
	return strconv.FormatInt(transaction, 10), "success", nil
}
