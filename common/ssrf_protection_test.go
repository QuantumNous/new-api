package common

import (
	"net"
	"strings"
	"testing"
)

func TestValidateURLWithFetchSettingRejectsDomainResolvingToPrivateIP(t *testing.T) {
	oldLookup := ssrfLookupIP
	ssrfLookupIP = func(host string) ([]net.IP, error) {
		if host != "assets.example.test" {
			t.Fatalf("unexpected host lookup: %q", host)
		}
		return []net.IP{net.ParseIP("169.254.169.254")}, nil
	}
	t.Cleanup(func() { ssrfLookupIP = oldLookup })

	err := ValidateURLWithFetchSetting(
		"https://assets.example.test/a.png",
		true,
		false,
		false,
		false,
		nil,
		nil,
		[]string{"80", "443"},
		true,
	)
	if err == nil {
		t.Fatal("expected private resolved IP to be rejected")
	}
	for _, forbidden := range []string{"a.png", "user:pass@"} {
		if strings.Contains(err.Error(), forbidden) {
			t.Fatalf("error leaked URL detail %q: %v", forbidden, err)
		}
	}
}
