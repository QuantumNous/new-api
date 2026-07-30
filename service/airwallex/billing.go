package airwallex

import (
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
	// SubscriptionData mirrors the create request's subscription_data. In
	// SUBSCRIPTION mode Airwallex may surface our trade_no here (under
	// subscription_data.metadata) rather than on the top-level checkout metadata.
	SubscriptionData struct {
		Metadata map[string]string `json:"metadata"`
	} `json:"subscription_data"`
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

type BillingSubscription struct {
	Id                string            `json:"id"`
	BillingCustomerId string            `json:"billing_customer_id"`
	Status            string            `json:"status"` // PENDING|IN_TRIAL|ACTIVE|UNPAID|CANCELLED
	Metadata          map[string]string `json:"metadata"`
	// NextBillingAt is when the next charge lands (RFC3339 with a numeric zone,
	// e.g. 2026-08-30T06:44:43+0000). A deferred plan switch takes effect then,
	// so this is what the portal shows the customer as their start date.
	NextBillingAt string `json:"next_billing_at"`
}

func GetBillingSubscription(id string) (*BillingSubscription, error) {
	var sub BillingSubscription
	if err := do(http.MethodGet, "/api/v1/billing/subscriptions/"+url.PathEscape(id), nil, &sub); err != nil {
		return nil, err
	}
	return &sub, nil
}

func ListBillingSubscriptions(billingCustomerId, status string) ([]BillingSubscription, error) {
	var page struct {
		Items []BillingSubscription `json:"items"`
	}
	path := "/api/v1/billing/subscriptions?billing_customer_id=" + url.QueryEscape(billingCustomerId) + "&page_size=20"
	if status != "" {
		path += "&status=" + url.QueryEscape(status)
	}
	if err := do(http.MethodGet, path, nil, &page); err != nil {
		return nil, err
	}
	return page.Items, nil
}

// CancelBillingSubscription stops future cycles. proration_behavior is REQUIRED
// by the Billing cancel endpoint; JINN policy is "NONE" (no cash refund, access
// runs to period end via the engine's ExpireDueSubscriptions).
func CancelBillingSubscription(id, requestId, prorationBehavior string) error {
	if prorationBehavior == "" {
		prorationBehavior = "NONE"
	}
	body := map[string]any{"request_id": requestId, "proration_behavior": prorationBehavior}
	return do(http.MethodPost, "/api/v1/billing/subscriptions/"+url.PathEscape(id)+"/cancel", body, nil)
}

// BillingSubscriptionItem is one line of a managed subscription. The
// subscription object itself carries no items array — they come from the
// separate /items endpoint.
type BillingSubscriptionItem struct {
	Id    string `json:"id"`
	Price struct {
		Id string `json:"id"`
	} `json:"price"`
}

// GetBillingSubscriptionItems lists the subscription's current line items. Used
// to learn which plan a live subscription is actually on (its price id), which
// is authoritative over any locally stored plan id.
func GetBillingSubscriptionItems(subId string) ([]BillingSubscriptionItem, error) {
	var page struct {
		Items []BillingSubscriptionItem `json:"items"`
	}
	if err := do(http.MethodGet, "/api/v1/billing/subscriptions/"+url.PathEscape(subId)+"/items", nil, &page); err != nil {
		return nil, err
	}
	return page.Items, nil
}

type updateBillingSubscriptionItem struct {
	Id       string `json:"id,omitempty"`
	PriceId  string `json:"price_id,omitempty"`
	Quantity int    `json:"quantity,omitempty"`
	Deleted  bool   `json:"deleted,omitempty"`
}

// SwitchBillingSubscriptionPrice schedules a live subscription onto newPriceId
// at its next billing date. Nothing is charged now, no credit is issued, and the
// billing anchor is preserved — the customer keeps the period they already paid
// for and is charged the new price when it ends.
//
// This deliberately does NOT charge immediately, after two attempts that did:
//
//   - IMMEDIATE_CHARGE_AND_RESET_CYCLE + PRORATED charges the new price in full
//     and issues the unused time as a credit note that REFUNDS to the card
//     (Airwallex does not discount the new invoice the way Stripe does).
//     Verified live 2026-07-30: the refund failed with "amount_above_limit"
//     because refunds draw on the merchant's CNY balance, which was empty. The
//     customer was left out of pocket with no signal to us.
//   - Charging the prorated difference as a one-off and suppressing the next
//     cycle with trial_end_at does not work either: the Billing update endpoint
//     accepts trial_end_at with a 200 and silently ignores it (verified live
//     2026-07-30 — next_billing_at unchanged), so that route would double-charge.
//
// Deferring needs neither a refund nor a discount, so it has no failure mode:
// the customer loses nothing and no money moves until the date they already
// expected to be billed on.
//
// Airwallex forbids mutating price_id on an existing item, so the swap is
// delete-old + add-new inside ONE update call (a single call keeps it atomic —
// two calls could leave the subscription itemless or double-priced).
func SwitchBillingSubscriptionPrice(subId, requestId, oldItemId, newPriceId string) error {
	body := map[string]any{
		"request_id": requestId,
		"items": []updateBillingSubscriptionItem{
			{Id: oldItemId, Deleted: true},
			{PriceId: newPriceId, Quantity: 1},
		},
		"billing_action":         "DEFER_CHARGE_AND_KEEP_CYCLE",
		"default_proration_mode": "NONE",
	}
	return do(http.MethodPost, "/api/v1/billing/subscriptions/"+url.PathEscape(subId)+"/update", body, nil)
}
