package service

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

func TestVerifyBillingHoldUpstreamCharge_confirmedNotError(t *testing.T) {
	hold := &model.BillingHold{
		ErrorStatus:  400,
		ErrorCode:    string(types.ErrorCodeConvertRequestFailed),
		ErrorMessage: "convert failed",
	}
	refund, detail := VerifyBillingHoldUpstreamCharge(hold)
	if !refund {
		t.Fatalf("expected refund, got confirm: %s", detail)
	}
}

func TestVerifyBillingHoldUpstreamCharge_receivedResponses(t *testing.T) {
	hold := &model.BillingHold{
		ErrorStatus:       504,
		ErrorCode:         string(types.ErrorCodeBadResponseStatusCode),
		ErrorMessage:      "gateway timeout",
		ReceivedResponses: 12,
	}
	refund, detail := VerifyBillingHoldUpstreamCharge(hold)
	if refund {
		t.Fatalf("expected confirm, got refund: %s", detail)
	}
}

func TestVerifyBillingHoldUpstreamCharge_ambiguousDefaultConfirm(t *testing.T) {
	hold := &model.BillingHold{
		ErrorStatus:  502,
		ErrorCode:    string(types.ErrorCodeBadResponseStatusCode),
		ErrorMessage: "bad gateway",
	}
	refund, detail := VerifyBillingHoldUpstreamCharge(hold)
	if refund {
		t.Fatalf("expected confirm when upstream unverified, got refund: %s", detail)
	}
	if detail == "" {
		t.Fatal("expected detail")
	}
}

func TestBillingHoldAPIError(t *testing.T) {
	hold := &model.BillingHold{
		ErrorStatus:  http.StatusBadGateway,
		ErrorCode:    string(types.ErrorCodeBadResponseStatusCode),
		ErrorMessage: "upstream bad gateway",
	}
	err := billingHoldAPIError(hold)
	if ClassifyUpstreamChargeConfidence(err) != UpstreamChargeAmbiguous {
		t.Fatalf("expected ambiguous")
	}
}
