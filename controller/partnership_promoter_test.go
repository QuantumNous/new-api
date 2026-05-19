package controller

import "testing"

func TestBuildInfistarPromoterSignature(t *testing.T) {
	got := BuildInfistarPromoterSignature("1716000000", "10001", "test-secret")
	want := "8d48aed28f800e163cb5f740ede757e71e3e8c3c105a765f3b1ab76d6d407977"
	if got != want {
		t.Fatalf("unexpected signature: got %s want %s", got, want)
	}
}

func TestPartnershipPromoterTargetPath(t *testing.T) {
	targetPath, ok := partnershipPromoterTargetPath("PATCH", "/api/partnership/promoter/referral-credential")
	if !ok || targetPath != "/api/promoter/referral-credential" {
		t.Fatalf("unexpected target path: got %s allowed %v", targetPath, ok)
	}

	if _, ok := partnershipPromoterTargetPath("GET", "/api/partnership/promoter/recommendation-tools"); ok {
		t.Fatal("unexpectedly allowed non-whitelisted promoter path")
	}
}
