package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

type billingSessionTestFunding struct {
	source       string
	settleDeltas []int
}

func (f *billingSessionTestFunding) Source() string { return f.source }
func (f *billingSessionTestFunding) PreConsume(amount int) error {
	return nil
}
func (f *billingSessionTestFunding) Settle(delta int) error {
	f.settleDeltas = append(f.settleDeltas, delta)
	return nil
}
func (f *billingSessionTestFunding) Refund() error { return nil }

func TestBillingSessionEnsurePreConsumedQuotaTopUpsReservation(t *testing.T) {
	funding := &billingSessionTestFunding{source: BillingSourceWallet}
	info := &relaycommon.RelayInfo{
		IsPlayground: true,
	}
	session := &BillingSession{
		relayInfo:        info,
		funding:          funding,
		preConsumedQuota: 100,
	}

	if err := session.EnsurePreConsumedQuota(150); err != nil {
		t.Fatalf("EnsurePreConsumedQuota returned error: %v", err)
	}
	if session.preConsumedQuota != 150 {
		t.Fatalf("expected preConsumedQuota 150, got %d", session.preConsumedQuota)
	}
	if session.preConsumedTopUp != 50 {
		t.Fatalf("expected preConsumedTopUp 50, got %d", session.preConsumedTopUp)
	}
	if info.FinalPreConsumedQuota != 150 {
		t.Fatalf("expected relayInfo.FinalPreConsumedQuota 150, got %d", info.FinalPreConsumedQuota)
	}
	if len(funding.settleDeltas) != 1 || funding.settleDeltas[0] != 50 {
		t.Fatalf("expected one funding top-up delta 50, got %+v", funding.settleDeltas)
	}

	if err := session.EnsurePreConsumedQuota(120); err != nil {
		t.Fatalf("EnsurePreConsumedQuota returned error on lower target: %v", err)
	}
	if len(funding.settleDeltas) != 1 {
		t.Fatalf("expected no extra funding settle on lower target, got %+v", funding.settleDeltas)
	}
}
