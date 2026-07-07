package airwallex

import (
	"fmt"
	"net/http"
	"net/url"
)

// --- Billing product (x-api-version 2026-02-27) ---
// The Billing generation is separate from the legacy Subscriptions API. Its
// checkouts create the managed subscription server-side, so a single
// billing_checkout.completed webhook replaces the legacy two-step
// payment_consent.verified + subscription.active flow.

type BillingCustomer struct {
	Id       string            `json:"id"`
	Email    string            `json:"email"`
	Metadata map[string]string `json:"metadata"`
}

// CreateBillingCustomer creates a bcus_ customer. The Billing customers list
// endpoint cannot be filtered by merchant_customer_id (unlike pa/customers), so
// callers MUST persist the returned Id (see model.SaveAirwallexBillingCustomerId).
func CreateBillingCustomer(requestId, email string, metadata map[string]string) (*BillingCustomer, error) {
	body := map[string]any{"request_id": requestId}
	if email != "" {
		body["email"] = email
	}
	if len(metadata) > 0 {
		body["metadata"] = metadata
	}
	var cust BillingCustomer
	if err := do(http.MethodPost, "/api/v1/billing/billing_customers/create", body, &cust); err != nil {
		return nil, err
	}
	return &cust, nil
}

type BillingCheckoutLineItem struct {
	PriceId  string `json:"price_id"`
	Quantity int    `json:"quantity,omitempty"`
}

type CreateBillingCheckoutRequest struct {
	RequestId         string                    `json:"request_id"`
	Mode              string                    `json:"mode"`    // SUBSCRIPTION | PAYMENT | SETUP
	UiMode            string                    `json:"ui_mode"` // HOSTED
	BillingCustomerId string                    `json:"billing_customer_id,omitempty"`
	Currency          string                    `json:"currency,omitempty"`
	Locale            string                    `json:"locale,omitempty"` // AUTO | EN | ZH
	LineItems         []BillingCheckoutLineItem `json:"line_items,omitempty"`
	PaymentOptions    map[string]any            `json:"payment_options,omitempty"`
	SubscriptionData  map[string]any            `json:"subscription_data,omitempty"`
	Metadata          map[string]string         `json:"metadata,omitempty"`
	SuccessUrl        string                    `json:"success_url,omitempty"`
	ReturnUrl         string                    `json:"return_url,omitempty"`
}

type BillingCheckout struct {
	Id             string            `json:"id"`
	Status         string            `json:"status"` // ACTIVE|COMPLETED|CANCELLED|EXPIRED
	Url            string            `json:"url"`    // present only when status ACTIVE
	SubscriptionId string            `json:"subscription_id"`
	Metadata       map[string]string `json:"metadata"`
}

func CreateBillingCheckout(req *CreateBillingCheckoutRequest) (*BillingCheckout, error) {
	var out BillingCheckout
	if err := do(http.MethodPost, "/api/v1/billing/billing_checkouts/create", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetBillingCheckout re-fetches a checkout by id (webhook objects may be slim).
func GetBillingCheckout(id string) (*BillingCheckout, error) {
	var out BillingCheckout
	if err := do(http.MethodGet, "/api/v1/billing/billing_checkouts/"+url.PathEscape(id), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

var _ = fmt.Sprintf // keep fmt imported for Task 3 additions
