package common

import "testing"

func TestGetTrustQuota(t *testing.T) {
	old := TrustQuota
	oldQPU := QuotaPerUnit
	defer func() {
		TrustQuota = old
		QuotaPerUnit = oldQPU
	}()

	QuotaPerUnit = 500_000

	TrustQuota = -1
	if got := GetTrustQuota(); got != 5_000_000 {
		t.Fatalf("legacy default = %d, want 5000000", got)
	}

	TrustQuota = 0
	if got := GetTrustQuota(); got != 0 {
		t.Fatalf("disabled trust = %d, want 0", got)
	}

	TrustQuota = 123
	if got := GetTrustQuota(); got != 123 {
		t.Fatalf("custom trust = %d, want 123", got)
	}
}
