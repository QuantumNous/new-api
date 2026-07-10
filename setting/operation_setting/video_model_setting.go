package operation_setting

import (
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/setting/config"
)

// ---------------------------------------------------------------------------
// Video model billing settings (per-second by resolution)
//
// Admins can register any video model name and choose:
//   - "token"       : existing token / adapter OtherRatio billing (default)
//   - "per_second"  : flat USD-per-second price that varies by output resolution
//
// Price lookup order for per_second:
//  1. price_matrix["{resolution}"] e.g. "1080p", "4k"
//  2. price_matrix["default"]
//  3. 0 (not configured)
//
// DB key: video_model_setting
// ---------------------------------------------------------------------------

const (
	VideoBillingModeToken     = "token"
	VideoBillingModePerSecond = "per_second"

	VideoResolution480p    = "480p"
	VideoResolution720p    = "720p"
	VideoResolution1080p   = "1080p"
	VideoResolution4K      = "4k"
	VideoResolutionDefault = "default"
)

// VideoModelConfig holds billing configuration for a single video model.
type VideoModelConfig struct {
	// BillingMode is "token" (default) or "per_second".
	BillingMode string `json:"billing_mode"`
	// PriceMatrix maps resolution keys to USD per second.
	// Supported keys (case-insensitive): 480p, 720p, 1080p, 4k, default
	PriceMatrix map[string]float64 `json:"price_matrix,omitempty"`
	// DefaultSeconds used for pre-charge when request omits duration.
	// 0 means fall back to 5.
	DefaultSeconds int `json:"default_seconds,omitempty"`
}

// VideoModelSetting is the top-level config registered with GlobalConfig.
type VideoModelSetting struct {
	Models map[string]VideoModelConfig `json:"models"`
}

var videoModelSetting = VideoModelSetting{
	Models: map[string]VideoModelConfig{},
}

var currentVideoModelSetting atomic.Pointer[VideoModelSetting]

func init() {
	config.GlobalConfig.Register("video_model_setting", &videoModelSetting)
	rebuildVideoModelIndex()
}

func rebuildVideoModelIndex() {
	merged := make(map[string]VideoModelConfig, len(videoModelSetting.Models))
	for k, v := range videoModelSetting.Models {
		if len(v.PriceMatrix) > 0 {
			norm := make(map[string]float64, len(v.PriceMatrix))
			for mk, mv := range v.PriceMatrix {
				norm[normalizeVideoResolutionKey(mk)] = mv
			}
			v.PriceMatrix = norm
		}
		if v.BillingMode == "" {
			v.BillingMode = VideoBillingModeToken
		}
		merged[k] = v
	}
	snap := &VideoModelSetting{Models: merged}
	currentVideoModelSetting.Store(snap)
}

// RebuildVideoModelIndex must be called after videoModelSetting is updated.
func RebuildVideoModelIndex() {
	rebuildVideoModelIndex()
}

// GetVideoModelConfig returns config for a model.
func GetVideoModelConfig(modelName string) (VideoModelConfig, bool) {
	snap := currentVideoModelSetting.Load()
	if snap == nil {
		return VideoModelConfig{}, false
	}
	cfg, ok := snap.Models[modelName]
	return cfg, ok
}

// IsVideoPerSecondBilling reports whether the model uses per-second billing.
func IsVideoPerSecondBilling(modelName string) bool {
	cfg, ok := GetVideoModelConfig(modelName)
	if !ok {
		return false
	}
	return cfg.BillingMode == VideoBillingModePerSecond
}

