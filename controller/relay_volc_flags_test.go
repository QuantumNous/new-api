package controller

import (
	"encoding/json"
	"strconv"
	"testing"
)

func TestExtractVolcFlags_ParsesDuration(t *testing.T) {
	flags := extractVolcFlags([]byte(`{"duration":"15","resolution":"1080p","service_tier":"flex"}`))
	if flags.Duration != 15 {
		t.Fatalf("string duration = %d, want 15", flags.Duration)
	}
	if flags.Resolution != "1080p" {
		t.Fatalf("resolution = %q, want 1080p", flags.Resolution)
	}
	if flags.ServiceTier != "flex" {
		t.Fatalf("service_tier = %q, want flex", flags.ServiceTier)
	}

	flags = extractVolcFlags([]byte(`{"duration":20}`))
	if flags.Duration != 20 {
		t.Fatalf("numeric duration = %d, want 20", flags.Duration)
	}
}

func TestParseVolcDuration_JSONNumber(t *testing.T) {
	got, ok := parseVolcDuration(json.Number("20"))
	if !ok || got != 20 {
		t.Fatalf("parseVolcDuration(json.Number(20)) = (%d, %v), want (20, true)", got, ok)
	}
}

func TestParseVolcDuration_RejectsInvalid(t *testing.T) {
	cases := []struct {
		name string
		in   any
	}{
		{"non-integer float", float64(15.9)},
		{"negative float", float64(-1)},
		{"negative int", -3},
		{"negative json.Number", json.Number("-5")},
		{"non-numeric string", "abc"},
		{"negative string", "-10"},
		{"oversized float", float64(int(^uint(0)>>1)) * 2},
	}
	if strconv.IntSize < 64 {
		maxInt := int(^uint(0) >> 1)
		cases = append(cases, struct {
			name string
			in   any
		}{"oversized int64", int64(maxInt) + 1})
	}
	for _, tc := range cases {
		if got, ok := parseVolcDuration(tc.in); ok {
			t.Errorf("%s: parseVolcDuration(%v) = (%d, true), want (_, false)", tc.name, tc.in, got)
		}
	}
}
