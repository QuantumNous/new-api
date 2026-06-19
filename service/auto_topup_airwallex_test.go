package service

import "testing"

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
