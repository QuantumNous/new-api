package service_test

import (
	"testing"

	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSanitizeWithPair(t *testing.T) {
	cases := []struct {
		name, actual, display, in, want string
	}{
		{"actual empty noop", "", "https://d.com", "to https://up.com", "to https://up.com"},
		{"actual==display noop", "https://x.com", "https://x.com", "https://x.com", "https://x.com"},
		{"full url replace", "https://upstream.example.com", "https://platform.claude.com", "request to https://upstream.example.com/v1/messages failed", "request to https://platform.claude.com/v1/messages failed"},
		{"bare host replace", "https://upstream.example.com", "https://platform.claude.com", "dial tcp lookup upstream.example.com", "dial tcp lookup platform.claude.com"},
		{"no match unchanged", "https://upstream.example.com", "https://platform.claude.com", "some other error", "some other error"},
		{"empty msg", "https://a.com", "https://b.com", "", ""},
		{"multiple occurrences", "https://up.com", "https://disp.com", "https://up.com x https://up.com", "https://disp.com x https://disp.com"},
		{"host-as-substring noop path", "https://api.com", "https://api.com.proxy", "error from https://api.com/v1", "error from https://api.com.proxy/v1"},
		{"host-as-substring bare host", "https://api.com", "https://api.com.proxy", "dial tcp api.com", "dial tcp api.com.proxy"},
		// M1: display empty — bare host must also be stripped, not just the full URL
		{"display empty bare host stripped", "https://real.secret.com/v1", "", "dial tcp real.secret.com", "dial tcp "},
		{"display empty full url stripped", "https://real.secret.com/v1", "", "request to https://real.secret.com/v1 failed", "request to  failed"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assert.Equal(t, c.want, service.SanitizeWithPair(c.actual, c.display, c.in))
		})
	}
}

func TestSanitizeWithPair_NoPanicOnUnparseableURL(t *testing.T) {
	require.NotPanics(t, func() {
		service.SanitizeWithPair("http://x:abc", "https://display.com", "err to http://x:abc")
		service.SanitizeWithPair("https://real.host.com", "http://y:zzz", "err from https://real.host.com")
	})
}
