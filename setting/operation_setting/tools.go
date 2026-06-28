package operation_setting

import (
	"sort"
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/setting/config"
)

// ---------------------------------------------------------------------------
// Tool call prices ($/1K calls, admin-configurable)
// DB key: tool_price_setting.prices
//
// Key format:
//   - "tool_name"              → default price for all models
//   - "tool_name:model_prefix*" → override for models matching the prefix
//
// Lookup order: longest prefix match → default → hardcoded fallback → 0
// ---------------------------------------------------------------------------

var defaultToolPrices = map[string]float64{
	"web_search":         10.0, // OpenAI web search (all models) / Claude web search
	"web_search_preview": 10.0, // OpenAI web search preview (default: reasoning models)
	"file_search":        2.5,  // OpenAI file search (Responses API)
	"google_search":      14.0, // Gemini Grounding with Google Search
}

var defaultToolPriceOverrides = map[string]float64{
	"web_search_preview:gpt-4o*":       25.0, // non-reasoning models
	"web_search_preview:gpt-4.1*":      25.0,
	"web_search_preview:gpt-4o-mini*":  25.0,
	"web_search_preview:gpt-4.1-mini*": 25.0,
}

// ToolPriceSetting is managed by config.GlobalConfig.Register.
type ToolPriceSetting struct {
	Prices map[string]float64 `json:"prices"`
}

var toolPriceSetting = ToolPriceSetting{
	Prices: func() map[string]float64 {
		m := make(map[string]float64, len(defaultToolPrices)+len(defaultToolPriceOverrides))
		for k, v := range defaultToolPrices {
			m[k] = v
		}
		for k, v := range defaultToolPriceOverrides {
			m[k] = v
		}
		return m
	}(),
}

func init() {
	config.GlobalConfig.Register("tool_price_setting", &toolPriceSetting)
	RebuildToolPriceIndex()
}

// ---------------------------------------------------------------------------
// Precomputed price index (atomic, lock-free on read path)
// ---------------------------------------------------------------------------

type prefixEntry struct {
	prefix string
	price  float64
}

type toolPriceIndex struct {
	defaults map[string]float64
	prefixes map[string][]prefixEntry
}

var currentIndex atomic.Pointer[toolPriceIndex]

// RebuildToolPriceIndex rebuilds the lookup index from the current config.
// Called on init and after config updates. Not on the billing hot path.
func RebuildToolPriceIndex() {
	merged := make(map[string]float64, len(defaultToolPrices)+len(defaultToolPriceOverrides)+len(toolPriceSetting.Prices))
	for k, v := range defaultToolPrices {
		merged[k] = v
	}
	for k, v := range defaultToolPriceOverrides {
		merged[k] = v
	}
	for k, v := range toolPriceSetting.Prices {
		merged[k] = v
	}

	idx := &toolPriceIndex{
		defaults: make(map[string]float64),
		prefixes: make(map[string][]prefixEntry),
	}

	for key, price := range merged {
		colonIdx := strings.IndexByte(key, ':')
		if colonIdx < 0 {
			idx.defaults[key] = price
			continue
		}
		toolName := key[:colonIdx]
		modelPart := key[colonIdx+1:]
		prefix := strings.TrimSuffix(modelPart, "*")
		idx.prefixes[toolName] = append(idx.prefixes[toolName], prefixEntry{prefix: prefix, price: price})
	}

	for tool := range idx.prefixes {
		entries := idx.prefixes[tool]
		sort.Slice(entries, func(i, j int) bool {
			return len(entries[i].prefix) > len(entries[j].prefix)
		})
		idx.prefixes[tool] = entries
	}

	currentIndex.Store(idx)
}

// GetToolPriceForModel returns the price ($/1K calls) for a tool given a model name.
// Lookup: longest prefix match → tool default → 0.
func GetToolPriceForModel(toolName, modelName string) float64 {
	idx := currentIndex.Load()
	if idx == nil {
		if v, ok := defaultToolPrices[toolName]; ok {
			return v
		}
		return 0
	}

	if entries, ok := idx.prefixes[toolName]; ok && modelName != "" {
		for _, e := range entries {
			if strings.HasPrefix(modelName, e.prefix) {
				return e.price
			}
		}
	}

	if p, ok := idx.defaults[toolName]; ok {
		return p
	}
	return 0
}

// GetToolPrice is a convenience wrapper when no model name is needed.
func GetToolPrice(toolName string) float64 {
	return GetToolPriceForModel(toolName, "")
}

// ---------------------------------------------------------------------------
// GPT Image 1 per-call pricing (special: depends on quality + size)
//
// [custom] The price grid, the fallback default, and whether the surcharge
// scales with the group ratio are admin-configurable.
// DB keys: gpt_image1_price_setting.prices / .default_price / .use_group_ratio
// ---------------------------------------------------------------------------

