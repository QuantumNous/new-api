package service

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/paymentsecret"
	"github.com/shopspring/decimal"
)

var antomRegions = map[string]string{"SG": "https://open-sea-global.alipay.com", "US": "https://open-na-global.alipay.com", "DE": "https://open-de-global.alipay.com"}
var antomID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
var antomCurrency = regexp.MustCompile(`^[A-Z]{3}$`)

func AntomPrivateKey(value string) (*rsa.PrivateKey, error) {
	var raw []byte
	if block, _ := pem.Decode([]byte(value)); block != nil {
		raw = block.Bytes
	} else {
		raw, _ = base64.StdEncoding.DecodeString(strings.Join(strings.Fields(value), ""))
	}
	key, err := x509.ParsePKCS8PrivateKey(raw)
	if err == nil {
		if k, ok := key.(*rsa.PrivateKey); ok && k.N.BitLen() >= 2048 {
			return k, k.Validate()
		}
	}
	k, err := x509.ParsePKCS1PrivateKey(raw)
	if err != nil || k.N.BitLen() < 2048 {
		return nil, errors.New("Antom requires an RSA private key of at least 2048 bits")
	}
	return k, k.Validate()
}
func AntomPublicKey(value string) (*rsa.PublicKey, error) {
	var raw []byte
	if block, _ := pem.Decode([]byte(value)); block != nil {
		raw = block.Bytes
	} else {
		raw, _ = base64.StdEncoding.DecodeString(strings.Join(strings.Fields(value), ""))
	}
	key, err := x509.ParsePKIXPublicKey(raw)
	if err == nil {
		if k, ok := key.(*rsa.PublicKey); ok && k.N.BitLen() >= 2048 {
			return k, nil
		}
	}
	return nil, errors.New("Antom requires an RSA public key of at least 2048 bits")
}
func ValidateAntomConfig(c *model.AntomConfig) error {
	if c.MinTopUp < 1 || c.MinTopUp > 1000000 || antomRegions[c.Region] == "" || !antomCurrency.MatchString(c.SettlementCurrency) {
		return errors.New("invalid Antom region, currency or minimum top-up")
	}
	if !c.Enabled && c.ClientID == "" {
		return nil
	}
	if !antomID.MatchString(c.ClientID) || strings.HasPrefix(c.ClientID, "SANDBOX_") != c.Sandbox {
		return errors.New("Antom Client ID must match the selected environment")
	}
	if len(c.Description) == 0 || len(c.Description) > 255 {
		return errors.New("invalid Antom payment description")
	}
	if _, err := AntomPrivateKey(c.Secret); err != nil {
		return err
	}
	if _, err := AntomPublicKey(c.PublicKey); err != nil {
		return err
	}
	for _, raw := range []string{c.NotifyBaseURL, c.ReturnURL} {
		u, err := url.Parse(raw)
		if err != nil || len(raw) > 450 || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return errors.New("Antom requires HTTPS notification and return URLs without query parameters")
		}
	}
	c.NotifyBaseURL = strings.TrimRight(c.NotifyBaseURL, "/")
	return nil
}
func QuoteAntom(c *model.AntomConfig, amount int64, group string) (string, int, error) {
	value, quota, _, err := QuoteAntomOrder(c, amount, group, 0)
	return value, quota, err
}
func QuoteAntomOrder(c *model.AntomConfig, amount int64, group string, planID int) (string, int, *model.SubscriptionPlan, error) {
	value, quota, plan, err := QuoteMixPay(&model.MixPayConfig{MinTopUp: c.MinTopUp}, amount, group, planID)
	return value, quota, plan, err
}

type AntomResult struct {
	Code   string `json:"resultCode"`
	Status string `json:"resultStatus"`
}
type AntomAmount struct {
	Currency string `json:"currency"`
	Value    string `json:"value"`
}
type AntomResponse struct {
	Result           AntomResult `json:"result"`
	PaymentRequestID string      `json:"paymentRequestId"`
	PaymentID        string      `json:"paymentId"`
	PaymentStatus    string      `json:"paymentStatus"`
	PaymentAmount    AntomAmount `json:"paymentAmount"`
	SessionID        string      `json:"paymentSessionId"`
	NormalURL        string      `json:"normalUrl"`
	SessionExpiry    string      `json:"paymentSessionExpiryTime"`
	Transactions     []struct {
		Type   string      `json:"transactionType"`
		Status string      `json:"transactionStatus"`
		Amount AntomAmount `json:"transactionAmount"`
	} `json:"transactions"`
}

