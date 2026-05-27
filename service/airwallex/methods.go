package airwallex

import (
	"context"
	"strings"
)

type AvailableMethod struct {
	Type        string `json:"type"`
	UIGroup     string `json:"ui_group"`
	Flow        string `json:"flow"`
	DisplayName string `json:"display_name"`
}

func GetAvailableMethods(ctx context.Context, biz, currency, countryCode string) ([]AvailableMethod, error) {
	types, err := GetPaymentMethodTypes(ctx, biz, currency, countryCode)
	if err != nil {
		return nil, err
	}

	out := make([]AvailableMethod, 0, len(types))
	for _, item := range types {
		id := airwallexMethodID(item)
		if id == "" || isTemporarilyHiddenMethod(id) {
			continue
		}
		out = append(out, AvailableMethod{
			Type:        id,
			UIGroup:     methodUIGroup(id),
			Flow:        methodFlow(id),
			DisplayName: methodDisplayName(id),
		})
	}
	return out, nil
}

func airwallexMethodID(item PaymentMethodType) string {
	id := strings.TrimSpace(item.Type)
	if id == "" {
		id = strings.TrimSpace(item.Name)
	}
	return normalizeAirwallexMethodID(id)
}

func normalizeAirwallexMethodID(id string) string {
	switch strings.ToLower(strings.TrimSpace(id)) {
	case "alipay":
		return "alipaycn"
	default:
		return strings.ToLower(strings.TrimSpace(id))
	}
}

// NormalizePaymentMethodID converts wallet-facing aliases to Airwallex API identifiers.
func NormalizePaymentMethodID(id string) string {
	return normalizeAirwallexMethodID(id)
}

func isTemporarilyHiddenMethod(id string) bool {
	switch strings.ToLower(strings.TrimSpace(id)) {
	case "applepay", "apple_pay":
		return true
	default:
		return false
	}
}

func methodUIGroup(id string) string {
	switch id {
	case "alipaycn", "alipayhk":
		return "redirect"
	case "googlepay", "google_pay":
		return "wallet"
	case "card", "cards", "unionpay":
		return "card"
	default:
		return "other"
	}
}

func methodFlow(id string) string {
	switch id {
	case "googlepay", "google_pay":
		return "wallet"
	case "card", "cards", "unionpay":
		return "card"
	default:
		return "redirect"
	}
}

func methodDisplayName(id string) string {
	switch id {
	case "alipaycn":
		return "Alipay"
	case "alipayhk":
		return "Alipay HK"
	case "googlepay", "google_pay":
		return "Google Pay"
	case "unionpay":
		return "UnionPay"
	case "cards", "card":
		return "Card"
	default:
		s := strings.ReplaceAll(id, "_", " ")
		if s == "" {
			return ""
		}
		return strings.ToUpper(s[:1]) + s[1:]
	}
}
