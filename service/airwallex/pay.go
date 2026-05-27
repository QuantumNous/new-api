package airwallex

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type CreatePayParams struct {
	Biz               string
	Currency          string
	CountryCode       string
	PaymentMethodType string
	Flow              string
	Amount            float64
	MerchantOrderID   string
	ReturnURL         string
}

type CreatePayResult struct {
	PaymentIntentID string
	ClientSecret    string
	NextAction      *NextAction
	CreateRequestID string
	SanitizedRaw    string
}

func CreatePay(ctx context.Context, p CreatePayParams) (*CreatePayResult, error) {
	cfg := operation_setting.GetAirwallexSetting()
	acct, ok := cfg.Accounts[p.Biz]
	if !ok {
		return nil, fmt.Errorf("unknown biz: %s", p.Biz)
	}
	if !acct.Enabled {
		return nil, fmt.Errorf("biz %s is disabled", p.Biz)
	}
	if p.MerchantOrderID == "" {
		return nil, fmt.Errorf("missing merchant_order_id")
	}

	client := GetOrCreateClient(p.Biz, acct, cfg)
	createRID := common.GetUUID()
	pi, err := client.CreatePaymentIntent(ctx, CreatePaymentIntentRequest{
		RequestID:       createRID,
		Amount:          p.Amount,
		Currency:        strings.ToUpper(p.Currency),
		MerchantOrderID: p.MerchantOrderID,
		ReturnURL:       p.ReturnURL,
	})
	if err != nil {
		return nil, fmt.Errorf("airwallex create payment_intent: %w", err)
	}

	res := &CreatePayResult{
		PaymentIntentID: pi.ID,
		ClientSecret:    pi.ClientSecret,
		CreateRequestID: createRID,
	}

	if p.Flow == "redirect" {
		confirm, err := client.ConfirmPaymentIntent(ctx, pi.ID, ConfirmPaymentIntentRequest{
			RequestID:     common.GetUUID(),
			PaymentMethod: buildConfirmPaymentMethod(p.PaymentMethodType),
		})
		if err != nil {
			return nil, fmt.Errorf("airwallex confirm payment_intent: %w", err)
		}
		if confirm.ClientSecret != "" {
			res.ClientSecret = confirm.ClientSecret
		}
		res.NextAction = &confirm.NextAction
	}

	raw := map[string]any{
		"biz":                 p.Biz,
		"currency":            strings.ToUpper(p.Currency),
		"country_code":        strings.ToUpper(p.CountryCode),
		"payment_method_type": strings.ToLower(p.PaymentMethodType),
		"flow":                p.Flow,
		"amount":              p.Amount,
		"merchant_order_id":   p.MerchantOrderID,
		"payment_intent_id":   pi.ID,
		"create_request_id":   createRID,
	}
	if res.NextAction != nil && res.NextAction.Type != "" {
		raw["next_action_type"] = res.NextAction.Type
	}
	if b, err := json.Marshal(raw); err == nil {
		res.SanitizedRaw = string(b)
	}
	return res, nil
}

func buildConfirmPaymentMethod(methodType string) map[string]any {
	normalized := normalizeAirwallexMethodID(methodType)
	paymentMethod := map[string]any{"type": normalized}
	switch normalized {
	case "alipaycn", "alipayhk":
		paymentMethod[normalized] = map[string]any{}
	}
	return paymentMethod
}
