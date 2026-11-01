package service

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
)

var partnerOAuthIdempotencyKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{16,64}$`)

type PartnerOAuthBalanceResponse struct {
	AccountID      string `json:"account_id"`
	BindingID      string `json:"binding_id"`
	Quota          int    `json:"quota"`
	UsedQuota      int    `json:"used_quota"`
	Amount         string `json:"amount"`
	Currency       string `json:"currency"`
	CurrencySymbol string `json:"currency_symbol"`
	QuotaPerUnit   string `json:"quota_per_unit"`
}

// PartnerOAuthDisplayCurrency returns the currency the site displays wallet
// amounts in, with its symbol and the rate from one USD. Token display has no
// currency of its own, so partners receive USD.
func PartnerOAuthDisplayCurrency() (currency, symbol string, usdRate decimal.Decimal) {
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		return "CNY", "¥", decimal.NewFromFloat(operation_setting.GetUsdToCurrencyRate(operation_setting.USDExchangeRate))
	case operation_setting.QuotaDisplayTypeCustom:
		return "CUSTOM", operation_setting.GetCurrencySymbol(), decimal.NewFromFloat(operation_setting.GetUsdToCurrencyRate(operation_setting.USDExchangeRate))
	default:
		return "USD", "$", decimal.NewFromInt(1)
	}
}

// PartnerWalletAmount is a wallet quota converted to the site display
// currency, as partners receive it.
type PartnerWalletAmount struct {
	Amount         string
	Currency       string
	CurrencySymbol string
	QuotaPerUnit   string
}

// ConvertPartnerWalletQuota converts wallet quota to a decimal-string amount
// in the site display currency, rounded to 6 places.
func ConvertPartnerWalletQuota(quota int) (*PartnerWalletAmount, error) {
	if common.QuotaPerUnit <= 0 {
		return nil, partnerOAuthErr(http.StatusServiceUnavailable, "temporarily_unavailable", "balance is unavailable")
	}
	currency, symbol, rate := PartnerOAuthDisplayCurrency()
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	amount := decimal.NewFromInt(int64(quota)).Div(quotaPerUnit).Mul(rate).Round(6)
	return &PartnerWalletAmount{Amount: amount.String(), Currency: currency, CurrencySymbol: symbol, QuotaPerUnit: quotaPerUnit.String()}, nil
}

func BuildPartnerOAuthBalance(principal *PartnerOAuthAccessPrincipal) (*PartnerOAuthBalanceResponse, error) {
	wallet, err := ConvertPartnerWalletQuota(principal.User.Quota)
	if err != nil {
		return nil, err
	}
	return &PartnerOAuthBalanceResponse{
		AccountID:      model.PartnerOAuthAccountID(principal.User.Id),
		BindingID:      principal.Binding.BindingId,
		Quota:          principal.User.Quota,
		UsedQuota:      principal.User.UsedQuota,
		Amount:         wallet.Amount,
		Currency:       wallet.Currency,
		CurrencySymbol: wallet.CurrencySymbol,
		QuotaPerUnit:   wallet.QuotaPerUnit,
	}, nil
}

// ValidatePartnerOAuthIdempotencyKey checks the Idempotency-Key header and
// returns the digest that is stored instead of the raw key.
func ValidatePartnerOAuthIdempotencyKey(raw string) (string, error) {
	if !partnerOAuthIdempotencyKeyPattern.MatchString(raw) {
		return "", partnerOAuthErr(http.StatusBadRequest, "invalid_request", "Idempotency-Key header must be 16-64 characters of A-Z, a-z, 0-9, '-' or '_'")
	}
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:]), nil
}

// PartnerOAuthPaymentReturnURL returns where the Epay browser return should
// send the payer of a partner order, or "" to stay on the site. The return URL
// was checked when the order was placed; it is used only while the binding and
// client are still active and its origin is still registered, so a partner
// that was revoked, disabled or reconfigured since then is skipped.
func PartnerOAuthPaymentReturnURL(topUpID int) string {
	order, err := model.GetPartnerOAuthPaymentOrderByTopUpID(topUpID)
	if err != nil || order.ReturnURL == "" {
		return ""
	}
	binding, err := model.GetPartnerOAuthBindingByBindingID(order.BindingId)
	if err != nil || binding.Status != model.PartnerOAuthBindingStatusActive || binding.ExpiresAt <= time.Now().Unix() {
		return ""
	}
	client, err := model.GetPartnerOAuthClientByClientID(order.ClientId)
	if err != nil || client.Status != model.PartnerOAuthClientStatusEnabled {
		return ""
	}
	if ValidatePartnerOAuthPaymentReturnURL(client, order.ReturnURL) != nil {
		return ""
	}
	return order.ReturnURL
}

// ValidatePartnerOAuthPaymentReturnURL accepts a URL only when its origin is
// the origin of one of the client's registered redirect URIs, so the payment
// return can never become an open redirect. Loopback redirects of public
// clients match on any port, as they do for authorization.
func ValidatePartnerOAuthPaymentReturnURL(client *model.PartnerOAuthClient, raw string) error {
	invalid := partnerOAuthErr(http.StatusBadRequest, "invalid_return_url", "return_url must use the origin of a registered redirect URI")
	if len(raw) > 512 {
		return invalid
	}
	parsed, err := url.Parse(raw)
	if err != nil || !parsed.IsAbs() || parsed.Fragment != "" || parsed.User != nil || parsed.Host == "" {
		return invalid
	}
	registered, err := ParsePartnerOAuthRedirectURIs(client.RedirectURIs)
	if err != nil {
		return invalid
	}
	publicClient := client.TokenAuthMethod == model.PartnerOAuthTokenAuthMethodNone
	for _, item := range registered {
		allowed, err := url.Parse(item)
		if err != nil || !strings.EqualFold(allowed.Scheme, parsed.Scheme) {
			continue
		}
		if strings.EqualFold(allowed.Host, parsed.Host) {
			return nil
		}
		if publicClient && allowed.Scheme == "http" && isLoopbackHost(allowed.Hostname()) && allowed.Hostname() == parsed.Hostname() {
			return nil
		}
	}
	return invalid
}
