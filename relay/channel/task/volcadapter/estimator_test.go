package volcadapter

import (
	"testing"
)

// TestParseResolution validates parseResolution corner cases.
func TestParseResolution(t *testing.T) {
	cases := []struct {
		res  string
		w, h int
	}{
		{"480p", 854, 480},
		{"720p", 1280, 720},
		{"1080p", 1920, 1080},
		{"1280x720", 1280, 720},
		{"1920x1080", 1920, 1080},
		{"", 1280, 720},   // fallback
		{"bad", 1280, 720}, // fallback
	}
	for _, tt := range cases {
		t.Run(tt.res, func(t *testing.T) {
			w, h := parseResolution(tt.res)
			if w != tt.w || h != tt.h {
				t.Errorf("parseResolution(%q) = (%d,%d), want (%d,%d)", tt.res, w, h, tt.w, tt.h)
			}
		})
	}
}

// TestEstimateSeedanceTokens covers the key estimation scenarios.
//
// Formula: tokens = (inputVideoDurSec + outputDurSec) × W × H × FPS / 1024
// FPS = 24 (fixed); integer division (floor).
//
// 5s  720p  text:        (0+5)  × 1280 × 720  × 24 / 1024 = 108_000
// 5s  1080p text:        (0+5)  × 1920 × 1080 × 24 / 1024 = 243_000
// 15s 1080p text:        (0+15) × 1920 × 1080 × 24 / 1024 = 729_000
// 15s 1080p + video ref: (15+15)× 1920 × 1080 × 24 / 1024 = 1_458_000
func TestEstimateSeedanceTokens(t *testing.T) {
	cases := []struct {
		name       string
		modelName  string
		body       []byte
		wantTokens int64
		tolerance  int64 // ±tolerance allowed
	}{
		{
			name:      "5s 720p text — explicit duration",
			modelName: "doubao-seedance-2-0-260128",
			body:      []byte(`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}],"duration":5,"resolution":"720p"}`),
			// (0+5) × 1280 × 720 × 24 / 1024 = 108_000
			wantTokens: 108_000,
			tolerance:  50,
		},
		{
			name:      "5s 1080p text — explicit resolution+duration",
			modelName: "doubao-seedance-1-0-pro-250528",
			body:      []byte(`{"model":"doubao-seedance-1-0-pro-250528","content":[{"type":"text","text":"hi"}],"duration":5,"resolution":"1080p"}`),
			// (0+5) × 1920 × 1080 × 24 / 1024 = 243_000
			wantTokens: 243_000,
			tolerance:  50,
		},
		{
			name:      "15s 1080p text — explicit",
			modelName: "doubao-seedance-1-0-pro-250528",
			body:      []byte(`{"model":"doubao-seedance-1-0-pro-250528","content":[{"type":"text","text":"hi"}],"duration":15,"resolution":"1080p"}`),
			// (0+15) × 1920 × 1080 × 24 / 1024 = 729_000
			wantTokens: 729_000,
			tolerance:  50,
		},
		{
			name:      "15s 1080p + video reference — upper bound",
			modelName: "doubao-seedance-2-0-260128",
			body:      []byte(`{"model":"doubao-seedance-2-0-260128","content":[{"type":"video_url","video_url":{"url":"x"}},{"type":"text","text":"hi"}],"duration":15,"resolution":"1080p"}`),
			// (15+15) × 1920 × 1080 × 24 / 1024 = 1_458_000
			wantTokens: 1_458_000,
			tolerance:  50,
		},
		{
			name:      "duration=-1 → use model max (15s for sd2.0)",
			modelName: "doubao-seedance-2-0-260128",
			body:      []byte(`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}],"duration":-1,"resolution":"720p"}`),
			// (0+15) × 1280 × 720 × 24 / 1024 = 324_000
			wantTokens: 324_000,
			tolerance:  50,
		},
		{
			name:      "duration absent → use model max (15s for sd2.0-fast)",
			modelName: "doubao-seedance-2-0-fast-260128",
			body:      []byte(`{"model":"doubao-seedance-2-0-fast-260128","content":[{"type":"text","text":"hi"}],"resolution":"720p"}`),
			// (0+15) × 1280 × 720 × 24 / 1024 = 324_000
			wantTokens: 324_000,
			tolerance:  50,
		},
		{
			name:      "frames=120 → 120/24=5s (exact)",
			modelName: "doubao-seedance-2-0-260128",
			body:      []byte(`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}],"frames":120,"resolution":"720p"}`),
			// (0+5) × 1280 × 720 × 24 / 1024 = 108_000
			wantTokens: 108_000,
			tolerance:  50,
		},
		{
			name:      "frames=121 → ceil(121/24)=6s",
			modelName: "doubao-seedance-2-0-260128",
			body:      []byte(`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}],"frames":121,"resolution":"720p"}`),
			// (0+6) × 1280 × 720 × 24 / 1024 = 129_600
			wantTokens: 129_600,
			tolerance:  50,
		},
		{
			name:      "draft mode (480p body, no discount) — 1.5 pro",
			modelName: "doubao-seedance-1-5-pro-251215",
			body:      []byte(`{"model":"doubao-seedance-1-5-pro-251215","content":[{"type":"text","text":"hi"}],"resolution":"480p","duration":5}`),
			// (0+5) × 854 × 480 × 24 / 1024 = 48_037 (integer div)
			wantTokens: 48_037,
			tolerance:  50,
		},
		{
			name:      "unknown model → fallback 720p, 12s max",
			modelName: "seedance-unknown-model",
			body:      []byte(`{"model":"seedance-unknown-model","content":[{"type":"text","text":"hi"}]}`),
			// (0+12) × 1280 × 720 × 24 / 1024 = 259_200
			wantTokens: 259_200,
			tolerance:  50,
		},
		{
			name:      "model default resolution — 1080p (1-0-pro)",
			modelName: "doubao-seedance-1-0-pro-250528",
			body:      []byte(`{"model":"doubao-seedance-1-0-pro-250528","content":[{"type":"text","text":"hi"}],"duration":5}`),
			// default 1080p: (0+5) × 1920 × 1080 × 24 / 1024 = 243_000
			wantTokens: 243_000,
			tolerance:  50,
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := EstimateSeedanceTokens(tt.modelName, tt.body)
			diff := got - tt.wantTokens
			if diff < 0 {
				diff = -diff
			}
			if diff > tt.tolerance {
				t.Errorf("EstimateSeedanceTokens(%q) = %d, want %d (±%d)", tt.modelName, got, tt.wantTokens, tt.tolerance)
			}
		})
	}
}

// TestEstimateSeedanceTokens_EmptyBody ensures no panic on empty/nil body.
func TestEstimateSeedanceTokens_EmptyBody(t *testing.T) {
	// nil body → model defaults
	got := EstimateSeedanceTokens("doubao-seedance-2-0-260128", nil)
	if got <= 0 {
		t.Errorf("expected positive estimate for nil body, got %d", got)
	}

	// empty bytes → model defaults
	got2 := EstimateSeedanceTokens("doubao-seedance-2-0-260128", []byte{})
	if got2 <= 0 {
		t.Errorf("expected positive estimate for empty body, got %d", got2)
	}
}