// Antom signs exact bytes; reserializing a notification before verification is invalid.
func VerifyAntomSignature(c *model.AntomConfig, path, clientID, timestamp, signature string, body []byte) error {
	if clientID != c.ClientID || timestamp == "" || len(timestamp) > 64 {
		return errors.New("invalid Antom signature context")
	}
	fields := map[string]string{}
	for part := range strings.SplitSeq(signature, ",") {
		k, v, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok || fields[k] != "" {
			return errors.New("invalid Antom signature header")
		}
		fields[k] = v
	}
	if fields["algorithm"] != "RSA256" || fields["keyVersion"] != "1" {
		return errors.New("unsupported Antom signature")
	}
	encoded, err := url.QueryUnescape(fields["signature"])
	if err != nil {
		return errors.New("invalid Antom signature")
	}
	sig, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return errors.New("invalid Antom signature")
	}
	key, err := AntomPublicKey(c.PublicKey)
	if err != nil {
		return err
	}
	hash := sha256.Sum256([]byte("POST " + path + "\n" + clientID + "." + timestamp + "." + string(body)))
	if rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], sig) != nil {
		return errors.New("invalid Antom signature")
	}
	return nil
}
func CallAntom(ctx context.Context, c *model.AntomConfig, action string, payload any) (*AntomResponse, error) {
	if action != "createPaymentSession" && action != "inquiryPayment" && action != "cancel" {
		return nil, errors.New("invalid Antom operation")
	}
	endpoint := antomRegions[c.Region]
	if endpoint == "" {
		return nil, errors.New("invalid Antom region")
	}
	prefix := "/ams/api/v1/payments/"
	if c.Sandbox {
		prefix = "/ams/sandbox/api/v1/payments/"
	}
	path := prefix + action
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	timestamp := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
	hash := sha256.Sum256([]byte("POST " + path + "\n" + c.ClientID + "." + timestamp + "." + string(body)))
	key, err := AntomPrivateKey(c.Secret)
	if err != nil {
		return nil, err
	}
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if err != nil {
		return nil, errors.New("cannot sign Antom request")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Header.Set("Client-Id", c.ClientID)
	req.Header.Set("Request-Time", timestamp)
	req.Header.Set("Signature", "algorithm=RSA256,keyVersion=1,signature="+url.QueryEscape(base64.StdEncoding.EncodeToString(signature)))
	client := http.Client{Timeout: 20 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		return nil, errors.New("Antom request unavailable")
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 65537))
	if err != nil || len(raw) > 65536 || response.StatusCode != 200 {
		return nil, errors.New("invalid Antom response")
	}
	if err := VerifyAntomSignature(c, path, response.Header.Get("Client-Id"), response.Header.Get("Response-Time"), response.Header.Get("Signature"), raw); err != nil {
		return nil, err
	}
	var result AntomResponse
	if common.Unmarshal(raw, &result) != nil {
		return nil, errors.New("invalid Antom response body")
	}
	return &result, nil
}
func AntomCheckout(o *model.AntomOrder, c *model.AntomConfig) map[string]any {
	link := ""
	if o.Status == "pending" && o.GatewayStatus != "CANCEL_REQUESTED" && o.ExpiresAt > common.GetTimestamp() {
		link = "/payment/antom/" + o.TradeNo
	}
	return map[string]any{"payment_provider": "antom", "trade_no": o.TradeNo, "amount": o.Amount, "currency": "USD", "status": o.Status, "gateway_status": o.GatewayStatus, "expires_at": o.ExpiresAt, "pay_link": link, "review_required": model.DirectSubscriptionReviewRequired(o.TradeNo), "creation_state": "ready", "sandbox": c.Sandbox}
}
func CreateAntomSession(ctx context.Context, o *model.AntomOrder, c *model.AntomConfig, clientIP string) (string, error) {
	if net.ParseIP(clientIP) == nil {
		return "", errors.New("invalid buyer IP address")
	}
	if o.Status != "pending" || o.GatewayStatus == "CANCEL_REQUESTED" || o.ExpiresAt <= common.GetTimestamp() {
		return "", errors.New("Antom payment window has ended")
	}
	ring, err := paymentsecret.Load()
	if err != nil {
		return "", err
	}
	binding := fmt.Sprintf("antom/order/%d/session", o.ID)
	if o.SessionCiphertext != "" {
		data, err := ring.Open(o.SessionCiphertext, binding)
		if err != nil {
			return "", err
		}
		checkoutURL, ok := strings.CutPrefix(data, "hosted:")
		if !ok {
			return "", errors.New("This payment session is no longer supported; check or cancel the existing order")
		}
		return checkoutURL, nil
	}
	value, err := decimal.NewFromString(o.Amount)
	if err != nil {
		return "", err
	}
	amount := AntomAmount{Currency: "USD", Value: value.Mul(decimal.NewFromInt(100)).StringFixed(0)}
	// Reconcile ambiguous network failures even when no session response arrives.
	if err := model.DB.Model(o).Where("status = ?", "pending").Update("next_check_at", common.GetTimestamp()+60).Error; err != nil {
		return "", err
	}
	returnURL, err := url.Parse(c.ReturnURL)
	if err != nil {
		return "", err
	}
	returnURL.Path = "/payment/antom/" + o.TradeNo
	returnURL.RawPath = ""
	returnURL.RawQuery = "hosted_return=1"
	payload := map[string]any{
		"productCode": "CASHIER_PAYMENT", "productScene": "CHECKOUT_PAYMENT", "paymentRequestId": o.TradeNo, "paymentAmount": amount,
		"order":              map[string]any{"referenceOrderId": o.TradeNo, "orderDescription": c.Description, "orderAmount": amount, "buyer": map[string]string{"referenceBuyerId": strconv.Itoa(o.UserID)}},
		"paymentFactor":      map[string]any{"isAuthorization": false, "captureMode": "AUTOMATIC"},
		"settlementStrategy": map[string]string{"settlementCurrency": c.SettlementCurrency},
		"paymentNotifyUrl":   c.NotifyBaseURL + "/api/user/antom/notify/" + o.TradeNo, "paymentRedirectUrl": returnURL.String(),
		"paymentSessionExpiryTime": time.Unix(o.ExpiresAt, 0).UTC().Format(time.RFC3339), "env": map[string]string{"terminalType": "WEB", "clientIp": clientIP},
	}
	response, err := CallAntom(ctx, c, "createPaymentSession", payload)
	if err != nil {
		return "", err
	}
	if response.Result.Status != "S" || response.Result.Code != "SUCCESS" || response.SessionID == "" || response.NormalURL == "" || len(response.NormalURL) > 16384 {
		if antomID.MatchString(response.Result.Code) {
			return "", fmt.Errorf("Antom session creation failed (%s)", response.Result.Code)
		}
		return "", errors.New("Antom did not create a payment session")
	}
	expiry, err := time.Parse(time.RFC3339, response.SessionExpiry)
	if err != nil || expiry.Unix() <= common.GetTimestamp() {
		return "", errors.New("invalid Antom session expiry")
	}
	checkoutURL, err := url.Parse(response.NormalURL)
	if err != nil || checkoutURL.Scheme != "https" || checkoutURL.Host != "checkout.antom.com" || checkoutURL.User != nil {
		return "", errors.New("invalid Antom hosted checkout URL")
	}
	// Store only hosted checkout URLs in the encrypted session envelope.
	data := "hosted:" + response.NormalURL
	sealed, err := ring.Seal(data, binding)
	if err != nil {
		return "", err
	}
	err = model.DB.Model(o).Where("status = ?", "pending").Updates(map[string]any{"session_ciphertext": sealed, "session_id": response.SessionID, "next_check_at": common.GetTimestamp() + 30}).Error
	return response.NormalURL, err
}
func ReconcileAntomOrder(ctx context.Context, trade string) error {
	o, c, err := model.GetAntomOrder(trade)
	if err != nil {
		return err
	}
	if o.Status == "paid" || o.Status == "success" {
		return model.CompleteAntomOrder(trade)
	}
	if o.Status != "pending" {
		return nil
	}
	if o.GatewayStatus == "CANCEL_REQUESTED" {
		_, err := CancelAntomOrder(ctx, o.TradeNo)
		return err
	}
	response, err := CallAntom(ctx, c, "inquiryPayment", map[string]string{"paymentRequestId": o.TradeNo})
	status := "QUERY_FAILED"
	if err == nil && response.Result.Status == "S" && response.Result.Code == "SUCCESS" {
		if response.PaymentRequestID != o.TradeNo {
			err = errors.New("Antom order identity mismatch")
		} else {
			expected, _ := decimal.NewFromString(o.Amount)
			if response.PaymentAmount.Currency != "USD" || response.PaymentAmount.Value != expected.Mul(decimal.NewFromInt(100)).StringFixed(0) {
				err = errors.New("Antom amount mismatch")
			} else {
				switch response.PaymentStatus {
				case "SUCCESS", "FAIL", "CANCELLED", "PROCESSING", "PENDING":
					status = response.PaymentStatus
				default:
					err = errors.New("unknown Antom payment status")
				}
			}
		}
	} else if err == nil {
		if response.Result.Code == "ORDER_NOT_EXIST" {
			// A checkout session can exist before the buyer submits a payment.
			status = "ORDER_NOT_EXIST"
		} else {
			err = errors.New("Antom query did not succeed")
			if antomID.MatchString(response.Result.Code) {
				status = "API_" + response.Result.Code
			}
		}
	}
	if status == "SUCCESS" {
		if !antomID.MatchString(response.PaymentID) {
			err = errors.New("invalid Antom payment ID")
			status = "QUERY_FAILED"
		}
		for _, transaction := range response.Transactions {
			if transaction.Type == "REFUND" && transaction.Status == "SUCCESS" {
				status = "REFUNDED"
				err = errors.New("Antom payment was refunded")
			}
			if transaction.Type == "CAPTURE" && (transaction.Status != "SUCCESS" || transaction.Amount != response.PaymentAmount) {
				status = "CAPTURE_PENDING"
				err = errors.New("Antom capture is not complete")
			}
		}
	}
	if status == "SUCCESS" && err == nil {
		if err = model.RecordAntomPayment(o, response.PaymentID); err != nil {
			return err
		}
		return model.CompleteAntomOrder(trade)
	}
	next := common.GetTimestamp() + 60
	if o.CreatedAt < common.GetTimestamp()-72*3600 {
		next = 0
	}
	updates := map[string]any{"gateway_status": status, "checked_at": common.GetTimestamp(), "next_check_at": next, "last_error": ""}
	if err != nil {
		updates["last_error"] = "verification_failed"
	}
	if status == "FAIL" || status == "CANCELLED" {
		return model.CloseAntomOrder(o.ID, status)
	}
	if saveErr := model.DB.Model(o).Where("status = ? AND gateway_status <> ?", "pending", "CANCEL_REQUESTED").Updates(updates).Error; saveErr != nil {
		return saveErr
	}
	return err
}
func RunAntomReconciliation(ctx context.Context) error {
	var orders []model.AntomOrder
	if err := model.DB.WithContext(ctx).Where("(status = ? AND next_check_at > 0 AND next_check_at <= ?) OR status = ? OR cache_pending = ? OR log_pending = ?", "pending", common.GetTimestamp(), "paid", true, true).Order("next_check_at, id").Limit(100).Find(&orders).Error; err != nil {
		return err
	}
	var result error
	for _, o := range orders {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		// CAS prevents multiple workers from querying one order at the same time.
		claimed := model.DB.Model(&model.AntomOrder{}).Where("id = ? AND next_check_at = ?", o.ID, o.NextCheckAt).Update("next_check_at", common.GetTimestamp()+120)
		if claimed.Error != nil {
			return claimed.Error
		}
		if claimed.RowsAffected == 0 {
			continue
		}
		if err := ReconcileAntomOrder(ctx, o.TradeNo); err != nil {
			result = errors.New("Antom reconciliation requires retry")
		}
	}
	return result
}