// NormalizeVideoResolution maps free-form resolution strings to canonical keys.
// Examples: "1080P", "1920x1080", "4K", "2160p" → 1080p / 4k ...
func NormalizeVideoResolution(resolution string) string {
	r := strings.ToLower(strings.TrimSpace(resolution))
	r = strings.ReplaceAll(r, " ", "")
	switch r {
	case "", "auto", "default":
		return VideoResolutionDefault
	case "480", "480p", "sd":
		return VideoResolution480p
	case "720", "720p", "hd":
		return VideoResolution720p
	case "1080", "1080p", "fhd", "fullhd":
		return VideoResolution1080p
	case "4k", "2160", "2160p", "uhd":
		return VideoResolution4K
	}

	// WxH pixel form
	r = strings.ReplaceAll(r, "×", "x")
	if parts := strings.SplitN(r, "x", 2); len(parts) == 2 {
		w := parsePositiveInt(parts[0])
		h := parsePositiveInt(parts[1])
		if w > 0 && h > 0 {
			maxEdge := w
			if h > maxEdge {
				maxEdge = h
			}
			switch {
			case maxEdge <= 854:
				return VideoResolution480p
			case maxEdge <= 1280:
				return VideoResolution720p
			case maxEdge <= 1920:
				return VideoResolution1080p
			default:
				return VideoResolution4K
			}
		}
	}

	// Trailing p form like "1440p"
	if strings.HasSuffix(r, "p") {
		n := parsePositiveInt(strings.TrimSuffix(r, "p"))
		switch {
		case n <= 480:
			return VideoResolution480p
		case n <= 720:
			return VideoResolution720p
		case n <= 1080:
			return VideoResolution1080p
		default:
			return VideoResolution4K
		}
	}

	return VideoResolutionDefault
}

func normalizeVideoResolutionKey(key string) string {
	k := strings.ToLower(strings.TrimSpace(key))
	switch k {
	case "480", "480p":
		return VideoResolution480p
	case "720", "720p":
		return VideoResolution720p
	case "1080", "1080p":
		return VideoResolution1080p
	case "4k", "2160", "2160p":
		return VideoResolution4K
	case "default", "":
		return VideoResolutionDefault
	default:
		return NormalizeVideoResolution(k)
	}
}

// GetVideoPerSecondPrice returns USD/second for model + resolution.
func GetVideoPerSecondPrice(modelName, resolution string) (price float64, tierKey string) {
	cfg, ok := GetVideoModelConfig(modelName)
	if !ok || cfg.BillingMode != VideoBillingModePerSecond {
		return 0, ""
	}
	key := NormalizeVideoResolution(resolution)
	if cfg.PriceMatrix != nil {
		if p, exists := cfg.PriceMatrix[key]; exists && p >= 0 {
			return p, key
		}
		if p, exists := cfg.PriceMatrix[VideoResolutionDefault]; exists && p >= 0 {
			return p, VideoResolutionDefault
		}
	}
	return 0, key
}

// GetVideoPriceMatrix returns a display copy of explicitly configured prices.
// Missing tiers are NOT filled from default — sparse matrices stay sparse so
// the pricing page only shows what the admin configured. Billing still falls
// back to default via GetVideoPerSecondPrice when a request hits an unlisted tier.
func GetVideoPriceMatrix(modelName string) map[string]float64 {
	cfg, ok := GetVideoModelConfig(modelName)
	if !ok || cfg.BillingMode != VideoBillingModePerSecond {
		return nil
	}
	if len(cfg.PriceMatrix) == 0 {
		return map[string]float64{}
	}
	out := make(map[string]float64, len(cfg.PriceMatrix))
	for k, v := range cfg.PriceMatrix {
		out[k] = v
	}
	return out
}

// GetVideoDefaultSeconds returns default duration for pre-charge.
func GetVideoDefaultSeconds(modelName string) int {
	cfg, ok := GetVideoModelConfig(modelName)
	if !ok || cfg.DefaultSeconds <= 0 {
		return 5
	}
	return cfg.DefaultSeconds
}

// ResolveVideoDurationSeconds extracts duration from common request fields.
// Prefer parseable seconds string > duration int > model default.
func ResolveVideoDurationSeconds(secondsStr string, duration int, modelName string) int {
	if n := parsePositiveInt(secondsStr); n > 0 {
		return n
	}
	if duration > 0 {
		return duration
	}
	return GetVideoDefaultSeconds(modelName)
}
