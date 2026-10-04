package system_setting

import (
	"errors"
	"strings"
	"testing"
)

func TestNormalizePasskeyRPID(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		origins   []string
		want      string
		wantError bool
	}{
		{name: "domain", value: " Example.COM ", want: "example.com"},
		{name: "idna", value: "例え.テスト", want: "xn--r8jz45g.xn--zckzah"},
		{name: "localhost", value: "localhost", want: "localhost"},
		{name: "single label with trusted origin", value: "intranet", origins: []string{"https://intranet"}, want: "intranet"},
		{name: "single label without trusted origin", value: "intranet", wantError: true},
		{name: "port", value: "example.com:443", wantError: true},
		{name: "scheme", value: "https://example.com", wantError: true},
		{name: "path", value: "example.com/path", wantError: true},
		{name: "wildcard", value: "*.example.com", wantError: true},
		{name: "ipv4", value: "127.0.0.1", wantError: true},
		{name: "ipv6", value: "::1", wantError: true},
		{name: "public suffix", value: "com", wantError: true},
		{name: "public suffix compound", value: "co.uk", wantError: true},
		{name: "empty label", value: "a..example.com", wantError: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizePasskeyRPID(tt.value, tt.origins...)
			if tt.wantError {
				if err == nil || !errors.Is(err, ErrPasskeyRPIDInvalid) {
					t.Fatalf("expected ErrPasskeyRPIDInvalid, got %q, %v", got, err)
				}
				return
			}
			if err != nil || got != tt.want {
				t.Fatalf("NormalizePasskeyRPID() = %q, %v; want %q", got, err, tt.want)
			}
		})
	}

	long := strings.Repeat("a", 254)
	if _, err := NormalizePasskeyRPID(long); !errors.Is(err, ErrPasskeyRPIDInvalid) {
		t.Fatalf("expected overlong RP ID to be rejected, got %v", err)
	}
}

func TestParsePasskeyRPIDs(t *testing.T) {
	got, err := ParsePasskeyRPIDs("example.com,\nold.example.org, EXAMPLE.COM", "https://example.com")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != "example.com" || got[1] != "old.example.org" {
		t.Fatalf("unexpected RP IDs: %#v", got)
	}
	if _, err := ParsePasskeyRPIDs("example.com,com"); !errors.Is(err, ErrPasskeyRPIDInvalid) {
		t.Fatalf("expected invalid entry to reject the entire list, got %v", err)
	}
}

func TestPasskeySettingsWithDefaultsPreservesLegacyFallback(t *testing.T) {
	settings := PasskeySettings{}.WithDefaults("https://newapi.example:3000")
	if settings.RPID != "newapi.example:3000" {
		t.Fatalf("RPID = %q", settings.RPID)
	}
	if settings.Origins != "https://newapi.example:3000" {
		t.Fatalf("Origins = %q", settings.Origins)
	}
	if got := settings.EffectiveRPID(); got != "newapi.example" {
		t.Fatalf("EffectiveRPID() = %q", got)
	}
}
