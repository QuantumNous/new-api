package passkey

import (
	"net/http"
	"testing"
)

func TestOriginsForRPIDUsesDNSLabelBoundaries(t *testing.T) {
	origins := []string{
		"https://a.example.com",
		"https://evilexample.com",
		"https://example.com.evil.com",
	}
	got := originsForRPID(origins, "example.com")
	if len(got) != 1 || got[0] != "https://a.example.com" {
		t.Fatalf("originsForRPID() = %#v", got)
	}
}

func TestOriginsForRPIDRejectsHTTPUnlessAllowed(t *testing.T) {
	origins := []string{"http://example.com"}
	if got := originsForRPID(origins, "example.com"); len(got) != 0 {
		t.Fatalf("unexpected insecure origins: %#v", got)
	}
	if got := originsForRPID(origins, "example.com", true); len(got) != 1 {
		t.Fatalf("expected allowed insecure origin, got %#v", got)
	}
}

func TestRequestOriginDoesNotUseHostForAllowlist(t *testing.T) {
	req, _ := http.NewRequest(http.MethodPost, "https://example.com/api", nil)
	req.Host = "attacker.example.net"
	req.Header.Set("Origin", "https://example.com")
	if !requestOriginAllowed(req, []string{"https://example.com"}) {
		t.Fatal("valid Origin was rejected")
	}
	req.Header.Set("Origin", "https://attacker.example.net")
	if requestOriginAllowed(req, []string{"https://example.com"}) {
		t.Fatal("untrusted Origin was accepted")
	}
}

func TestCanonicalConfiguredRPID(t *testing.T) {
	if got := canonicalConfiguredRPID([]string{"example.com", "old.example.org"}, "EXAMPLE.COM"); got != "example.com" {
		t.Fatalf("canonicalConfiguredRPID() = %q", got)
	}
	if got := canonicalConfiguredRPID([]string{"example.com"}, "evil.example"); got != "" {
		t.Fatalf("unexpected unconfigured RP ID %q", got)
	}
}
