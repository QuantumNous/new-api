package model_setting

import (
	"net/http"

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
	// AutoInjectCacheControl 自动为 system prompt 的最后一个块注入 cache_control: {type: "ephemeral"}，
	// 以提升 Anthropic Prompt Caching 命中率。仅在客户端未自行设置 cache_control 时生效。
	AutoInjectCacheControl bool `json:"auto_inject_cache_control"`
	// AutoInjectMetadataUserId 自动将请求方的 token_id 注入到 metadata.user_id，
	// 帮助上游 Anthropic 或代理层实现基于 user_id 的粘性路由，提升缓存命中率。
	// 仅在客户端未自行设置 metadata.user_id 时生效。
	AutoInjectMetadataUserId bool `json:"auto_inject_metadata_user_id"`
}

// 默认配置
var defaultClaudeSettings = ClaudeSettings{
	HeadersSettings:        map[string]map[string][]string{},
	ThinkingAdapterEnabled: true,
	DefaultMaxTokens: map[string]int{
		"default": 8192,
	},
	ThinkingAdapterBudgetTokensPercentage: 0.8,
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
			// get existing values for this header key
			existingValues := httpHeader.Values(headerKey)
			existingValuesMap := make(map[string]bool)
			for _, v := range existingValues {
				existingValuesMap[v] = true
			}

			// add only values that don't already exist
			for _, headerValue := range headerValues {
				if !existingValuesMap[headerValue] {
					httpHeader.Add(headerKey, headerValue)
				}
			}
		}
	}
}

func (c *ClaudeSettings) GetDefaultMaxTokens(model string) int {
	if maxTokens, ok := c.DefaultMaxTokens[model]; ok {
		return maxTokens
	}
	return c.DefaultMaxTokens["default"]
}
