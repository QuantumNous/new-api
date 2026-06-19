package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestDecideAirwallexAutoTopup(t *testing.T) {
	saved := common.QuotaPerUnit
	defer func() { common.QuotaPerUnit = saved }()
	common.QuotaPerUnit = 500000 // SellMultiplier default 5 → 1,000,000 units = A$10

	base := airwallexAutoTopupPreconditions{
		Enabled: true, FlagEnabled: true, Amount: 1000000, Threshold: 2000000,
		Quota: 100000, ConsentID: "cst_x", MinChargeCents: 500, RedisEnabled: true,
	}
	// happy path → A$10.00
	if ok, amt, reason := decideAirwallexAutoTopup(base); !ok || amt != 10.0 || reason != "" {
		t.Fatalf("happy path: ok=%v amt=%v reason=%q", ok, amt, reason)
	}
	// master flag off
	p := base
	p.FlagEnabled = false
	if ok, _, reason := decideAirwallexAutoTopup(p); ok || reason != "airwallex_autotopup_disabled" {
		t.Fatalf("flag off: ok=%v reason=%q", ok, reason)
	}
	// no consent
	p = base
	p.ConsentID = ""
	if ok, _, reason := decideAirwallexAutoTopup(p); ok || reason != "no_airwallex_consent" {
		t.Fatalf("no consent: ok=%v reason=%q", ok, reason)
	}
	// quota above threshold
	p = base
	p.Quota = 3000000
	if ok, _, reason := decideAirwallexAutoTopup(p); ok || reason != "quota_above_threshold" {
		t.Fatalf("above threshold: ok=%v reason=%q", ok, reason)
	}
	// below min charge (200000 units = A$2 < A$5 min)
	p = base
	p.Amount = 200000
	if ok, _, reason := decideAirwallexAutoTopup(p); ok || reason != "amount_below_minimum" {
		t.Fatalf("below min: ok=%v reason=%q", ok, reason)
	}
}

func TestBuildAirwallexCreateBody(t *testing.T) {
	b := buildAirwallexCreateBody(airwallexChargeRequest{
		Amount: 5.0, Currency: "AUD", CustomerID: "cus_x", RequestID: "ref_1",
	})
	if b["amount"] != 5.0 || b["currency"] != "AUD" || b["customer_id"] != "cus_x" {
		t.Fatalf("create body missing fields: %+v", b)
	}
	if b["merchant_order_id"] != "ref_1" || b["request_id"] != "ref_1-create" {
		t.Fatalf("create body bad ids: %+v", b)
	}
}

func TestBuildAirwallexConfirmBody(t *testing.T) {
	b := buildAirwallexConfirmBody(airwallexChargeRequest{
		ConsentID: "cst_x", PaymentMethod: "pm_x", OriginalTxnID: "txn_x", RequestID: "ref_1",
	})
	if b["payment_consent_id"] != "cst_x" {
		t.Fatalf("missing consent id: %+v", b)
	}
	if b["triggered_by"] != "merchant" {
		t.Fatalf("off-session charge must be merchant-triggered: %+v", b)
	}
	rec, ok := b["external_recurring_data"].(map[string]interface{})
	if !ok || rec["merchant_trigger_reason"] != "unscheduled" || rec["original_transaction_id"] != "txn_x" {
		t.Fatalf("bad external_recurring_data: %+v", b["external_recurring_data"])
	}
	pm, ok := b["payment_method"].(map[string]interface{})
	if !ok || pm["id"] != "pm_x" {
		t.Fatalf("bad payment_method: %+v", b["payment_method"])
	}

	// without original txn / pm: those keys are simply absent (no nil leaks)
	b2 := buildAirwallexConfirmBody(airwallexChargeRequest{ConsentID: "cst_y", RequestID: "r2"})
	if _, has := b2["payment_method"]; has {
		t.Fatalf("payment_method should be absent when empty")
	}
	rec2 := b2["external_recurring_data"].(map[string]interface{})
	if _, has := rec2["original_transaction_id"]; has {
		t.Fatalf("original_transaction_id should be absent when empty")
	}
}
