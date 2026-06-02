package common

import (
	"strings"
	"testing"
)

func TestHideExternalAddressInfoRemovesURLsDomainsAndIPs(t *testing.T) {
	input := `Post "https://api.openai.com/v1/chat/completions?key=secret": dial tcp 34.117.1.2:443 failed, backup api.anthropic.com:443, websocket wss://realtime.example.com/v1`
	output := HideExternalAddressInfo(input)

	for _, forbidden := range []string{
		"https://",
		"api.openai.com",
		"api.anthropic.com",
		"wss://",
		"realtime.example.com",
		"34.117.1.2",
	} {
		if strings.Contains(output, forbidden) {
			t.Fatalf("HideExternalAddressInfo() leaked %q in %q", forbidden, output)
		}
	}
	if !strings.Contains(output, "[已隐藏外部地址]") {
		t.Fatalf("HideExternalAddressInfo() should include placeholder, got %q", output)
	}
}
