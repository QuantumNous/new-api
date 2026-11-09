package tokenkit

import (
	"math"
	"strings"
)

// Image describes one input image.
type Image struct {
	// Width and Height are the pixel dimensions. Zero or negative means
	// unknown; where size matters, a 1024×1024 image is assumed.
	Width, Height int
	// Detail is the OpenAI detail level (low, high, auto, original) or the
	// Gemini media resolution (MEDIA_RESOLUTION_LOW, _MEDIUM, _HIGH,
	// _ULTRA_HIGH). Empty means the provider default. Each family ignores
	// values meant for the other.
	Detail string
}

const (
	unknownImageSide = 1024
	// Larger sides are scaled down first; OpenAI does the same for original
	// detail and every other provider rejects such images.
	maxImageSide = 65535
	// OpenAI rejects images that need more patches, so no estimate exceeds it.
	maxImagePatches = 30000
	// Earlier flat estimate, kept for models whose sizing rules are unknown.
	unknownFamilyImageTokens = 520
)

// ImageTokens returns the prompt tokens one image costs on model.
func ImageTokens(model string, img Image) int {
	w, h := img.Width, img.Height
	if w <= 0 || h <= 0 {
		w, h = unknownImageSide, unknownImageSide
	}
	if w > maxImageSide || h > maxImageSide {
		w, h = fitWithin(w, h, maxImageSide)
	}

	switch ModelFamily(model) {
	case FamilyOpenAI:
		return openAIImageRuleFor(model, img.Detail).tokens(w, h)
	case FamilyClaude:
		// Standard tier; each image adds 4 tokens of framing (measured).
		w, h = claudeResizedSize(w, h, 1568, 1568)
		return ceilDiv(w, 28)*ceilDiv(h, 28) + 4
	case FamilyClaude47:
		// High-resolution tier; each image adds 3 tokens of framing (measured).
		w, h = claudeResizedSize(w, h, 2576, 4784)
		return ceilDiv(w, 28)*ceilDiv(h, 28) + 3
	case FamilyGemini:
		if geminiUsesMediaResolution(model) {
			return geminiMediaResolutionTokens(img.Detail)
		}
		return geminiTileImageTokens(w, h)
	default:
		return unknownFamilyImageTokens
	}
}

// ImageNeedsSize reports whether ImageTokens depends on the image dimensions
// for model and detail. When it returns false, callers can skip reading the
// image.
func ImageNeedsSize(model, detail string) bool {
	switch ModelFamily(model) {
	case FamilyOpenAI:
		rule := openAIImageRuleFor(model, detail)
		return rule.tileTokens == 0 || !rule.lowDetail
	case FamilyClaude, FamilyClaude47:
		return true
	case FamilyGemini:
		return !geminiUsesMediaResolution(model)
	default:
		return false
	}
}

// openAIImageRule is the sizing rule for one OpenAI model and detail level,
// from https://developers.openai.com/api/docs/guides/images-vision and
// measured upstream usage.
type openAIImageRule struct {
	// Tile-based models cost baseTokens plus tileTokens per 512px tile.
	baseTokens, tileTokens int
	lowDetail              bool

	// Patch-based models cost 32px patches times multiplier. The multiplier
	// is a float32 because upstream bills that way: 1225 patches × 1.2 bills
	// 1471, not 1470.
	multiplier float32
	maxSide    int // fit within maxSide × maxSide
	shortSide  int // scale the shortest side down to shortSide
	budget     int // resizing patch budget
}

