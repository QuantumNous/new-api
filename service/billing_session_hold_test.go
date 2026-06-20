package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestBillingSessionHoldRefundBlocksNeedsRefund(t *testing.T) {
	session := &BillingSession{tokenConsumed: 100}
	session.HoldRefund()
	if session.NeedsRefund() {
		t.Fatal("should not need refund while holdRefund is set")
	}
	session.ReleaseHoldRefund()
	if !session.NeedsRefund() {
		t.Fatal("should need refund after hold is released")
	}
}

func TestImageLogContentFromRequest(t *testing.T) {
	req := &dto.ImageRequest{
		Size:    "1792x1024",
		Quality: "hd",
	}
	n := uint(1)
	req.N = &n
	got := imageLogContentFromRequest(req)
	if len(got) != 3 {
		t.Fatalf("expected 3 log parts, got %v", got)
	}
}
