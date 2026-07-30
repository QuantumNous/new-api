package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseProxyURLStrict(t *testing.T) {
	tests := []struct {
		name      string
		raw       string
		canonical string
		wantErr   string
	}{
		{name: "empty"},
		{name: "http", raw: " HTTP://proxy.example:8080/ ", canonical: "http://proxy.example:8080"},
		{name: "https credentials", raw: "https://user:pass@proxy.example", canonical: "https://user:pass@proxy.example"},
		{name: "socks default port", raw: "socks5://proxy.example", canonical: "socks5://proxy.example:1080"},
		{name: "socks5h IPv6", raw: "socks5h://[2001:db8::1]", canonical: "socks5h://[2001:db8::1]:1080"},
		{name: "unsupported", raw: "ftp://proxy.example", wantErr: "must use"},
		{name: "missing scheme", raw: "proxy.example:8080", wantErr: "must use"},
		{name: "missing host", raw: "http:///proxy", wantErr: "host"},
		{name: "zero port", raw: "http://proxy.example:0", wantErr: "valid port"},
		{name: "path", raw: "http://proxy.example/path", wantErr: "path"},
		{name: "query", raw: "http://proxy.example/?token=secret", wantErr: "query"},
		{name: "fragment", raw: "http://proxy.example/#secret", wantErr: "fragment"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			parsed, err := ParseProxyURLStrict(test.raw)
			if test.wantErr != "" {
				require.ErrorContains(t, err, test.wantErr)
				return
			}
			require.NoError(t, err)
			if test.canonical == "" {
				assert.Nil(t, parsed)
				return
			}
			assert.Equal(t, test.canonical, parsed.String())
		})
	}
}

func TestParseProxyURLRuntimeStripsLegacySuffix(t *testing.T) {
	parsed, stripped, err := ParseProxyURLRuntime("socks5://user:pass@proxy.example/legacy?token=secret#fragment")
	require.NoError(t, err)
	assert.True(t, stripped)
	assert.Equal(t, "socks5://user:pass@proxy.example:1080", parsed.String())
}
