package airwallex

import (
	"net/http"
	"strings"
	"testing"
)

func TestBillingPathSendsBillingVersion(t *testing.T) {
	var logins int32
	var gotVersion, gotPath string
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotVersion = r.Header.Get("x-api-version")
		w.Write([]byte(`{"id":"bcus_1"}`))
	})
	if _, err := CreateBillingCustomer("req-b1", "a@b.c", map[string]string{"new_api_user_id": "7"}); err != nil {
		t.Fatal(err)
	}
	if gotPath != "/api/v1/billing/billing_customers/create" {
		t.Fatalf("wrong path %s", gotPath)
	}
	if gotVersion != billingApiVersion {
		t.Fatalf("billing path must send %s, got %q", billingApiVersion, gotVersion)
	}
}

func TestCreateBillingCustomerReturnsId(t *testing.T) {
	var logins int32
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"id":"bcus_9","email":"a@b.c","metadata":{"new_api_user_id":"7"}}`))
	})
	cust, err := CreateBillingCustomer("req-b1", "a@b.c", map[string]string{"new_api_user_id": "7"})
	if err != nil {
		t.Fatal(err)
	}
	if cust.Id != "bcus_9" {
		t.Fatalf("want bcus_9, got %s", cust.Id)
	}
}

func TestCreateBillingCheckoutSubscriptionShape(t *testing.T) {
	var logins int32
	var gotPath, gotBody string
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		buf := make([]byte, r.ContentLength)
		r.Body.Read(buf)
		gotBody = string(buf)
		w.Write([]byte(`{"id":"co_1","status":"ACTIVE","url":"https://checkout.airwallex.com/pay?s=jwt"}`))
	})
	co, err := CreateBillingCheckout(&CreateBillingCheckoutRequest{
		RequestId:         "sub_ref_x-co",
		Mode:              "SUBSCRIPTION",
		UiMode:            "HOSTED",
		BillingCustomerId: "bcus_9",
		LineItems:         []BillingCheckoutLineItem{{PriceId: "pri_pro", Quantity: 1}},
		PaymentOptions:    map[string]any{"payment_method_types": []string{"card"}},
		Metadata:          map[string]string{"trade_no": "sub_ref_x", "new_api_user_id": "7"},
		Locale:            "AUTO",
		SuccessUrl:        "https://account.jinn.ccwu.cc:8444/return",
		ReturnUrl:         "https://account.jinn.ccwu.cc:8444/return",
	})
	if err != nil {
		t.Fatal(err)
	}
	if gotPath != "/api/v1/billing/billing_checkouts/create" {
		t.Fatalf("wrong path %s", gotPath)
	}
	if co.Url == "" || co.Status != "ACTIVE" {
		t.Fatalf("unexpected checkout %+v", co)
	}
	for _, needle := range []string{`"mode":"SUBSCRIPTION"`, `"ui_mode":"HOSTED"`, `"billing_customer_id":"bcus_9"`, `"price_id":"pri_pro"`, `"trade_no":"sub_ref_x"`, `"payment_method_types":["card"]`} {
		if !strings.Contains(gotBody, needle) {
			t.Fatalf("body missing %s: %s", needle, gotBody)
		}
	}
}

func TestCancelBillingSubscriptionSendsRequiredFields(t *testing.T) {
	var logins int32
	var gotPath, gotBody string
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		buf := make([]byte, r.ContentLength)
		r.Body.Read(buf)
		gotBody = string(buf)
		w.Write([]byte(`{}`))
	})
	if err := CancelBillingSubscription("sub_1", "cancel-1", ""); err != nil {
		t.Fatal(err)
	}
	if gotPath != "/api/v1/billing/subscriptions/sub_1/cancel" {
		t.Fatalf("wrong path %s", gotPath)
	}
	for _, needle := range []string{`"proration_behavior":"NONE"`, `"request_id":"cancel-1"`} {
		if !strings.Contains(gotBody, needle) {
			t.Fatalf("body missing %s: %s", needle, gotBody)
		}
	}
}

func TestListBillingSubscriptionsFiltersByCustomer(t *testing.T) {
	var logins int32
	var gotQuery string
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		w.Write([]byte(`{"items":[{"id":"sub_1","billing_customer_id":"bcus_9","status":"ACTIVE"}]}`))
	})
	subs, err := ListBillingSubscriptions("bcus_9", "ACTIVE")
	if err != nil {
		t.Fatal(err)
	}
	if len(subs) != 1 || subs[0].Id != "sub_1" {
		t.Fatalf("unexpected subs %+v", subs)
	}
	if !strings.Contains(gotQuery, "billing_customer_id=bcus_9") || !strings.Contains(gotQuery, "status=ACTIVE") {
		t.Fatalf("query missing filters: %s", gotQuery)
	}
}

func TestGetBillingSubscriptionItemsParsesPriceId(t *testing.T) {
	var logins int32
	var gotPath string
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Write([]byte(`{"items":[{"id":"sit_1","price":{"id":"pri_plus_month"}}]}`))
	})
	items, err := GetBillingSubscriptionItems("sub_9")
	if err != nil {
		t.Fatal(err)
	}
	if gotPath != "/api/v1/billing/subscriptions/sub_9/items" {
		t.Fatalf("wrong path %s", gotPath)
	}
	if len(items) != 1 || items[0].Id != "sit_1" || items[0].Price.Id != "pri_plus_month" {
		t.Fatalf("unexpected items %+v", items)
	}
}

func TestSwitchBillingSubscriptionPriceSendsProrationShape(t *testing.T) {
	var logins int32
	var gotPath, gotBody string
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		buf := make([]byte, r.ContentLength)
		r.Body.Read(buf)
		gotBody = string(buf)
		w.Write([]byte(`{"id":"sub_9","status":"ACTIVE"}`))
	})
	if err := SwitchBillingSubscriptionPrice("sub_9", "req-1", "sit_1", "pri_plus_year"); err != nil {
		t.Fatal(err)
	}
	if gotPath != "/api/v1/billing/subscriptions/sub_9/update" {
		t.Fatalf("wrong path %s", gotPath)
	}
	for _, want := range []string{
		`"billing_action":"IMMEDIATE_CHARGE_AND_RESET_CYCLE"`,
		`"default_proration_mode":"PRORATED"`,
		`"id":"sit_1"`,
		`"deleted":true`,
		`"price_id":"pri_plus_year"`,
	} {
		if !strings.Contains(gotBody, want) {
			t.Fatalf("body missing %s: %s", want, gotBody)
		}
	}
}
