package kitutil

import (
	"testing"
)

func TestMaskSensitiveInfoKeyFormats(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"openai sk-", "invalid key sk-abc1234567890", "invalid key sk-a***"},
		{"openrouter sk-or-v1-", "invalid key sk-or-v1-abcdefghijklmnop", "invalid key sk-o***"},
		{"anthropic sk-ant-", "invalid key sk-ant-api03-abcdefghijklmnop", "invalid key sk-a***"},
		{"groq gsk_", "invalid key gsk_abcdefghijklmnop", "invalid key gsk_***"},
		{"hf hf_", "invalid key hf_abcdefghijklmnop", "invalid key hf_a***"},
		{"xai xai-", "invalid key xai-abcdefghijklmnop", "invalid key xai-***"},
		{"gemini AIza", "invalid key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345", "invalid key AIza***"},
		{"perplexity pplx-", "invalid key pplx-abcdefghijklmnop", "invalid key pplx***"},
		{"nvidia nvapi-", "invalid key nvapi-abcdefghijklmnop", "invalid key nvap***"},
		{"replicate r8_", "invalid key r8_abcdefghijklmnop", "invalid key r8_a***"},
		{"cohere no-prefix 40", "invalid key abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP", "invalid key ***"},
		{"cloudflare no-prefix 40", "invalid key 0123456789abcdef0123456789abcdef01234567", "invalid key ***"},
		{"jwt eyJ", "invalid token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature1234567890", "invalid token eyJ***"},
		{"token-colon no prefix", "invalid token: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP", "invalid token: ***"},
		{"key-colon no prefix", "invalid key: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP", "invalid key: ***"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out := MaskSensitiveInfo(tc.in)
			if out != tc.want {
				t.Errorf("mask mismatch\n in:  %q\n got: %q\nwant: %q", tc.in, out, tc.want)
			}
		})
	}
}
