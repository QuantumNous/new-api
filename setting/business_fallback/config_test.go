package business_fallback

import (
	"strings"
	"testing"
)

func TestParseConfigDefault(t *testing.T) {
	cfg, err := ParseConfig("")
	if err != nil {
		t.Fatalf("ParseConfig default returned error: %v", err)
	}
	if !cfg.Enabled {
		t.Fatal("default config should be enabled")
	}
	if got := cfg.ImageGeneration.Families["gpt_image"].SelectModel; got != "gpt-image-2" {
		t.Fatalf("gpt_image select_model = %q, want gpt-image-2", got)
	}
	if got := cfg.ImageGeneration.Chains["gemini_image"]; len(got) != 3 || got[0] != "gemini_image" || got[1] != "gpt_image" || got[2] != "seedream" {
		t.Fatalf("gemini_image chain = %#v, want gemini_image -> gpt_image -> seedream", got)
	}
	if got := cfg.ImageGeneration.Health.SuccessRateThreshold; got != 0.3 {
		t.Fatalf("health threshold = %v, want 0.3", got)
	}
}

func TestParseConfigRejectsInvalidStructure(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "unknown chain target",
			body: `{
				"enabled": true,
				"image_generation": {
					"families": {
						"gpt_image": {"match_models": ["gpt-image-2"], "select_model": "gpt-image-2"}
					},
					"chains": {"gpt_image": ["missing"]},
					"health": {"success_rate_threshold": 0.3}
				}
			}`,
			want: "unknown target family",
		},
		{
			name: "bad threshold",
			body: `{
				"enabled": true,
				"image_generation": {
					"families": {
						"gpt_image": {"match_models": ["gpt-image-2"], "select_model": "gpt-image-2"}
					},
					"chains": {"gpt_image": ["gpt_image"]},
					"health": {"success_rate_threshold": 1.2}
				}
			}`,
			want: "between 0 and 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseConfig(tt.body)
			if err == nil {
				t.Fatal("ParseConfig returned nil error")
			}
			if !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("error = %q, want to contain %q", err.Error(), tt.want)
			}
		})
	}
}

func TestNormalizeConfigJSON(t *testing.T) {
	normalized, err := NormalizeConfigJSON(DefaultConfigJSON)
	if err != nil {
		t.Fatalf("NormalizeConfigJSON returned error: %v", err)
	}
	if strings.Contains(normalized, "\n") {
		t.Fatalf("normalized JSON should be compact, got %q", normalized)
	}
	if _, err := ParseConfig(normalized); err != nil {
		t.Fatalf("normalized JSON should parse: %v", err)
	}
}
