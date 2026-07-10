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
//                  and optional quality tier
//                  (1K ≤ 1024px long-edge, 2K ≤ 2048px, 4K > 2048px)
//                  quality: low / medium / high
//
// Price lookup order for per_size:
//  quality set (low/medium/high):
//    1. price_matrix["{size}_{quality}"] e.g. "1k_high"
//    2. price_matrix["default"]
//    3. legacy price_1k / price_2k / price_4k
//    4. built-in hardcoded defaults
//  quality default/empty (size-aware first):
//    1. price_matrix["{size}_medium"]
//    2. legacy price for that size
//    3. price_matrix["default"]
//    4. built-in hardcoded defaults
//
// DB key: image_model_setting
// ---------------------------------------------------------------------------

const (
	ImageBillingModeToken   = "token"
	ImageBillingModePerSize = "per_size"

	ImageSizeTier1K = "1K"
	ImageSizeTier2K = "2K"
	ImageSizeTier4K = "4K"

	ImageQualityLow     = "low"
	ImageQualityMedium  = "medium"
	ImageQualityHigh    = "high"
	ImageQualityDefault = "default"
)

// ImageModelConfig holds the billing configuration for a single image model.
type ImageModelConfig struct {
	// BillingMode is either "token" (default) or "per_size".
	BillingMode string `json:"billing_mode"`
	// Price1K/2K/4K are legacy per-image prices (USD) for each resolution tier
	// without quality distinction. Kept for backward compatibility.
	// nil means "not set".
	Price1K *float64 `json:"price_1k,omitempty"`
	Price2K *float64 `json:"price_2k,omitempty"`
	Price4K *float64 `json:"price_4k,omitempty"`
	// PriceMatrix maps tier keys to USD per image.
	// Supported keys (case-insensitive):
	//   1k_low, 1k_medium, 1k_high,
	//   2k_low, 2k_medium, 2k_high,
	//   4k_low, 4k_medium, 4k_high,
	//   default
	PriceMatrix map[string]float64 `json:"price_matrix,omitempty"`
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
		// Normalize matrix keys to lowercase for stable lookup.
		if len(v.PriceMatrix) > 0 {
			norm := make(map[string]float64, len(v.PriceMatrix))
			for mk, mv := range v.PriceMatrix {
				norm[strings.ToLower(strings.TrimSpace(mk))] = mv
			}
			v.PriceMatrix = norm
		}
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
// per-resolution (optionally quality-aware) billing.
func IsImagePerSizeBilling(modelName string) bool {
	cfg, ok := GetImageModelConfig(modelName)
	if !ok {
		return false
	}
	return cfg.BillingMode == ImageBillingModePerSize
}

// BuildImagePriceTierKey builds a matrix key like "1k_high" from size + quality.
func BuildImagePriceTierKey(sizeTier, quality string) string {
	size := strings.ToLower(strings.TrimSpace(sizeTier))
	if size == "" {
		size = "2k"
	}
	q := NormalizeImageQuality(quality)
	if q == ImageQualityDefault {
		return ImageQualityDefault
	}
	return size + "_" + q
}

// NormalizeImageQuality maps request quality values to low/medium/high/default.
func NormalizeImageQuality(quality string) string {
	q := strings.ToLower(strings.TrimSpace(quality))
	switch q {
	case "", "auto", "default":
		return ImageQualityDefault
	case "low", "l":
		return ImageQualityLow
	case "medium", "med", "standard", "std", "m":
		// OpenAI dall-e-3 uses "standard"; gpt-image uses low/medium/high.
		return ImageQualityMedium
	case "high", "hd", "h":
		return ImageQualityHigh
	default:
		// Unknown quality: treat as default so admins can still bill.
		return ImageQualityDefault
	}
}

// GetImageTierPrice returns the per-image price (USD) for model + size + quality.
// Prefer this over GetImagePerSizePrice when quality is available.
func GetImageTierPrice(modelName, sizeTier, quality string) (price float64, tierKey string) {
	cfg, ok := GetImageModelConfig(modelName)
	if !ok || cfg.BillingMode != ImageBillingModePerSize {
		return 0, ""
	}

	sizeTierCanon, ok := ClassifyImageSizeTier(sizeTier)
	if !ok {
		// Accept already-canonical tiers even if Classify failed on empty.
		upper := strings.ToUpper(strings.TrimSpace(sizeTier))
		switch upper {
		case ImageSizeTier1K, ImageSizeTier2K, ImageSizeTier4K:
			sizeTierCanon = upper
			ok = true
		}
	}
	if !ok {
		sizeTierCanon = ImageSizeTier2K
	}

	q := NormalizeImageQuality(quality)
	legacyKey := strings.ToLower(sizeTierCanon) // 1k / 2k / 4k

	// quality default/empty: prefer size-aware fallbacks before matrix "default",
	// so legacy price_1k/2k/4k still win over a flat matrix default.
	if q == ImageQualityDefault {
		// 1) matrix size_medium
		if cfg.PriceMatrix != nil {
			medKey := BuildImagePriceTierKey(sizeTierCanon, ImageQualityMedium)
			if p, exists := cfg.PriceMatrix[medKey]; exists && p >= 0 {
				return p, medKey
			}
		}
		// 2) legacy price for that size
		if p, ok := legacyImageSizePrice(cfg, sizeTierCanon); ok {
			return p, legacyKey
		}
		// 3) matrix default
		if cfg.PriceMatrix != nil {
			if p, exists := cfg.PriceMatrix[ImageQualityDefault]; exists && p >= 0 {
				return p, ImageQualityDefault
			}
		}
		// 4) built-in defaults
		return defaultImagePerSizePrice(modelName, sizeTierCanon), legacyKey
	}

	// quality set (low/medium/high):
	// 1) exact matrix key (e.g. 1k_high)
	primaryKey := BuildImagePriceTierKey(sizeTierCanon, q)
	if cfg.PriceMatrix != nil {
		if p, exists := cfg.PriceMatrix[primaryKey]; exists && p >= 0 {
			return p, primaryKey
		}
		// 2) matrix default
		if p, exists := cfg.PriceMatrix[ImageQualityDefault]; exists && p >= 0 {
			return p, ImageQualityDefault
		}
	}
	// 3) legacy size-only prices
	if p, ok := legacyImageSizePrice(cfg, sizeTierCanon); ok {
		return p, legacyKey
	}
	// 4) built-in defaults (size only)
	return defaultImagePerSizePrice(modelName, sizeTierCanon), legacyKey
}

// legacyImageSizePrice returns the legacy price_1k/2k/4k value when set.
func legacyImageSizePrice(cfg ImageModelConfig, sizeTierCanon string) (float64, bool) {
	switch sizeTierCanon {
	case ImageSizeTier1K:
		if cfg.Price1K != nil {
			return *cfg.Price1K, true
		}
	case ImageSizeTier2K:
		if cfg.Price2K != nil {
			return *cfg.Price2K, true
		}
	case ImageSizeTier4K:
		if cfg.Price4K != nil {
			return *cfg.Price4K, true
		}
	}
	return 0, false
}

// GetImagePerSizePrice returns the per-image price (USD) for the given model
// and resolution tier (quality-agnostic legacy API).
func GetImagePerSizePrice(modelName, sizeTier string) float64 {
	price, _ := GetImageTierPrice(modelName, sizeTier, ImageQualityDefault)
	return price
}

// GetImagePriceMatrix returns a display copy of explicitly configured prices.
// Missing tiers are NOT densified from defaults — sparse matrices stay sparse so
// the pricing page only shows what the admin configured (same as video).
// Billing still falls back via GetImageTierPrice when a request hits an unlisted tier.
func GetImagePriceMatrix(modelName string) map[string]float64 {
	cfg, ok := GetImageModelConfig(modelName)
	if !ok || cfg.BillingMode != ImageBillingModePerSize {
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
	case ImageSizeTier1K, "1":
		return ImageSizeTier1K, true
	case ImageSizeTier2K, "2":
		return ImageSizeTier2K, true
	case ImageSizeTier4K, "4":
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
