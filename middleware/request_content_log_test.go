package middleware

import "testing"

func TestCapString(t *testing.T) {
	if capString("abcdef", 3) != "abc" {
		t.Fatal("truncate")
	}
	if capString("ab", 5) != "ab" {
		t.Fatal("short passthrough")
	}
}

func TestDetectStream(t *testing.T) {
	if !detectStream([]byte(`{"model":"x","stream":true}`)) {
		t.Fatal("stream true")
	}
	if detectStream([]byte(`{"model":"x"}`)) {
		t.Fatal("no stream")
	}
}
