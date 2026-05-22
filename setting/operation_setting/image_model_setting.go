package operation_setting

import (
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/setting/config"
)

// ---------------------------------------------------------------------------
// Image model billing settings
//
// Admins can register any model name and choose between two billing modes:
//   - "token"    : standard token-ratio billing (default for all models)
//   - "per_size" : flat per-image price that varies by output resolution tier
//                  (1K ≤ 1024px long-edge, 2K ≤ 2048px, 4K > 2048px)
//
// DB key: image_model_setting
// ---------------------------------------------------------------------------

const (
	ImageBillingModeToken   = "token"
	ImageBillingModePerSize = "per_size"

	ImageSizeTier1K = "1K"
	ImageSizeTier2K = "2K"
	ImageSizeTier4K = "4K"
)

// ImageModelConfig holds the billing configuration for a single image model.
type ImageModelConfig struct {
	// BillingMode is either "token" (default) or "per_size".
	BillingMode string `json:"billing_mode"`
	// Price1K/2K/4K are the per-image prices (USD) for each resolution tier.
	// nil means "use the built-in hardcoded default for this model".
	Price1K *float64 `json:"price_1k,omitempty"`
	Price2K *float64 `json:"price_2k,omitempty"`
	Price4K *float64 `json:"price_4k,omitempty"`
}

// ImageModelSetting is the top-level config struct registered with GlobalConfig.
type ImageModelSetting struct {
	// Models maps model name → billing config.
	Models map[string]ImageModelConfig `json:"models"`
}

// defaultImageModels lists the well-known image models that are pre-populated
// in the admin UI. All default to token billing so existing behaviour is
// unchanged until an admin explicitly switches a model to per_size.
var defaultImageModels = map[string]ImageModelConfig{
	"gpt-image-1":          {BillingMode: ImageBillingModeToken},
	"gpt-image-1-mini":     {BillingMode: ImageBillingModeToken},
	"gpt-image-1.5":        {BillingMode: ImageBillingModeToken},
	"gpt-image-2":          {BillingMode: ImageBillingModeToken},
	"chatgpt-image-latest": {BillingMode: ImageBillingModeToken},
	"dall-e-2":             {BillingMode: ImageBillingModeToken},
	"dall-e-3":             {BillingMode: ImageBillingModeToken},
}

var imageModelSetting = ImageModelSetting{
	Models: func() map[string]ImageModelConfig {
		m := make(map[string]ImageModelConfig, len(defaultImageModels))
		for k, v := range defaultImageModels {
			m[k] = v
		}
		return m
	}(),
}

// currentImageModelSetting is an atomic snapshot used on the billing hot path.
var currentImageModelSetting atomic.Pointer[ImageModelSetting]

func init() {
	config.GlobalConfig.Register("image_model_setting", &imageModelSetting)
	rebuildImageModelIndex()
}

func rebuildImageModelIndex() {
	// Merge defaults with admin overrides: admin config wins.
	merged := make(map[string]ImageModelConfig, len(defaultImageModels)+len(imageModelSetting.Models))
	for k, v := range defaultImageModels {
		merged[k] = v
	}
	for k, v := range imageModelSetting.Models {
		merged[k] = v
	}
	snap := &ImageModelSetting{Models: merged}
	currentImageModelSetting.Store(snap)
}

// RebuildImageModelIndex must be called after imageModelSetting is updated
// (e.g. from config.GlobalConfig.OnUpdate).
func RebuildImageModelIndex() {
	rebuildImageModelIndex()
}

// GetImageModelConfig returns the billing config for a model.
// Returns (config, true) if the model is registered; (zero, false) otherwise.
func GetImageModelConfig(modelName string) (ImageModelConfig, bool) {
	snap := currentImageModelSetting.Load()
	if snap == nil {
		return ImageModelConfig{}, false
	}
	cfg, ok := snap.Models[modelName]
	return cfg, ok
}

// IsImagePerSizeBilling returns true when the model is configured for
// per-resolution billing.
func IsImagePerSizeBilling(modelName string) bool {
	cfg, ok := GetImageModelConfig(modelName)
	if !ok {
		return false
	}
	return cfg.BillingMode == ImageBillingModePerSize
}

