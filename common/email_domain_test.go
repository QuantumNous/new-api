package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeEmailDomain(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		want    string
		wantErr bool
	}{
		{name: "normalizes case and whitespace", email: " User@Mail.Example.COM ", want: "mail.example.com"},
		{name: "uses final at separator", email: "user+tag@example.com", want: "example.com"},
		{name: "missing local part", email: "@example.com", wantErr: true},
		{name: "missing domain", email: "user@", wantErr: true},
		{name: "missing separator", email: "example.com", wantErr: true},
		{name: "multiple separators", email: "user@evil.example@example.com", wantErr: true},
		{name: "public suffix only", email: "user@com", wantErr: true},
		{name: "rejects unicode domain", email: "user@例子.com", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeEmailDomain(tt.email)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestIsSubdomainEmailDomain(t *testing.T) {
	tests := []struct {
		domain string
		want   bool
	}{
		{domain: "example.com", want: false},
		{domain: "mail.example.com", want: true},
		{domain: "example.com.cn", want: false},
		{domain: "mail.example.com.cn", want: true},
		{domain: "example.co.uk", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.domain, func(t *testing.T) {
			require.Equal(t, tt.want, IsSubdomainEmailDomain(tt.domain))
		})
	}
}
