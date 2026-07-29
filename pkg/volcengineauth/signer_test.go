package volcengineauth

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestSignerBuildsDeterministicAuthorization(t *testing.T) {
	req, err := http.NewRequest(
		http.MethodPost,
		"https://ark.ap-southeast-1.byteplusapi.com/?Version=2024-01-01&Action=GetAsset&Filter=a+b&Filter=a%2Bb",
		strings.NewReader(`{"Id":"asset-1","ProjectName":"project3"}`),
	)
	if err != nil {
		t.Fatal(err)
	}

	signer := Signer{
		AccessKeyID:     "test-ak",
		SecretAccessKey: "test-secret",
		Region:          "ap-southeast-1",
		Service:         "ark",
		Now: func() time.Time {
			return time.Date(2026, 7, 29, 12, 34, 56, 0, time.UTC)
		},
	}

	if err := signer.Sign(req, []byte(`{"Id":"asset-1","ProjectName":"project3"}`)); err != nil {
		t.Fatalf("Sign returned error: %v", err)
	}

	if got := req.Header.Get("X-Date"); got != "20260729T123456Z" {
		t.Fatalf("X-Date = %q", got)
	}
	if got := req.Header.Get("X-Content-Sha256"); got != "156617727cf37ec13384e0ca80bbf694d0cfd02b3293bf1cad160c2479da6daf" {
		t.Fatalf("X-Content-Sha256 = %q", got)
	}
	if got := req.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q", got)
	}

	wantAuth := "HMAC-SHA256 Credential=test-ak/20260729/ap-southeast-1/ark/request, SignedHeaders=content-type;host;x-content-sha256;x-date, Signature=15b9c14125104cf5670559249a95d6cb85595bb56a70cbe5037ac1c302b223fc"
	if got := req.Header.Get("Authorization"); got != wantAuth {
		t.Fatalf("Authorization = %q, want %q", got, wantAuth)
	}
}

func TestSignerHashesEmptyPayload(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "https://ark.ap-southeast-1.byteplusapi.com/", nil)
	if err != nil {
		t.Fatal(err)
	}
	signer := Signer{
		AccessKeyID:     "test-ak",
		SecretAccessKey: "test-secret",
		Region:          "ap-southeast-1",
		Service:         "ark",
		Now: func() time.Time {
			return time.Date(2026, 7, 29, 12, 34, 56, 0, time.UTC)
		},
	}

	if err := signer.Sign(req, nil); err != nil {
		t.Fatalf("Sign returned error: %v", err)
	}
	if got := req.Header.Get("X-Content-Sha256"); got != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" {
		t.Fatalf("empty payload hash = %q", got)
	}
}

func TestSignerValidationErrorsDoNotExposeSecret(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "https://ark.ap-southeast-1.byteplusapi.com/", nil)
	if err != nil {
		t.Fatal(err)
	}
	signer := Signer{AccessKeyID: "test-ak", SecretAccessKey: "super-secret-value", Region: "ap-southeast-1"}

	err = signer.Sign(req, nil)
	if err == nil {
		t.Fatal("Sign should reject missing service")
	}
	if strings.Contains(err.Error(), "super-secret-value") {
		t.Fatalf("error leaked secret: %v", err)
	}
}
