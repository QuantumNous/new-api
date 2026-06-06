package model

import (
	"testing"
	"time"
)

func TestParseContextLengthToken(t *testing.T) {
	cases := []struct {
		name   string
		token  string
		want   int64
		wantOK bool
	}{
		{name: "200K", token: "200K", want: 200000, wantOK: true},
		{name: "1M", token: "1M", want: 1000000, wantOK: true},
		{name: "262.1K", token: "262.1K", want: 262100, wantOK: true},
		{name: "1.1M", token: "1.1M", want: 1100000, wantOK: true},
		{name: "1.5K", token: "1.5K", want: 1500, wantOK: true},
		{name: "lowercase 200k", token: "200k", want: 200000, wantOK: true},
		{name: "lowercase 1m", token: "1m", want: 1000000, wantOK: true},
		{name: "raw integer 128", token: "128", want: 128, wantOK: true},
		{name: "raw integer 200000", token: "200000", want: 200000, wantOK: true},
		{name: "whitespace around suffix", token: " 200K ", want: 200000, wantOK: true},
		{name: "not a number", token: "Tools", want: 0, wantOK: false},
		{name: "empty", token: "", want: 0, wantOK: false},
		{name: "just suffix", token: "K", want: 0, wantOK: false},
		{name: "negative raw", token: "-1", want: 0, wantOK: false},
		{name: "decimal with no suffix", token: "1.5", want: 0, wantOK: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parseContextLengthToken(tc.token)
			if !tc.wantOK {
				if got != nil {
					t.Fatalf("parseContextLengthToken(%q) = %d, want nil", tc.token, *got)
				}
				return
			}
			if got == nil {
				t.Fatalf("parseContextLengthToken(%q) = nil, want %d", tc.token, tc.want)
			}
			if *got != tc.want {
				t.Fatalf("parseContextLengthToken(%q) = %d, want %d", tc.token, *got, tc.want)
			}
		})
	}
}

func TestGetModelContextLength(t *testing.T) {
	// Snapshot the package-level cache and restore on exit so we don't
	// leak state into other tests.
	origPricing := pricingMap
	origTime := lastGetPricingTime
	t.Cleanup(func() {
		pricingMap = origPricing
		lastGetPricingTime = origTime
	})

	cases := []struct {
		name      string
		modelName string
		tags      string
		want      *int64
	}{
		{
			name:      "Reasoning,Tools,200K",
			modelName: "test-model-200k",
			tags:      "Reasoning,Tools,200K",
			want:      int64Ptr(200000),
		},
		{
			name:      "1M only",
			modelName: "test-model-1m",
			tags:      "1M",
			want:      int64Ptr(1000000),
		},
		{
			name:      "262.1K",
			modelName: "test-model-262-1k",
			tags:      "262.1K",
			want:      int64Ptr(262100),
		},
		{
			name:      "1.1M",
			modelName: "test-model-1-1m",
			tags:      "1.1M",
			want:      int64Ptr(1100000),
		},
		{
			name:      "no context token",
			modelName: "test-model-no-ctx",
			tags:      "Reasoning,Tools",
			want:      nil,
		},
		{
			name:      "empty tags",
			modelName: "test-model-empty",
			tags:      "",
			want:      nil,
		},
		{
			name:      "case and whitespace tolerance",
			modelName: "test-model-lower",
			tags:      "tools, 200k",
			want:      int64Ptr(200000),
		},
		{
			name:      "raw integer in middle",
			modelName: "test-model-raw-int",
			tags:      "a,128,b",
			want:      int64Ptr(128),
		},
		{
			name:      "1.5K",
			modelName: "test-model-1-5k",
			tags:      "1.5K",
			want:      int64Ptr(1500),
		},
		{
			name:      "unknown model",
			modelName: "definitely-not-in-cache",
			tags:      "",
			want:      nil,
		},
		{
			name:      "empty model name",
			modelName: "",
			tags:      "",
			want:      nil,
		},
	}

	// Build a single pricingMap containing one row per case model name.
	pricingMap = make([]Pricing, 0, len(cases))
	for _, tc := range cases {
		if tc.modelName == "" {
			continue
		}
		pricingMap = append(pricingMap, Pricing{
			ModelName: tc.modelName,
			Tags:      tc.tags,
		})
	}
	// Mark the cache fresh so GetPricing() does not try to refresh from
	// the (non-existent) database during this test.
	lastGetPricingTime = time.Now()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := GetModelContextLength(tc.modelName)
			if tc.want == nil {
				if got != nil {
					t.Fatalf("GetModelContextLength(%q) = %d, want nil", tc.modelName, *got)
				}
				return
			}
			if got == nil {
				t.Fatalf("GetModelContextLength(%q) = nil, want %d", tc.modelName, *tc.want)
			}
			if *got != *tc.want {
				t.Fatalf("GetModelContextLength(%q) = %d, want %d", tc.modelName, *got, *tc.want)
			}
		})
	}
}
