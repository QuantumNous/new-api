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