func openAIImageRuleFor(model, detail string) openAIImageRule {
	model = strings.ToLower(model)
	detail = strings.ToLower(detail)
	switch detail {
	case "low", "high", "original":
	default:
		detail = "auto"
	}
	major, minor, isGPT := modelVersion(model, "gpt-")

	switch {
	case isGPT && major >= 6:
		// gpt-6-astra: auto means original. Upstream fits high within 2048
		// before the 2,500-patch budget; the documentation omits the 2048 limit.
		switch detail {
		case "low":
			return openAIImageRule{multiplier: 1.2, maxSide: 512}
		case "high":
			return openAIImageRule{multiplier: 1.2, maxSide: 2048, budget: 2500}
		default:
			return openAIImageRule{multiplier: 1.2}
		}
	case isGPT && major == 5 && minor >= 5:
		// gpt-5.5 and gpt-5.6: auto means original. Upstream bills high as
		// fit 2048 then shortest side 768, not the documented 2,500-patch budget.
		switch detail {
		case "low":
			return openAIImageRule{multiplier: 1.2, maxSide: 512}
		case "high":
			return openAIImageRule{multiplier: 1.2, maxSide: 2048, shortSide: 768}
		}
		if minor == 5 {
			return openAIImageRule{multiplier: 1.2, maxSide: 6000, budget: 10000}
		}
		return openAIImageRule{multiplier: 1.2}
	case isGPT && major == 5 && minor == 4:
		// gpt-5.4: auto means high.
		switch detail {
		case "low":
			return openAIImageRule{multiplier: 1.2, maxSide: 2048, budget: 6144}
		case "original":
			return openAIImageRule{multiplier: 1.2, maxSide: 6000, budget: 10000}
		default:
			return openAIImageRule{multiplier: 1.2, maxSide: 2048, budget: 2500}
		}
	case isGPT && major == 5 && minor >= 2:
		return openAIImageRule{multiplier: 1.2, maxSide: 2048, budget: 6144}
	case isGPT && major == 5 && minor == 0 && strings.Contains(model, "nano"):
		return openAIImageRule{multiplier: 1.5, budget: 1536}
	case isGPT && major == 5 && minor == 0 && strings.Contains(model, "mini"):
		return openAIImageRule{multiplier: 1.2, budget: 1536}
	case isGPT && major == 5:
		return openAIImageRule{baseTokens: 70, tileTokens: 140, lowDetail: detail == "low"}
	case isGPT && major == 4 && minor == 1 && strings.Contains(model, "mini"):
		return openAIImageRule{multiplier: 1.62, maxSide: 2048, budget: 6144}
	case isGPT && major == 4 && minor == 1 && strings.Contains(model, "nano"):
		return openAIImageRule{multiplier: 2.46, budget: 1536}
	case strings.Contains(model, "4o-mini"):
		return openAIImageRule{baseTokens: 2833, tileTokens: 5667, lowDetail: detail == "low"}
	case strings.Contains(model, "o4-mini"):
		return openAIImageRule{multiplier: 1.72, budget: 1536}
	case !isGPT && (strings.Contains(model, "o1") || strings.Contains(model, "o3")):
		return openAIImageRule{baseTokens: 75, tileTokens: 150, lowDetail: detail == "low"}
	default:
		// gpt-4o, gpt-4.1, gpt-4.5, and older vision models.
		return openAIImageRule{baseTokens: 85, tileTokens: 170, lowDetail: detail == "low"}
	}
}

func (r openAIImageRule) tokens(w, h int) int {
	if r.tileTokens > 0 {
		if r.lowDetail {
			return r.baseTokens
		}
		w, h = fitWithin(w, h, 2048)
		w, h = shrinkShortSide(w, h, 768)
		return r.baseTokens + r.tileTokens*ceilDiv(w, 512)*ceilDiv(h, 512)
	}

	if r.maxSide > 0 {
		w, h = fitWithin(w, h, r.maxSide)
	}
	patches := ceilDiv(w, 32) * ceilDiv(h, 32)
	if short, long := min(w, h), max(w, h); r.shortSide > 0 && short > r.shortSide {
		// Upstream keeps the long side unrounded here: 3000x2000 fits to
		// 2048x1365, and 2048 x 768/1365 = 1152.3 needs 37 patch columns.
		patches = ceilDiv(r.shortSide, 32) * ceilDiv(long*r.shortSide, short*32)
	}
	if r.budget > 0 && patches > r.budget {
		shrink := math.Sqrt(float64(32*32*r.budget) / (float64(w) * float64(h)))
		scaledW, scaledH := float64(w)*shrink/32, float64(h)*shrink/32
		shrink *= min(math.Floor(scaledW)/scaledW, math.Floor(scaledH)/scaledH)
		w, h = max(int(float64(w)*shrink), 1), max(int(float64(h)*shrink), 1)
		patches = ceilDiv(w, 32) * ceilDiv(h, 32)
	}
	patches = min(patches, maxImagePatches)
	return int(math.Ceil(float64(patches) * float64(r.multiplier)))
}