const (
	GPTImage1Low1024x1024    = 0.011
	GPTImage1Low1024x1536    = 0.016
	GPTImage1Low1536x1024    = 0.016
	GPTImage1Medium1024x1024 = 0.042
	GPTImage1Medium1024x1536 = 0.063
	GPTImage1Medium1536x1024 = 0.063
	GPTImage1High1024x1024   = 0.167
	GPTImage1High1024x1536   = 0.25
	GPTImage1High1536x1024   = 0.25
)

// GPTImage1PriceSetting is managed by config.GlobalConfig.Register.
// Prices maps quality -> size -> $/call. DefaultPrice is the fallback when the
// quality/size pair is unknown (no longer the highest tier). UseGroupRatio
// controls whether the image surcharge is multiplied by the group ratio.
type GPTImage1PriceSetting struct {
	Prices        map[string]map[string]float64 `json:"prices"`
	DefaultPrice  float64                        `json:"default_price"`
	UseGroupRatio bool                           `json:"use_group_ratio"`
}

var gptImage1PriceSetting = GPTImage1PriceSetting{
	Prices: map[string]map[string]float64{
		"low": {
			"1024x1024": GPTImage1Low1024x1024,
			"1024x1536": GPTImage1Low1024x1536,
			"1536x1024": GPTImage1Low1536x1024,
		},
		"medium": {
			"1024x1024": GPTImage1Medium1024x1024,
			"1024x1536": GPTImage1Medium1024x1536,
			"1536x1024": GPTImage1Medium1536x1024,
		},
		"high": {
			"1024x1024": GPTImage1High1024x1024,
			"1024x1536": GPTImage1High1024x1536,
			"1536x1024": GPTImage1High1536x1024,
		},
	},
	DefaultPrice:  GPTImage1Medium1024x1024, // 0.042 — no longer falls back to high 0.167
	UseGroupRatio: false,                    // decoupled by default to stop low-group losses
}

func init() {
	config.GlobalConfig.Register("gpt_image1_price_setting", &gptImage1PriceSetting)
}

// GetGPTImage1PriceOnceCall resolves the per-call image price ($/call) for a
// quality/size pair. Lookup order:
//  1. Exact quality/size pair.
//  2. Known quality but missing/unknown size → the quality's 1024x1024 price.
//     Upstreams (e.g. sub2api) frequently omit the size field in image
//     responses; falling back to the same-quality default size avoids charging
//     a high-quality image at the medium DefaultPrice (a ~4x undercharge).
//  3. Unknown quality (or quality without a 1024x1024 entry) → DefaultPrice.
func GetGPTImage1PriceOnceCall(quality string, size string) float64 {
	if qualityMap, ok := gptImage1PriceSetting.Prices[quality]; ok {
		if price, ok := qualityMap[size]; ok {
			return price
		}
		// size 缺失/未配置但 quality 已知：按该档默认尺寸(1024x1024)计价，
		// 避免高质量图因上游未回显 size 而掉到 medium 默认价（少收 4 倍）。
		if price, ok := qualityMap["1024x1024"]; ok {
			return price
		}
	}
	dp := gptImage1PriceSetting.DefaultPrice
	if dp <= 0 {
		dp = GPTImage1Medium1024x1024
	}
	return dp
}

// GetGPTImage1SurchargeUsesGroupRatio reports whether the image generation
// surcharge should be scaled by the group ratio. Defaults to false so low-price
// groups stop bleeding money on image generation.
func GetGPTImage1SurchargeUsesGroupRatio() bool {
	return gptImage1PriceSetting.UseGroupRatio
}

// ---------------------------------------------------------------------------
// Gemini audio input pricing (per-million tokens, model-specific)
// ---------------------------------------------------------------------------

const (
	Gemini25FlashPreviewInputAudioPrice     = 1.00
	Gemini25FlashProductionInputAudioPrice  = 1.00
	Gemini25FlashLitePreviewInputAudioPrice = 0.50
	Gemini25FlashNativeAudioInputAudioPrice = 3.00
	Gemini20FlashInputAudioPrice            = 0.70
	GeminiRoboticsER15InputAudioPrice       = 1.00
)

func GetGeminiInputAudioPricePerMillionTokens(modelName string) float64 {
	if strings.HasPrefix(modelName, "gemini-2.5-flash-preview-native-audio") {
		return Gemini25FlashNativeAudioInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-2.5-flash-preview-lite") {
		return Gemini25FlashLitePreviewInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-2.5-flash-preview") {
		return Gemini25FlashPreviewInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-2.5-flash") {
		return Gemini25FlashProductionInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-2.0-flash") {
		return Gemini20FlashInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-robotics-er-1.5") {
		return GeminiRoboticsER15InputAudioPrice
	}
	return 0
}
