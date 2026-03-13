package gemini

import (
	"strconv"
	"strings"
)

// ParseVeoDurationSeconds extracts durationSeconds from metadata.
// Returns 8 (Veo default) when not specified or invalid.
func ParseVeoDurationSeconds(metadata map[string]any) int {
	if metadata == nil {
		return 8
	}
	v, ok := metadata["durationSeconds"]
	if !ok {
		return 8
	}
	switch n := v.(type) {
	case float64:
		if int(n) > 0 {
			return int(n)
		}
	case int:
		if n > 0 {
			return n
		}
	}
	return 8
}

// ParseVeoResolution extracts resolution from metadata.
// Returns "720p" when not specified.
func ParseVeoResolution(metadata map[string]any) string {
	if metadata == nil {
		return "720p"
	}
	v, ok := metadata["resolution"]
	if !ok {
		return "720p"
	}
	if s, ok := v.(string); ok && s != "" {
		return strings.ToLower(s)
	}
	return "720p"
}

// ResolveVeoDuration returns the effective duration in seconds.
// Priority: metadata["durationSeconds"] > stdDuration > stdSeconds > default (8).
func ResolveVeoDuration(metadata map[string]any, stdDuration int, stdSeconds string) int {
	if metadata != nil {
		if _, exists := metadata["durationSeconds"]; exists {
			if d := ParseVeoDurationSeconds(metadata); d > 0 {
				return d
			}
		}
	}
	if stdDuration > 0 {
		return stdDuration
	}
	if s, err := strconv.Atoi(stdSeconds); err == nil && s > 0 {
		return s
	}
	return 8
}

// ResolveVeoResolution returns the effective resolution string (lowercase).
// Priority: metadata["resolution"] > SizeToVeoResolution(stdSize) > default ("720p").
func ResolveVeoResolution(metadata map[string]any, stdSize string) string {
	if metadata != nil {
		if _, exists := metadata["resolution"]; exists {
			if r := ParseVeoResolution(metadata); r != "" {
				return r
			}
		}
	}
	if stdSize != "" {
		return SizeToVeoResolution(stdSize)
	}
	return "720p"
}

// SizeToVeoResolution converts a "WxH" size string to a Veo resolution label.
func SizeToVeoResolution(size string) string {
	parts := strings.SplitN(strings.ToLower(size), "x", 2)
	if len(parts) != 2 {
		return "720p"
	}
	w, _ := strconv.Atoi(parts[0])
	h, _ := strconv.Atoi(parts[1])
	maxDim := w
	if h > maxDim {
		maxDim = h
	}
	if maxDim >= 3840 {
		return "4k"
	}
	if maxDim >= 1920 {
		return "1080p"
	}
	return "720p"
}

// SizeToVeoAspectRatio converts a "WxH" size string to a Veo aspect ratio.
func SizeToVeoAspectRatio(size string) string {
	parts := strings.SplitN(strings.ToLower(size), "x", 2)
	if len(parts) != 2 {
		return "16:9"
	}
	w, _ := strconv.Atoi(parts[0])
	h, _ := strconv.Atoi(parts[1])
	if w <= 0 || h <= 0 {
		return "16:9"
	}
	if h > w {
		return "9:16"
	}
	return "16:9"
}

// VeoResolutionRatio returns the pricing multiplier for the given resolution.
// Standard resolutions (720p, 1080p) return 1.0.
// 4K returns a model-specific multiplier based on Google's official pricing.
func VeoResolutionRatio(modelName, resolution string) float64 {
	if resolution != "4k" {
		return 1.0
	}
	// 4K multipliers derived from Vertex AI official pricing (video+audio base):
	//   veo-3.1-generate:      $0.60 / $0.40 = 1.5
	//   veo-3.1-fast-generate: $0.35 / $0.15 ≈ 2.333
	// Veo 3.0 models do not support 4K; return 1.0 as fallback.
	if strings.Contains(modelName, "3.1-fast-generate") {
		return 2.333333
	}
	if strings.Contains(modelName, "3.1-generate") || strings.Contains(modelName, "3.1") {
		return 1.5
	}
	return 1.0
}