// Cancellation intent fences fulfillment before contacting the gateway. Unknown
// results retain the fence across restarts; a rejection requires explicit review before further attempts.
func CancelAntomOrder(ctx context.Context, trade string) (string, error) {
	o, c, err := model.GetAntomOrder(trade)
	if err != nil {
		return "", err
	}
	if o.Status == "success" {
		return "paid", nil
	}
	if o.Status == "expired" {
		return "closed", nil
	}
	if o.Status != "pending" {
		return "", errors.New("Antom payment already received; cancellation requires manual review")
	}
	if err := model.RequestAntomCancellation(o.ID); err != nil {
		return "", err
	}
	response, err := CallAntom(ctx, c, "cancel", map[string]string{"paymentRequestId": trade})
	if err != nil {
		return "closing", err
	}
	if response.PaymentRequestID != "" && response.PaymentRequestID != trade {
		return "closing", errors.New("Antom cancellation identity mismatch")
	}
	if response.Result.Status == "S" && response.Result.Code == "SUCCESS" {
		if err := model.CloseAntomOrder(o.ID, "CANCELLED"); err != nil {
			return "closing", err
		}
		return "closed", nil
	}
	if response.Result.Status == "F" {
		if err := model.DB.Model(o).Where("status = ? AND gateway_status = ?", "pending", "CANCEL_REQUESTED").Updates(map[string]any{"last_error": "cancellation_rejected", "next_check_at": 0}).Error; err != nil {
			return "", err
		}
		return "", fmt.Errorf("Antom cancellation rejected (%s)", response.Result.Code)
	}
	return "closing", nil
}
