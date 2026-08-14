package order

import (
	"context"
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resolverWith(addresses ...string) Resolver {
	return func(context.Context, string) ([]net.IP, error) {
		result := make([]net.IP, 0, len(addresses))
		for _, address := range addresses {
			result = append(result, net.ParseIP(address))
		}
		return result, nil
	}
}

func TestReturnURLPolicyAcceptsNormalizedAllowlistedPublicURL(t *testing.T) {
	policy, err := NewReturnURLPolicy("https://app.example.com/console/", resolverWith("8.8.8.8"))
	require.NoError(t, err)

	validated, err := policy.Validate(context.Background(), "https://APP.example.com/console/../console/billing?tab=history#ignored")

	require.NoError(t, err)
	assert.Equal(t, "https://app.example.com/console/billing?tab=history", validated.String())
}

func TestReturnURLPolicyRejectsUnsafeOrUnallowlistedTargets(t *testing.T) {
	tests := []struct {
		name     string
		raw      string
		resolver Resolver
	}{
		{name: "non HTTPS", raw: "http://app.example.com/console/", resolver: resolverWith("8.8.8.8")},
		{name: "userinfo", raw: "https://user@app.example.com/console/", resolver: resolverWith("8.8.8.8")},
		{name: "unexpected port", raw: "https://app.example.com:8443/console/", resolver: resolverWith("8.8.8.8")},
		{name: "path escape", raw: "https://app.example.com/admin", resolver: resolverWith("8.8.8.8")},
		{name: "loopback", raw: "https://app.example.com/console/", resolver: resolverWith("127.0.0.1")},
		{name: "private IPv6", raw: "https://app.example.com/console/", resolver: resolverWith("fd00::1")},
		{name: "mixed DNS response", raw: "https://app.example.com/console/", resolver: resolverWith("8.8.8.8", "169.254.1.1")},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			policy, err := NewReturnURLPolicy("https://app.example.com/console/", test.resolver)
			require.NoError(t, err)
			_, err = policy.Validate(context.Background(), test.raw)
			assert.Error(t, err)
		})
	}
}

func TestNotifyURLMatchesUsesCanonicalHTTPSURL(t *testing.T) {
	assert.True(t, NotifyURLMatches("https://API.example.com/api/user/epay/notify", "https://api.example.com/api/user/epay/notify"))
	assert.False(t, NotifyURLMatches("https://api.example.com:8443/api/user/epay/notify", "https://api.example.com/api/user/epay/notify"))
}
