package service

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestVerifyClinkWebhookSignature(t *testing.T) {
	t.Setenv("CLINK_WEBHOOK_SECRET", "whsec_test")

	body := `{"id":"evt_1","type":"order.succeeded"}`
	ts := "1710000000000"
	sig := computeClinkWebhookSignature("whsec_test", ts, body)

	if !VerifyClinkWebhookSignature(ts, sig, body) {
		t.Fatalf("expected valid clink webhook signature")
	}
	if VerifyClinkWebhookSignature(ts, "bad-signature", body) {
		t.Fatalf("expected invalid clink webhook signature to fail")
	}
}

func TestClinkCheckoutDefaultPriceDataList(t *testing.T) {
	req := &ClinkCheckoutCreateRequest{
		OriginalAmount:   10.5,
		OriginalCurrency: "USD",
	}
	if len(req.PriceDataList) == 0 {
		req.PriceDataList = []ClinkPriceData{{
			Name:       "APIMaster.ai balance top-up",
			Quantity:   1,
			UnitAmount: req.OriginalAmount,
			Currency:   req.OriginalCurrency,
		}}
	}
	if len(req.PriceDataList) != 1 || req.PriceDataList[0].UnitAmount != 10.5 {
		t.Fatalf("unexpected priceDataList: %+v", req.PriceDataList)
	}
}

func TestDecodeClinkAPIEnvelope(t *testing.T) {
	body := []byte(`{"code":200,"msg":"Success","data":{"sessionId":"sess_test","paymentStatus":"paid","merchantReferenceId":"CLINK-1-1-abc","amountTotal":1}}`)
	var session ClinkCheckoutSessionDetail
	if err := decodeClinkAPIEnvelope(body, &session); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if session.SessionID != "sess_test" || session.PaymentStatus != "paid" {
		t.Fatalf("unexpected session: %+v", session)
	}
}

func TestDecodeClinkWebhookEventAcceptsCreatedTimestampVariants(t *testing.T) {
	tests := []string{
		`{"id":"evt_string","type":"order.succeeded","created":"2026-07-22T04:54:15Z","data":{}}`,
		`{"id":"evt_number","type":"order.succeeded","created":1784696054532,"data":{}}`,
	}
	for _, body := range tests {
		var event ClinkWebhookEvent
		if err := common.Unmarshal([]byte(body), &event); err != nil {
			t.Fatalf("decode event failed for %s: %v", body, err)
		}
		if event.ID == "" || len(event.Created) == 0 {
			t.Fatalf("unexpected event: %+v", event)
		}
	}
}

func TestDecodeClinkWebhookDataSupportsProductionObjectWrapper(t *testing.T) {
	data := json.RawMessage(`{"object":{"orderId":"order_1","merchantReferenceId":"CLINK-1","status":"success","amountSubtotal":7.5,"amountTotal":139659,"originalCurrency":"USD","paymentCurrency":"IDR"}}`)
	var order ClinkOrderWebhookData
	if err := DecodeClinkWebhookData(data, &order); err != nil {
		t.Fatalf("decode wrapped data failed: %v", err)
	}
	if order.MerchantReferenceID != "CLINK-1" || order.AmountSubtotal != 7.5 || order.AmountTotal != 139659 {
		t.Fatalf("unexpected order: %+v", order)
	}
}

func TestDecodeClinkWebhookDataSupportsDocumentedDirectPayload(t *testing.T) {
	data := json.RawMessage(`{"orderId":"order_1","merchantReferenceId":"CLINK-1","status":"success","amountTotal":7.5,"originalCurrency":"USD","paymentCurrency":"USD"}`)
	var order ClinkOrderWebhookData
	if err := DecodeClinkWebhookData(data, &order); err != nil {
		t.Fatalf("decode direct data failed: %v", err)
	}
	if order.MerchantReferenceID != "CLINK-1" || order.AmountTotal != 7.5 {
		t.Fatalf("unexpected order: %+v", order)
	}
}

func TestClinkAmountForValidation(t *testing.T) {
	tests := []struct {
		name                              string
		subtotal, total                   float64
		originalCurrency, paymentCurrency string
		want                              float64
	}{
		{name: "localized payment", subtotal: 7.5, total: 139659, originalCurrency: "USD", paymentCurrency: "IDR", want: 7.5},
		{name: "same currency", subtotal: 10, total: 9, originalCurrency: "USD", paymentCurrency: "USD", want: 9},
		{name: "session total omitted", subtotal: 7.5, originalCurrency: "USD", want: 7.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ClinkAmountForValidation(tt.subtotal, tt.total, tt.originalCurrency, tt.paymentCurrency)
			if got != tt.want {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}
