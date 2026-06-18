package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMaskSensitiveInfo_DomainsStillMasked(t *testing.T) {
	cases := []string{
		"openai.com",
		"www.openai.com",
		"api.openai.com",
		"blockrun.ai",
		"api.anthropic.com",
		"sub.domain.co.uk",
		"generativelanguage.googleapis.com",
	}
	for _, in := range cases {
		out := MaskSensitiveInfo(in)
		require.Contains(t, out, "***", "expected host %q to be masked, got %q", in, out)
		require.NotEqual(t, in, out, "host %q should change", in)
	}
}

func TestMaskSensitiveInfo_FieldPathsNotMangled(t *testing.T) {
	// Dotted code/field paths whose last label is not a TLD must pass through
	// untouched — this is the bug the TLD gate fixes.
	cases := []string{
		"thinking.type",
		"messages.0.content.source.base64",
		"messages.0.content.0.source.base64: invalid base64 data",
		"GeneralOpenAIRequest.max_tokens",
		"thinking.budget_tokens is required",
		"tools.0.input_schema.properties",
		// field names whose last label collides with a ccTLD — must NOT be masked
		// (code-review regression: user.id -> ***.id, request.in -> ***.in, etc.)
		"user.id",
		"payment.id is required",
		"request.in",
		"contact.us",
		"email.cc",
		"user.info",
		"reply.to",
		"is.it",
		"data.me",
	}
	for _, in := range cases {
		out := MaskSensitiveInfo(in)
		require.Equal(t, in, out, "field path %q must not be masked", in)
		require.NotContains(t, out, "***", "field path %q should contain no mask, got %q", in, out)
	}
}

func TestMaskSensitiveInfo_MixedMessage(t *testing.T) {
	// A real-world shape: an error that mentions both a field path (keep) and a
	// provider host (mask).
	in := "thinking.type invalid; upstream api.openai.com rejected request"
	out := MaskSensitiveInfo(in)
	require.Contains(t, out, "thinking.type", "field path should survive")
	require.NotContains(t, out, "openai.com", "host should be masked")
	require.Contains(t, out, "***", "host mask expected")
}

func TestMaskSensitiveInfo_URLAndIPUnaffected(t *testing.T) {
	require.Contains(t, MaskSensitiveInfo("https://api.openai.com/v1/x"), "***")
	require.Equal(t, "***.***.***.***", strings.TrimSpace(MaskSensitiveInfo("192.168.1.1")))
}
