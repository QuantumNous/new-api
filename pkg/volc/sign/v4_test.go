package sign

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestSignRequestSetsHeaders(t *testing.T) {
	body := []byte(`{"Name":"demo","GroupType":"AIGC"}`)
	req, err := http.NewRequest(http.MethodPost, "https://ark.cn-beijing.volcengineapi.com/?Action=CreateAssetGroup&Version=2024-01-01", strings.NewReader(string(body)))
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 8, 8, 0, 0, 0, time.UTC)
	err = SignRequest(req, Credentials{
		AccessKeyID:     "AKTEST",
		SecretAccessKey: "SKTEST",
		Region:          "cn-beijing",
		Service:         "ark",
	}, body, now)
	if err != nil {
		t.Fatalf("SignRequest: %v", err)
	}
	if req.Header.Get("X-Date") != "20260808T080000Z" {
		t.Fatalf("X-Date = %q", req.Header.Get("X-Date"))
	}
	if req.Header.Get("X-Content-Sha256") == "" {
		t.Fatal("missing X-Content-Sha256")
	}
	auth := req.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "HMAC-SHA256 Credential=AKTEST/20260808/cn-beijing/ark/request") {
		t.Fatalf("Authorization prefix unexpected: %s", auth)
	}
	if !strings.Contains(auth, "SignedHeaders=host;x-content-sha256;x-date") {
		t.Fatalf("SignedHeaders unexpected: %s", auth)
	}
	if !strings.Contains(auth, "Signature=") {
		t.Fatalf("missing Signature: %s", auth)
	}
}

func TestSignRequestEmptyCreds(t *testing.T) {
	req, _ := http.NewRequest(http.MethodPost, "https://example.com/", nil)
	err := SignRequest(req, Credentials{}, nil, time.Time{})
	if err == nil {
		t.Fatal("expected error for empty credentials")
	}
}
