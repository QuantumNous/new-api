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
		wantErr   bool
		errSubstr string
		wantHost  string
		wantPort  string
	}{
		{name: "empty", raw: "", wantHost: ""},
		{name: "whitespace", raw: "   ", wantHost: ""},
		{name: "http with port", raw: "http://proxy.example:8080", wantHost: "proxy.example:8080"},
		{name: "https without port", raw: "https://proxy.example", wantHost: "proxy.example"},
		{name: "socks5 without port defaults to 1080", raw: "socks5://proxy.example", wantHost: "proxy.example:1080"},
		{name: "socks5h with port", raw: "socks5h://proxy.example:10800", wantHost: "proxy.example:10800"},
		{name: "root path allowed", raw: "http://proxy.example:8080/", wantHost: "proxy.example:8080"},
		{name: "non-root path rejected", raw: "http://proxy.example:8080/path", wantErr: true, errSubstr: "must not include a path"},
		{name: "query rejected", raw: "http://proxy.example:8080?foo=bar", wantErr: true, errSubstr: "must not include a query"},
		{name: "fragment rejected", raw: "http://proxy.example:8080#section", wantErr: true, errSubstr: "must not include a fragment"},
		{name: "unsupported scheme", raw: "ftp://proxy.example:21", wantErr: true, errSubstr: "must use http, https, socks5, or socks5h"},
		{name: "missing host", raw: "http://:8080", wantErr: true, errSubstr: "must include a host"},
		{name: "invalid port 0", raw: "http://proxy.example:0", wantErr: true, errSubstr: "must include a valid port"},
		{name: "invalid port 70000", raw: "http://proxy.example:70000", wantErr: true, errSubstr: "must include a valid port"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			parsed, err := ParseProxyURLStrict(tc.raw)
			if tc.wantErr {
				require.Error(t, err)
				if tc.errSubstr != "" {
					assert.Contains(t, err.Error(), tc.errSubstr)
				}
				assert.Nil(t, parsed)
				return
			}
			require.NoError(t, err)
			if tc.wantHost == "" {
				assert.Nil(t, parsed)
			} else {
				require.NotNil(t, parsed)
				assert.Equal(t, tc.wantHost, parsed.Host)
				assert.Empty(t, parsed.Path)
				assert.Empty(t, parsed.RawQuery)
				assert.Empty(t, parsed.Fragment)
			}
		})
	}
}

func TestParseProxyURLRuntime(t *testing.T) {
	tests := []struct {
		name         string
		raw          string
		wantStripped bool
		wantHost     string
	}{
		{name: "clean http", raw: "http://proxy.example:8080", wantStripped: false, wantHost: "proxy.example:8080"},
		{name: "legacy path stripped", raw: "http://proxy.example:8080/some/path", wantStripped: true, wantHost: "proxy.example:8080"},
		{name: "legacy query stripped", raw: "http://proxy.example:8080?auth=1", wantStripped: true, wantHost: "proxy.example:8080"},
		{name: "legacy fragment stripped", raw: "http://proxy.example:8080#frag", wantStripped: true, wantHost: "proxy.example:8080"},
		{name: "socks5 default port 1080", raw: "socks5://proxy.example/legacy", wantStripped: true, wantHost: "proxy.example:1080"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			parsed, stripped, err := ParseProxyURLRuntime(tc.raw)
			require.NoError(t, err)
			require.NotNil(t, parsed)
			assert.Equal(t, tc.wantStripped, stripped)
			assert.Equal(t, tc.wantHost, parsed.Host)
			assert.Empty(t, parsed.Path)
			assert.Empty(t, parsed.RawQuery)
			assert.Empty(t, parsed.Fragment)
		})
	}
}
