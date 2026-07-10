package billing_setting

import (
	"regexp"
	"strconv"
	"strings"
)

const (
	PerSecondResolutionPriceField = "per_second_resolution_price"

	ResolutionTier480p  = "480p"
	ResolutionTier720p  = "720p"
	ResolutionTier1080p = "1080p"
	ResolutionTier4K    = "4k"
	ResolutionTierOther = "other"
)

// PerSecondResolutionPrice holds absolute $/second prices by resolution tier for one model.
// When any tier is configured, Other must be > 0 (enforced by admin UI / Resolve).
type PerSecondResolutionPrice map[string]float64

var sizeDimensionPattern = regexp.MustCompile(`(?i)(\d+)\s*[x*×]\s*(\d+)`)

func ensurePerSecondResolutionPriceMap() {
	if billingSetting.PerSecondResolutionPrice == nil {
		billingSetting.PerSecondResolutionPrice = make(map[string]PerSecondResolutionPrice)
	}
}

// GetPerSecondResolutionPrice returns the per-model resolution price table.
// ok is true only when the model has a usable table (other > 0).
func GetPerSecondResolutionPrice(model string) (PerSecondResolutionPrice, bool) {
	ensureBillingSettingMaps()
	ensurePerSecondResolutionPriceMap()
	if model == "" {
		return nil, false
	}
	prices, ok := billingSetting.PerSecondResolutionPrice[model]
	if !ok || prices == nil {
		return nil, false
	}
	if prices[ResolutionTierOther] <= 0 {
		return nil, false
	}
	return prices, true
}

func GetPerSecondResolutionPriceCopy() map[string]PerSecondResolutionPrice {
	ensurePerSecondResolutionPriceMap()
	out := make(map[string]PerSecondResolutionPrice, len(billingSetting.PerSecondResolutionPrice))
	for model, prices := range billingSetting.PerSecondResolutionPrice {
		if prices == nil {
			continue
		}
		cp := make(PerSecondResolutionPrice, len(prices))
		for k, v := range prices {
			cp[k] = v
		}
		out[model] = cp
	}
	return out
}

// HasPerSecondResolutionPrice reports whether the model uses resolution-tiered per-second pricing.
func HasPerSecondResolutionPrice(model string) bool {
	_, ok := GetPerSecondResolutionPrice(model)
	return ok
}

// NormalizeResolutionTier maps free-form resolution/size strings to a canonical tier key.
// Unknown values return ResolutionTierOther.
func NormalizeResolutionTier(raw string) string {
	s := strings.TrimSpace(strings.ToLower(raw))
	if s == "" {
		return ResolutionTierOther
	}
	s = strings.ReplaceAll(s, "_", "")
	s = strings.ReplaceAll(s, "-", "")
	s = strings.ReplaceAll(s, " ", "")

	switch s {
	case "480", "480p":
		return ResolutionTier480p
	case "720", "720p", "hd":
		return ResolutionTier720p
	case "1080", "1080p", "fhd", "fullhd":
		return ResolutionTier1080p
	case "4k", "2160", "2160p", "uhd", "ultra":
		return ResolutionTier4K
	}

	if m := sizeDimensionPattern.FindStringSubmatch(s); len(m) == 3 {
		w, _ := strconv.Atoi(m[1])
		h, _ := strconv.Atoi(m[2])
		return tierFromPixels(w, h)
	}

	// e.g. "720p" already handled; try trailing p number
	if strings.HasSuffix(s, "p") {
		if n, err := strconv.Atoi(strings.TrimSuffix(s, "p")); err == nil {
			return tierFromHeight(n)
		}
	}
	return ResolutionTierOther
}

func tierFromPixels(w, h int) string {
	if w <= 0 || h <= 0 {
		return ResolutionTierOther
	}
	// Use the shorter side (720 for 1280x720 / 720x1280).
	short := w
	if h < w {
		short = h
	}
	return tierFromHeight(short)
}

func tierFromHeight(n int) string {
	switch {
	case n >= 2160:
		return ResolutionTier4K
	case n >= 1080:
		return ResolutionTier1080p
	case n >= 720:
		return ResolutionTier720p
	case n >= 480:
		return ResolutionTier480p
	default:
		return ResolutionTierOther
	}
}

// ResolvePerSecondPrice picks the absolute $/second price for a resolution hint.
// fallback is used only when the model has no resolution table (caller should check Has first).
// When the table exists: exact tier price if > 0, else Other (required).
func ResolvePerSecondPrice(prices PerSecondResolutionPrice, resolutionHint string, fallback float64) (price float64, tier string) {
	if prices == nil || prices[ResolutionTierOther] <= 0 {
		return fallback, ResolutionTierOther
	}
	tier = NormalizeResolutionTier(resolutionHint)
	if tier != ResolutionTierOther {
		if p := prices[tier]; p > 0 {
			return p, tier
		}
	}
	return prices[ResolutionTierOther], ResolutionTierOther
}
