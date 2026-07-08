package airwallex

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

func mockServer(t *testing.T, loginCount *int32, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/authentication/login" {
			if r.Header.Get("x-client-id") != "cid" || r.Header.Get("x-api-key") != "key" {
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"code":"credentials_invalid","message":"UNAUTHORIZED"}`))
				return
			}
			atomic.AddInt32(loginCount, 1)
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"token":"tok-1"}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer tok-1" {
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"code":"unauthorized","message":"Insufficient permissions"}`))
			return
		}
		handler(w, r)
	}))
	prevBase := setting.AirwallexApiBase
	setting.AirwallexApiBase = srv.URL
	setting.AirwallexClientId = "cid"
	setting.AirwallexApiKey = "key"
	ResetTokenCache()
	t.Cleanup(func() {
		setting.AirwallexApiBase = prevBase
		ResetTokenCache()
		srv.Close()
	})
	return srv
}

func TestTokenCachedAcrossCalls(t *testing.T) {
	var logins int32
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"id":"cus_1","merchant_customer_id":"7"}`))
	})
	for i := 0; i < 3; i++ {
		if _, err := CreateCustomer("req-1", "7", "a@b.c"); err != nil {
			t.Fatal(err)
		}
	}
	if logins != 1 {
		t.Fatalf("expected 1 login, got %d", logins)
	}
}

func TestLoginFailureSurfaced(t *testing.T) {
	var logins int32
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {})
	setting.AirwallexApiKey = "wrong"
	ResetTokenCache()
	_, err := CreateCustomer("req-1", "7", "")
	if err == nil || !strings.Contains(err.Error(), "login failed") {
		t.Fatalf("expected login failure, got %v", err)
	}
	setting.AirwallexApiKey = "key"
}

func TestAPIErrorMapped(t *testing.T) {
	var logins int32
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"code":"validation_error","message":"customer_id is invalid"}`))
	})
	_, err := CreateCustomer("r", "bad", "")
	if err == nil || !strings.Contains(err.Error(), "customer_id is invalid") || !strings.Contains(err.Error(), "validation_error") {
		t.Fatalf("expected mapped api error, got %v", err)
	}
}

func TestActiveMethodsCachedAndStaleServed(t *testing.T) {
	var logins int32
	var calls int32
	mockServer(t, &logins, func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) > 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Write([]byte(`{"items":[{"name":"card"},{"name":"applepay"},{"name":"googlepay"}]}`))
	})
	activeMethods.names = nil // reset package cache
	m, err := ActivePaymentMethodNames()
	if err != nil || !m["card"] || m["wechatpay"] {
		t.Fatalf("unexpected %v %v", m, err)
	}
	activeMethods.fetched = activeMethods.fetched.Add(-11 * 60 * 1e9) // expire cache
	m2, err := ActivePaymentMethodNames()
	if err != nil || !m2["applepay"] {
		t.Fatalf("expected stale-serve on failure, got %v %v", m2, err)
	}
}

func TestRecurringCheckoutURL(t *testing.T) {
	u := RecurringCheckoutURL("sec%1", "cus_1", "CNY", "https://ok", "https://no")
	if !strings.HasPrefix(u, "https://checkout.airwallex.com/#/standalone/recurring?") {
		t.Fatalf("bad prefix: %s", u)
	}
	for _, needle := range []string{"mode=recurring", "client_secret=sec%251", "customer_id=cus_1", "currency=CNY"} {
		if !strings.Contains(u, needle) {
			t.Fatalf("url missing %s: %s", needle, u)
		}
	}
	q, err := url.ParseQuery(strings.SplitN(u, "?", 2)[1])
	if err != nil {
		t.Fatalf("unparseable query: %v", err)
	}
	var ro map[string]string
	if err := common.Unmarshal([]byte(q.Get("recurringOptions")), &ro); err != nil {
		t.Fatalf("recurringOptions not JSON: %v", err)
	}
	if ro["next_triggered_by"] != "merchant" || ro["merchant_trigger_reason"] != "scheduled" || ro["currency"] != "CNY" {
		t.Fatalf("bad recurringOptions: %v", ro)
	}
}
