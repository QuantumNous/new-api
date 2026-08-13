package kitutil

import (
	"strings"
	"testing"
)

func TestMaskSensitiveInfoKeyFormats(t *testing.T) {
	cases := []struct {
		name string
		in   string
	}{
		{"openai sk-", "invalid key sk-abc1234567890"},
		{"openrouter sk-or-v1-", "invalid key sk-or-v1-abcdefghijklmnop"},
		{"anthropic sk-ant-", "invalid key sk-ant-api03-abcdefghijklmnop"},
		{"groq gsk_", "invalid key gsk_abcdefghijklmnop"},
		{"hf hf_", "invalid key hf_abcdefghijklmnop"},
		{"xai xai-", "invalid key xai-abcdefghijklmnop"},
		{"gemini AIza", "invalid key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345"},
		{"perplexity pplx-", "invalid key pplx-abcdefghijklmnop"},
		{"nvidia nvapi-", "invalid key nvapi-abcdefghijklmnop"},
		{"replicate r8_", "invalid key r8_abcdefghijklmnop"},
		{"cohere no-prefix 40", "invalid key abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP"},
		{"cloudflare no-prefix 40", "invalid key 0123456789abcdef0123456789abcdef01234567"},
		{"jwt eyJ", "invalid token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature1234567890"},
		{"token-colon no prefix", "invalid token: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP"},
		{"key-colon no prefix", "invalid key: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out := MaskSensitiveInfo(tc.in)
			original := tc.in
			if out == original {
				t.Logf("LEAK (unchanged): %s", tc.in)
			} else {
				t.Logf("masked: %s -> %s", tc.in, out)
			}
			// Heuristic leak check: the 12-char tail of the secret must not survive.
			parts := strings.Fields(tc.in)
			secret := parts[len(parts)-1]
			if len(secret) > 12 {
				tail := secret[len(secret)-12:]
				if strings.Contains(out, tail) {
					t.Errorf("secret tail %q still present in output: %q", tail, out)
				}
			}
		})
	}
}
