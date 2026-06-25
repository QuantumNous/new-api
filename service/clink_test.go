package service

import "testing"

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
