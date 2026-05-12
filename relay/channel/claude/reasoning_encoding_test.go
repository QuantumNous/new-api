package claude

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestThinkingSignatureRoundTrip(t *testing.T) {
	sig := "ErkBCkYI"
	encoded := EncodeThinkingSignature(sig)
	if encoded == "" {
		t.Fatal("empty encoded")
	}
	if !strings.HasPrefix(encoded, reasoningEnvelopePrefix) {
		t.Errorf("encoded should start with %q, got %q", reasoningEnvelopePrefix, encoded)
	}
	kind, signature, data, err := DecodeReasoningEncryptedContent(encoded)
	if err != nil {
		t.Fatalf("decode err: %v", err)
	}
	if kind != ReasoningKindThinking {
		t.Errorf("kind=%q want %q", kind, ReasoningKindThinking)
	}
	if signature != sig {
		t.Errorf("signature=%q want %q", signature, sig)
	}
	if data != "" {
		t.Errorf("data=%q want empty", data)
	}
}

func TestRedactedThinkingRoundTrip(t *testing.T) {
	d := "EsAB..."
	encoded := EncodeRedactedThinking(d)
	if encoded == "" {
		t.Fatal("empty encoded")
	}
	if !strings.HasPrefix(encoded, reasoningEnvelopePrefix) {
		t.Errorf("encoded should start with %q, got %q", reasoningEnvelopePrefix, encoded)
	}
	kind, signature, data, err := DecodeReasoningEncryptedContent(encoded)
	if err != nil {
		t.Fatalf("decode err: %v", err)
	}
	if kind != ReasoningKindRedacted {
		t.Errorf("kind=%q want %q", kind, ReasoningKindRedacted)
	}
	if signature != "" {
		t.Errorf("signature=%q want empty", signature)
	}
	if data != d {
		t.Errorf("data=%q want %q", data, d)
	}
}

func TestDecodeLegacyRawSignature(t *testing.T) {
	raw := "raw_anthropic_signature_no_prefix"
	kind, signature, data, err := DecodeReasoningEncryptedContent(raw)
	if err != nil {
		t.Fatalf("legacy fallback should not err, got %v", err)
	}
	if kind != ReasoningKindThinking {
		t.Errorf("kind=%q want fallback thinking", kind)
	}
	if signature != raw {
		t.Errorf("signature=%q want %q", signature, raw)
	}
	if data != "" {
		t.Errorf("data should be empty in fallback")
	}
}

func TestEncodeEmpty(t *testing.T) {
	if EncodeThinkingSignature("") != "" {
		t.Error("empty signature should encode to empty string")
	}
	if EncodeRedactedThinking("") != "" {
		t.Error("empty data should encode to empty string")
	}
	kind, sig, data, err := DecodeReasoningEncryptedContent("")
	if err != nil {
		t.Errorf("empty input should not err, got %v", err)
	}
	if kind != "" || sig != "" || data != "" {
		t.Errorf("empty input should return all empty, got kind=%q sig=%q data=%q", kind, sig, data)
	}
}

func TestDecodeMalformedEnvelopeReturnsError(t *testing.T) {
	cases := map[string]string{
		"bad base64":           reasoningEnvelopePrefix + "not-base64!!!",
		"bad json":             reasoningEnvelopePrefix + base64.RawURLEncoding.EncodeToString([]byte("not json")),
		"wrong version":        reasoningEnvelopePrefix + encodeRawPayloadForTest(t, map[string]any{"v": 999, "t": "thinking", "s": "x"}),
		"unknown kind":         reasoningEnvelopePrefix + encodeRawPayloadForTest(t, map[string]any{"v": 1, "t": "foo", "s": "x"}),
		"thinking missing sig": reasoningEnvelopePrefix + encodeRawPayloadForTest(t, map[string]any{"v": 1, "t": "thinking"}),
		"redacted missing data": reasoningEnvelopePrefix + encodeRawPayloadForTest(t, map[string]any{"v": 1, "t": "redacted"}),
	}
	for name, input := range cases {
		t.Run(name, func(t *testing.T) {
			_, _, _, err := DecodeReasoningEncryptedContent(input)
			if err == nil {
				t.Errorf("input %q should err", input)
			}
		})
	}
}

func TestDecodeOversizedPayloadRejected(t *testing.T) {
	bigPayload := strings.Repeat("a", reasoningMaxRawBytes+1)
	encoded := reasoningEnvelopePrefix + base64.RawURLEncoding.EncodeToString([]byte(bigPayload))
	_, _, _, err := DecodeReasoningEncryptedContent(encoded)
	if err == nil {
		t.Error("oversized payload should err")
	}
}

func encodeRawPayloadForTest(t *testing.T, p any) string {
	t.Helper()
	raw, err := common.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}
