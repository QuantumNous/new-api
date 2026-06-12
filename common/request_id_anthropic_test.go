package common

import (
	"sort"
	"strings"
	"testing"
)

func TestEncodeAnthropicRequestIDFormat(t *testing.T) {
	id := EncodeAnthropicRequestID("internal-abc-123", 1781245943)

	if !strings.HasPrefix(id, "req_01") {
		t.Fatalf("expected req_01 prefix, got %q", id)
	}
	// "req_" + 24 chars = 28 total.
	if len(id) != len("req_")+24 {
		t.Fatalf("expected total length %d, got %d (%q)", len("req_")+24, len(id), id)
	}
	suffix := strings.TrimPrefix(id, "req_")
	assertAlphabet(t, suffix)
}

func TestEncodeAnthropicMessageIDFormat(t *testing.T) {
	id := EncodeAnthropicMessageID("gen-1781245943-9Q4Nyw8yXglc3sttYIim")

	if !strings.HasPrefix(id, "msg_01") {
		t.Fatalf("expected msg_01 prefix, got %q", id)
	}
	if len(id) != len("msg_")+24 {
		t.Fatalf("expected total length %d, got %d (%q)", len("msg_")+24, len(id), id)
	}
	suffix := strings.TrimPrefix(id, "msg_")
	assertAlphabet(t, suffix)
}

// assertAlphabet checks every char is in the 59-char alphabet and that the
// excluded ambiguous characters I, O, l never appear.
func assertAlphabet(t *testing.T, s string) {
	t.Helper()
	for _, r := range s {
		if !strings.ContainsRune(anthropicIDAlphabet, r) {
			t.Fatalf("char %q in %q is not in the base59 alphabet", string(r), s)
		}
		if r == 'I' || r == 'O' || r == 'l' {
			t.Fatalf("ambiguous char %q must not appear in %q", string(r), s)
		}
	}
}

func TestEncodeAnthropicRequestIDDeterministic(t *testing.T) {
	a := EncodeAnthropicRequestID("internal-abc-123", 1781245943)
	b := EncodeAnthropicRequestID("internal-abc-123", 1781245943)
	if a != b {
		t.Fatalf("expected deterministic output, got %q and %q", a, b)
	}

	c := EncodeAnthropicRequestID("internal-different", 1781245943)
	if a == c {
		t.Fatalf("different internal ids must not collide: both %q", a)
	}
}

func TestEncodeAnthropicMessageIDDeterministic(t *testing.T) {
	a := EncodeAnthropicMessageID("gen-1")
	b := EncodeAnthropicMessageID("gen-1")
	if a != b {
		t.Fatalf("expected deterministic output, got %q and %q", a, b)
	}
	if EncodeAnthropicMessageID("gen-1") == EncodeAnthropicMessageID("gen-2") {
		t.Fatalf("different upstream ids must not collide")
	}
}

func TestEncodeAnthropicRequestIDTimeOrdered(t *testing.T) {
	// Same internal id, increasing timestamps -> lexicographically increasing
	// ids (KSUID-style ordering observed on real Anthropic request ids).
	timestamps := []int64{1000, 1781245943, 1781245999, 1900000000}
	ids := make([]string, len(timestamps))
	for i, ts := range timestamps {
		ids[i] = EncodeAnthropicRequestID("same-internal-id", ts)
	}

	sorted := make([]string, len(ids))
	copy(sorted, ids)
	sort.Strings(sorted)

	for i := range ids {
		if ids[i] != sorted[i] {
			t.Fatalf("ids not in chronological lexical order:\noriginal=%v\nsorted=%v", ids, sorted)
		}
	}
}

func TestEncodeAnthropicRequestIDHandlesZeroTimestamp(t *testing.T) {
	id := EncodeAnthropicRequestID("internal", 0)
	if !strings.HasPrefix(id, "req_01") || len(id) != len("req_")+24 {
		t.Fatalf("zero timestamp should still produce a well-formed id, got %q", id)
	}
}
