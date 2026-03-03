package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestValidateRedirectURL(t *testing.T) {
	// Save original trusted domains and restore after test
	originalDomains := constant.TrustedRedirectDomains
	defer func() {
		constant.TrustedRedirectDomains = originalDomains
	}()

	tests := []struct {
		name           string
		url            string
		trustedDomains []string
		wantErr        bool
		errContains    string
	}{
		// Valid cases
		{
			name:           "exact domain match with https",
			url:            "https://example.com/success",
			trustedDomains: []string{"example.com"},
			wantErr:        false,
		},
		{
			name:           "exact domain match with http",
			url:            "http://example.com/callback",
			trustedDomains: []string{"example.com"},
			wantErr:        false,
		},
		{
			name:           "subdomain match",
			url:            "https://sub.example.com/success",
			trustedDomains: []string{"example.com"},
			wantErr:        false,
		},
		{
			name:           "case insensitive domain",
			url:            "https://EXAMPLE.COM/success",
			trustedDomains: []string{"example.com"},
			wantErr:        false,
		},

		// Invalid cases - untrusted domain
		{
			name:           "untrusted domain",
			url:            "https://evil.com/phishing",
			trustedDomains: []string{"example.com"},
			wantErr:        true,
			errContains:    "not in the trusted domains list",
		},
		{
			name:           "suffix attack - fakeexample.com",
			url:            "https://fakeexample.com/success",
			trustedDomains: []string{"example.com"},
			wantErr:        true,
			errContains:    "not in the trusted domains list",
		},
		{
			name:           "empty trusted domains list",
			url:            "https://example.com/success",
			trustedDomains: []string{},
			wantErr:        true,
			errContains:    "not in the trusted domains list",
		},

		// Invalid cases - scheme
		{
			name:           "javascript scheme",
			url:            "javascript:alert('xss')",
			trustedDomains: []string{"example.com"},
			wantErr:        true,
			errContains:    "invalid URL scheme",
		},
		{
			name:           "data scheme",
			url:            "data:text/html,<script>alert('xss')</script>",
			trustedDomains: []string{"example.com"},
			wantErr:        true,
			errContains:    "invalid URL scheme",
		},

		// Edge cases
		{
			name:           "empty URL",
			url:            "",
			trustedDomains: []string{"example.com"},
			wantErr:        true,
			errContains:    "invalid URL scheme",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set up trusted domains for this test case
			constant.TrustedRedirectDomains = tt.trustedDomains

			err := ValidateRedirectURL(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateRedirectURL(%q) expected error containing %q, got nil", tt.url, tt.errContains)
					return
				}
				if tt.errContains != "" && !contains(err.Error(), tt.errContains) {
					t.Errorf("ValidateRedirectURL(%q) error = %q, want error containing %q", tt.url, err.Error(), tt.errContains)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateRedirectURL(%q) unexpected error: %v", tt.url, err)
				}
			}
		})
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
