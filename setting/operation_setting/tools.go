package operation_setting

import (
	"encoding/json"
	"math"
	"sort"
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
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
// Effective index: hardcoded defaults → hardcoded model overrides → valid
// operator values. Lookup uses the longest model prefix before the tool
// default, and a matched numeric zero is terminal.
//
// Built-in keys are written in the vendor's list currency.
// ---------------------------------------------------------------------------

const ToolPriceOptionKey = "tool_price_setting.prices"

const (
	defaultWebSearchToolPrice        = 10.0
	defaultWebSearchPreviewToolPrice = 10.0
	defaultFileSearchToolPrice       = 2.5
	defaultGoogleSearchToolPrice     = 14.0
	defaultImageGenerationToolPrice  = 150.0
	defaultSearchPreviewModelPrice   = 25.0
)

// seedHardcodedToolPrices injects compile-time built-in fallbacks (tool
// defaults and model-prefix overrides) into the destination. The source is
// constants, not a mutable package map or operator configuration.
func seedHardcodedToolPrices(prices map[string]float64) {
	prices["web_search"] = defaultWebSearchToolPrice
	prices["web_search_preview"] = defaultWebSearchPreviewToolPrice
	prices["file_search"] = defaultFileSearchToolPrice
	prices["google_search"] = defaultGoogleSearchToolPrice
	prices["image_generation"] = defaultImageGenerationToolPrice
	prices["web_search_preview:gpt-4o*"] = defaultSearchPreviewModelPrice
	prices["web_search_preview:gpt-4.1*"] = defaultSearchPreviewModelPrice
	prices["web_search_preview:gpt-4o-mini*"] = defaultSearchPreviewModelPrice
	prices["web_search_preview:gpt-4.1-mini*"] = defaultSearchPreviewModelPrice

	// Google Search grounding (USD per 1K, ai.google.dev/gemini-api/docs/pricing
	// and cloud.google.com/vertex-ai/generative-ai/pricing): Gemini 3 bills each
	// search query at $14 (the google_search default); Gemini 2.5 and older bill
	// $35 per grounded prompt, so their query count is free and the grounded
	// prompt carries the price.
	prices["google_search:gemini-2.5*"] = 0
	prices["google_search:gemini-2.0*"] = 0
	prices["google_search:gemini-1.5*"] = 0
	prices["google_search_grounded_prompt:gemini-2.5*"] = 35
	prices["google_search_grounded_prompt:gemini-2.0*"] = 35
	prices["google_search_grounded_prompt:gemini-1.5*"] = 35

	// Vendor search tiers, verbatim in the vendor's list currency per 1K
	// calls. CNY: Zhipu search engines, 0.01/0.03/0.05 CNY per call
	// (https://docs.bigmodel.cn/cn/guide/tools/web-search), and Alibaba Model
	// Studio search strategies at Beijing prices
	// (https://help.aliyun.com/zh/model-studio/web-search); the Singapore
	// agent price (73.392381 CNY) is set by the operator. USD: Azure
	// Responses web search, billed as Bing transactions at $14 per 1,000
	// (https://www.microsoft.com/en-us/bing/apis), and xAI web search $5 per
	// 1K calls, x_search $5 per 1K posts and $10 per 1K profiles
	// (https://docs.x.ai/developers/pricing).
	prices["search_std"] = 10
	prices["search_pro"] = 30
	prices["search_pro_sogou"] = 50
	prices["search_pro_quark"] = 50
	prices["search_strategy_turbo"] = 3
	prices["search_strategy_max"] = 4
	prices["search_strategy_agent"] = 4
	prices["search_strategy_agent_max"] = 4
	prices["bing_web_search"] = 14
	prices["web_search:grok*"] = 5
	prices["x_search_posts"] = 5
	prices["x_search_profiles"] = 10
}

// ToolPriceSetting is managed by config.GlobalConfig.Register.
// Prices holds operator overrides only; hardcoded fallbacks live in the index.
type ToolPriceSetting struct {
	Prices map[string]float64 `json:"prices"`
}

var toolPriceSetting = ToolPriceSetting{
	Prices: make(map[string]float64),
}

// builtInToolNames are the tool names (the part before ":") that
// seedHardcodedToolPrices prices, built once from the constant seed and never
// from operator configuration.
var builtInToolNames = make(map[string]struct{})

func init() {
	config.GlobalConfig.Register("tool_price_setting", &toolPriceSetting)
	seed := make(map[string]float64)
	seedHardcodedToolPrices(seed)
	for key := range seed {
		name, _, _ := strings.Cut(key, ":")
		builtInToolNames[name] = struct{}{}
	}
	RebuildToolPriceIndex()
}

// IsBuiltInToolPriceKey reports whether the built-in price seed prices the
// tool name, as a default or for a model prefix. Operator prices never count.
func IsBuiltInToolPriceKey(name string) bool {
	_, ok := builtInToolNames[name]
	return ok
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

func isValidToolPrice(price float64) bool {
	return price >= 0 && !math.IsNaN(price) && !math.IsInf(price, 0)
}

func decodeToolPricesJSON(value string, ignoreInvalidEntries bool) (map[string]float64, error) {
	rawValue := json.RawMessage(strings.TrimSpace(value))
	if common.GetJsonType(rawValue) != "object" {
		return nil, common.NewMessage("Tool prices must be a JSON object")
	}

	var rawPrices map[string]json.RawMessage
	if err := common.Unmarshal(rawValue, &rawPrices); err != nil {
		return nil, common.NewMessage("Failed to parse tool prices: {{error}}", map[string]any{"error": err.Error()})
	}

	prices := make(map[string]float64, len(rawPrices))
	for name, rawPrice := range rawPrices {
		var entryErr error
		if common.GetJsonType(rawPrice) != "number" {
			entryErr = common.NewMessage(`Tool price "{{name}}" must be a non-negative number`, map[string]any{"name": name})
		} else {
			var price float64
			if err := common.Unmarshal(rawPrice, &price); err != nil {
				entryErr = common.NewMessage(`Failed to parse tool price "{{name}}": {{error}}`, map[string]any{"name": name, "error": err.Error()})
			} else if !isValidToolPrice(price) {
				entryErr = common.NewMessage(`Tool price "{{name}}" must be a finite non-negative number`, map[string]any{"name": name})
			} else {
				prices[name] = price
			}
		}

		if entryErr == nil {
			continue
		}
		if !ignoreInvalidEntries {
			return nil, entryErr
		}
		common.SysError(entryErr.Error())
	}
	return prices, nil
}

// ValidateToolPricesJSON validates an operator-supplied complete price map.
// A numeric zero is valid and intentionally disables the matching rule.
func ValidateToolPricesJSON(value string) error {
	_, err := decodeToolPricesJSON(value, false)
	return err
}

// LoadToolPricesFromJSONString replaces the complete operator price map.
// Invalid legacy entries are ignored individually so valid sibling overrides
// survive, while missing built-in keys continue to use hardcoded fallbacks.
func LoadToolPricesFromJSONString(value string) {
	prices, err := decodeToolPricesJSON(value, true)
	if err != nil {
		common.SysError("failed to load tool prices, using hardcoded fallbacks: " + err.Error())
		prices = make(map[string]float64)
	}
	toolPriceSetting.Prices = prices
	RebuildToolPriceIndex()
}

// RebuildToolPriceIndex rebuilds the lookup index from the current config.
// Called on init and after config updates. Not on the billing hot path.
func RebuildToolPriceIndex() {
	merged := make(map[string]float64, 9+len(toolPriceSetting.Prices))
	seedHardcodedToolPrices(merged)
	for k, v := range toolPriceSetting.Prices {
		if !isValidToolPrice(v) {
			continue
		}
		merged[k] = v
	}

	idx := &toolPriceIndex{
		defaults: make(map[string]float64),
		prefixes: make(map[string][]prefixEntry),
	}

	for key, price := range merged {
		before, after, ok := strings.Cut(key, ":")
		if !ok {
			idx.defaults[key] = price
			continue
		}
		toolName := before
		modelPart := after
		prefix := strings.TrimSuffix(modelPart, "*")
		idx.prefixes[toolName] = append(idx.prefixes[toolName], prefixEntry{prefix: prefix, price: price})
	}

	for tool := range idx.prefixes {
		entries := idx.prefixes[tool]
		sort.Slice(entries, func(i, j int) bool {
			if len(entries[i].prefix) == len(entries[j].prefix) {
				return entries[i].prefix < entries[j].prefix
			}
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
		RebuildToolPriceIndex()
		idx = currentIndex.Load()
		if idx == nil {
			return 0
		}
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

// SetToolPriceForTest injects a tool price and rebuilds the lookup index. Tests only.
func SetToolPriceForTest(name string, price float64) {
	if toolPriceSetting.Prices == nil {
		toolPriceSetting.Prices = make(map[string]float64)
	}
	toolPriceSetting.Prices[name] = price
	RebuildToolPriceIndex()
}

// DeleteToolPriceForTest removes an injected tool price and rebuilds the index. Tests only.
func DeleteToolPriceForTest(name string) {
	delete(toolPriceSetting.Prices, name)
	RebuildToolPriceIndex()
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
	}
	if strings.HasPrefix(modelName, "gemini-2.5-flash-preview-lite") {
		return Gemini25FlashLitePreviewInputAudioPrice
	}
	if strings.HasPrefix(modelName, "gemini-2.5-flash-preview") {
		return Gemini25FlashPreviewInputAudioPrice
	}
	if strings.HasPrefix(modelName, "gemini-2.5-flash") {
		return Gemini25FlashProductionInputAudioPrice
	}
	if strings.HasPrefix(modelName, "gemini-2.0-flash") {
		return Gemini20FlashInputAudioPrice
	}
	if strings.HasPrefix(modelName, "gemini-robotics-er-1.5") {
		return GeminiRoboticsER15InputAudioPrice
	}
	return 0
}
