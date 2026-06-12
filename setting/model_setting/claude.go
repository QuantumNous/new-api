package model_setting

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

//var claudeHeadersSettings = map[string][]string{}
//
//var ClaudeThinkingAdapterEnabled = true
//var ClaudeThinkingAdapterMaxTokens = 8192
//var ClaudeThinkingAdapterBudgetTokensPercentage = 0.8

// ClaudeSettings 定义Claude模型的配置
type ClaudeSettings struct {
	HeadersSettings                       map[string]map[string][]string `json:"model_headers_settings"`
	DefaultMaxTokens                      map[string]int                 `json:"default_max_tokens"`
	ThinkingAdapterEnabled                bool                           `json:"thinking_adapter_enabled"`
	ThinkingAdapterBudgetTokensPercentage float64                        `json:"thinking_adapter_budget_tokens_percentage"`

	// ResponseNormalizeEnabled is the master switch for normalizing Claude-protocol
	// relay responses toward the official api.anthropic.com shape (R1/R2): the
	// request-id header, internal-header stripping, model/id normalization, usage
	// translation, and message_start.input_tokens calibration are all gated on it.
	// Default true.
	ResponseNormalizeEnabled bool `json:"response_normalize_enabled"`

	// RecalcInputTokensChannels is the allowlist of channel IDs whose Claude
	// direct-passthrough message_start.input_tokens should be recomputed with
	// new-api's own local estimator + calibration instead of trusting the
	// upstream value (R2.7). Empty = disabled (default).
	RecalcInputTokensChannels []int `json:"recalc_input_tokens_channels"`

	// InputTokenCalibration maps a model-name substring to a calibration factor
	// applied to the cl100k-based prompt-token estimate at the message_start
	// display boundary (R2.7). Matching is case-insensitive substring, longest
	// key wins; an unmatched model gets factor 1.0.
	InputTokenCalibration map[string]float64 `json:"input_token_calibration"`

	// SsePaddingEnabled toggles the SSE data-line random whitespace padding
	// (token length side-channel defense, R3). Independent of
	// ResponseNormalizeEnabled. Default true.
	SsePaddingEnabled bool `json:"sse_padding_enabled"`
}

// defaultInputTokenCalibration is the built-in per-model calibration table used
// as the default for ClaudeSettings.InputTokenCalibration and as the fallback
// when the configured map is nil/empty (research §5.4).
var defaultInputTokenCalibration = map[string]float64{
	"claude-opus-4-6": 0.84,
	"claude-opus-4-7": 1.27,
	"claude-opus-4-8": 1.27,
}

// 默认配置
var defaultClaudeSettings = ClaudeSettings{
	HeadersSettings:        map[string]map[string][]string{},
	ThinkingAdapterEnabled: true,
	DefaultMaxTokens: map[string]int{
		"default": 8192,
	},
	ThinkingAdapterBudgetTokensPercentage: 0.8,
	ResponseNormalizeEnabled:              true,
	RecalcInputTokensChannels:             []int{},
	InputTokenCalibration: map[string]float64{
		"claude-opus-4-6": 0.84,
		"claude-opus-4-7": 1.27,
		"claude-opus-4-8": 1.27,
	},
	SsePaddingEnabled: true,
}

// 全局实例
var claudeSettings = defaultClaudeSettings

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("claude", &claudeSettings)
}

// GetClaudeSettings 获取Claude配置
func GetClaudeSettings() *ClaudeSettings {
	// check default max tokens must have default key
	if _, ok := claudeSettings.DefaultMaxTokens["default"]; !ok {
		claudeSettings.DefaultMaxTokens["default"] = 8192
	}
	return &claudeSettings
}

func (c *ClaudeSettings) WriteHeaders(originModel string, httpHeader *http.Header) {
	if headers, ok := c.HeadersSettings[originModel]; ok {
		for headerKey, headerValues := range headers {
			mergedValues := normalizeHeaderListValues(
				append(append([]string(nil), httpHeader.Values(headerKey)...), headerValues...),
			)
			if len(mergedValues) == 0 {
				continue
			}
			httpHeader.Set(headerKey, strings.Join(mergedValues, ","))
		}
	}
}

func normalizeHeaderListValues(values []string) []string {
	normalizedValues := make([]string, 0, len(values))
	seenValues := make(map[string]struct{}, len(values))
	for _, value := range values {
		for _, item := range strings.Split(value, ",") {
			normalizedItem := strings.TrimSpace(item)
			if normalizedItem == "" {
				continue
			}
			if _, exists := seenValues[normalizedItem]; exists {
				continue
			}
			seenValues[normalizedItem] = struct{}{}
			normalizedValues = append(normalizedValues, normalizedItem)
		}
	}
	return normalizedValues
}

func (c *ClaudeSettings) GetDefaultMaxTokens(model string) int {
	if maxTokens, ok := c.DefaultMaxTokens[model]; ok {
		return maxTokens
	}
	return c.DefaultMaxTokens["default"]
}

// ShouldRecalcInputTokens reports whether the given channel ID is in the
// direct-passthrough input_tokens recompute allowlist (R2.7). A nil/empty
// allowlist means "no channel" (recompute disabled), which is the safe default.
func (c *ClaudeSettings) ShouldRecalcInputTokens(channelId int) bool {
	for _, id := range c.RecalcInputTokensChannels {
		if id == channelId {
			return true
		}
	}
	return false
}

// GetInputTokenCalibrationFactor returns the calibration factor for the given
// model name (R2.7). Matching is by case-insensitive substring of the model
// name; the longest matching key wins. An unmatched/empty model returns 1.0 (no
// change). A nil/empty configured map falls back to the built-in default table.
func (c *ClaudeSettings) GetInputTokenCalibrationFactor(model string) float64 {
	if model == "" {
		return 1.0
	}
	table := c.InputTokenCalibration
	if len(table) == 0 {
		table = defaultInputTokenCalibration
	}
	lower := strings.ToLower(model)
	factor := 1.0
	matchedLen := 0
	for key, f := range table {
		if len(key) > matchedLen && strings.Contains(lower, strings.ToLower(key)) {
			factor = f
			matchedLen = len(key)
		}
	}
	return factor
}