// claudeResizedSize is the size Claude scales an image to: the largest
// aspect-preserving size whose padded sides fit maxEdge and whose 28px patches
// fit maxTokens. Reference implementation:
// https://platform.claude.com/docs/en/build-with-claude/vision-coordinates
func claudeResizedSize(width, height, maxEdge, maxTokens int) (int, int) {
	if claudeImageFits(width, height, maxEdge, maxTokens) {
		return width, height
	}
	if height > width {
		resizedH, resizedW := claudeResizedSize(height, width, maxEdge, maxTokens)
		return resizedW, resizedH
	}
	aspectRatio := float64(width) / float64(height)
	lo, hi := 1, width // lo always fits; hi never fits
	for lo+1 < hi {
		mid := (lo + hi) / 2
		if claudeImageFits(mid, max(int(math.RoundToEven(float64(mid)/aspectRatio)), 1), maxEdge, maxTokens) {
			lo = mid
		} else {
			hi = mid
		}
	}
	return lo, max(int(math.RoundToEven(float64(lo)/aspectRatio)), 1)
}

func claudeImageFits(w, h, maxEdge, maxTokens int) bool {
	return ceilDiv(w, 28)*28 <= maxEdge && ceilDiv(h, 28)*28 <= maxEdge && ceilDiv(w, 28)*ceilDiv(h, 28) <= maxTokens
}

// geminiUsesMediaResolution reports whether a lower-cased Gemini model bills
// images by media resolution regardless of size (Gemini 3 and later, and names
// without a version).
func geminiUsesMediaResolution(model string) bool {
	major, _, ok := modelVersion(strings.ToLower(model), "gemini-")
	return !ok || major >= 3
}

// geminiMediaResolutionTokens returns the documented per-image cost for a
// Gemini media resolution. Measured costs run 2-9% lower depending on aspect.
func geminiMediaResolutionTokens(detail string) int {
	level, ok := strings.CutPrefix(strings.ToLower(detail), "media_resolution_")
	if !ok {
		return 1120
	}
	switch level {
	case "low":
		return 280
	case "medium":
		return 560
	case "ultra_high":
		return 2240
	default:
		return 1120
	}
}

// geminiTileImageTokens follows the Gemini 2.x rule measured on gemini-2.5-flash:
// images up to 384px on both sides cost one 258-token tile; larger images are
// cut into square tiles of a third less than the shortest side (256 to 768px),
// at most 12, plus one thumbnail tile. 4K images bill below this cap.
func geminiTileImageTokens(w, h int) int {
	if w <= 384 && h <= 384 {
		return 258
	}
	tile := min(max(min(w, h)*2/3, 256), 768)
	tiles := min(ceilDiv(w, tile)*ceilDiv(h, tile), 12)
	return (tiles + 1) * 258
}

// fitWithin scales an image down so neither side exceeds limit, rounding the
// shorter side down. Smaller images are not enlarged.
func fitWithin(w, h, limit int) (int, int) {
	if w <= limit && h <= limit {
		return w, h
	}
	if w >= h {
		return limit, max(int(int64(h)*int64(limit)/int64(w)), 1)
	}
	return max(int(int64(w)*int64(limit)/int64(h)), 1), limit
}

// shrinkShortSide scales an image down so its shortest side is at most limit,
// rounding the other side down.
func shrinkShortSide(w, h, limit int) (int, int) {
	if min(w, h) <= limit {
		return w, h
	}
	if w <= h {
		return limit, max(int(int64(h)*int64(limit)/int64(w)), 1)
	}
	return max(int(int64(w)*int64(limit)/int64(h)), 1), limit
}

func ceilDiv(a, b int) int {
	return (a + b - 1) / b
}