// GetImagePerSizePrice returns the per-image price (USD) for the given model
// and resolution tier. Falls back to built-in defaults when the admin has not
// set a custom price.
func GetImagePerSizePrice(modelName, sizeTier string) float64 {
	cfg, ok := GetImageModelConfig(modelName)
	if !ok || cfg.BillingMode != ImageBillingModePerSize {
		return 0
	}

	switch strings.ToUpper(sizeTier) {
	case ImageSizeTier1K:
		if cfg.Price1K != nil {
			return *cfg.Price1K
		}
		return defaultImagePerSizePrice(modelName, ImageSizeTier1K)
	case ImageSizeTier2K:
		if cfg.Price2K != nil {
			return *cfg.Price2K
		}
		return defaultImagePerSizePrice(modelName, ImageSizeTier2K)
	case ImageSizeTier4K:
		if cfg.Price4K != nil {
			return *cfg.Price4K
		}
		return defaultImagePerSizePrice(modelName, ImageSizeTier4K)
	}
	return 0
}

// defaultImagePerSizePrice returns the hardcoded fallback price for a model
// and tier. These are the values shown in the UI when no custom price is set.
func defaultImagePerSizePrice(modelName, sizeTier string) float64 {
	// gpt-image-1 / gpt-image-1.5 / gpt-image-1-mini: map quality tiers to
	// size tiers (low→1K, medium→2K, high→4K) using the existing constants.
	if strings.HasPrefix(modelName, "gpt-image-1") || modelName == "chatgpt-image-latest" {
		switch sizeTier {
		case ImageSizeTier1K:
			return GPTImage1Low1024x1024 // $0.011
		case ImageSizeTier2K:
			return GPTImage1Medium1024x1024 // $0.042
		case ImageSizeTier4K:
			return GPTImage1High1024x1024 // $0.167
		}
	}
	// dall-e-3: map to existing price constants
	if modelName == "dall-e-3" {
		switch sizeTier {
		case ImageSizeTier1K:
			return 0.04
		case ImageSizeTier2K:
			return 0.08
		case ImageSizeTier4K:
			return 0.12
		}
	}
	// Generic fallback
	switch sizeTier {
	case ImageSizeTier1K:
		return 0.04
	case ImageSizeTier2K:
		return 0.08
	case ImageSizeTier4K:
		return 0.12
	}
	return 0
}

// ClassifyImageSizeTier maps a pixel-dimension string (e.g. "1024x1024",
// "2048x2048") or a tier label ("1K", "2K", "4K") to a canonical tier.
// Returns ("", false) when the input cannot be classified.
func ClassifyImageSizeTier(size string) (string, bool) {
	size = strings.TrimSpace(size)
	upper := strings.ToUpper(size)
	switch upper {
	case "", "AUTO":
		return "", false
	case ImageSizeTier1K:
		return ImageSizeTier1K, true
	case ImageSizeTier2K:
		return ImageSizeTier2K, true
	case ImageSizeTier4K:
		return ImageSizeTier4K, true
	}

	// Parse "WxH" or "W×H"
	size = strings.ReplaceAll(size, "×", "x")
	parts := strings.SplitN(strings.ToLower(size), "x", 2)
	if len(parts) != 2 {
		return "", false
	}
	w := parsePositiveInt(parts[0])
	h := parsePositiveInt(parts[1])
	if w <= 0 || h <= 0 {
		return "", false
	}
	maxEdge := w
	if h > maxEdge {
		maxEdge = h
	}
	switch {
	case maxEdge <= 1024:
		return ImageSizeTier1K, true
	case maxEdge <= 2048:
		return ImageSizeTier2K, true
	default:
		return ImageSizeTier4K, true
	}
}

func parsePositiveInt(s string) int {
	s = strings.TrimSpace(s)
	const maxDim = 65536 // image dimensions realistically never exceed this
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return -1
		}
		if n > (maxDim-9)/10 {
			return -1 // overflow guard
		}
		n = n*10 + int(c-'0')
	}
	return n
}

// GetDefaultImageModels returns a copy of the built-in default model list,
// used to pre-populate the admin UI.
func GetDefaultImageModels() map[string]ImageModelConfig {
	m := make(map[string]ImageModelConfig, len(defaultImageModels))
	for k, v := range defaultImageModels {
		m[k] = v
	}
	return m
}
