package model_setting

import (
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// ChannelRoutingPolicy defines a reusable policy structure for deciding
// whether a particular channel/model combination should have its API
// request format converted (e.g. Responses → Chat Completions or vice
// versa).  Both ChatCompletionsToResponsesPolicy and
// ResponsesToChatCompletionsPolicy embed this type so that field
// definitions and the IsChannelEnabled logic are shared.
type ChannelRoutingPolicy struct {
	Enabled       bool     `json:"enabled"`
	AllChannels   bool     `json:"all_channels"`
	ChannelIDs    []int    `json:"channel_ids,omitempty"`
	ChannelTypes  []int    `json:"channel_types,omitempty"`
	ModelPatterns []string `json:"model_patterns,omitempty"`
}

// IsChannelEnabled returns true when the policy is enabled and the given
// channel matches by ID, type, or the AllChannels wildcard.
func (p ChannelRoutingPolicy) IsChannelEnabled(channelID int, channelType int) bool {
	if !p.Enabled {
		return false
	}
	if p.AllChannels {
		return true
	}

	if channelID > 0 && len(p.ChannelIDs) > 0 && slices.Contains(p.ChannelIDs, channelID) {
		return true
	}
	if channelType > 0 && len(p.ChannelTypes) > 0 && slices.Contains(p.ChannelTypes, channelType) {
		return true
	}
	return false
}

// ChatCompletionsToResponsesPolicy controls when incoming
// /v1/chat/completions requests should be converted to /v1/responses
// for upstream channels that only support the Responses API.
type ChatCompletionsToResponsesPolicy = ChannelRoutingPolicy

// ResponsesToChatCompletionsPolicy controls when incoming /v1/responses
// requests should be converted to /v1/chat/completions for upstream
// channels that do not support the Responses API natively (e.g. NVIDIA
// NIM, ZhipuAI).
type ResponsesToChatCompletionsPolicy = ChannelRoutingPolicy

// GlobalSettings holds the top-level runtime configuration loaded from
// the database options table under the "global" key.
type GlobalSettings struct {
	PassThroughRequestEnabled        bool                             `json:"pass_through_request_enabled"`
	ThinkingModelBlacklist           []string                         `json:"thinking_model_blacklist"`
	ChatCompletionsToResponsesPolicy ChatCompletionsToResponsesPolicy `json:"chat_completions_to_responses_policy"`
	ResponsesToChatCompletionsPolicy ResponsesToChatCompletionsPolicy `json:"responses_to_chat_completions_policy"`
}

// 默认配置
var defaultOpenaiSettings = GlobalSettings{
	PassThroughRequestEnabled: false,
	ThinkingModelBlacklist: []string{
		"moonshotai/kimi-k2-thinking",
		"kimi-k2-thinking",
	},
	ChatCompletionsToResponsesPolicy: ChatCompletionsToResponsesPolicy{
		Enabled:     false,
		AllChannels: true,
	},
	ResponsesToChatCompletionsPolicy: ResponsesToChatCompletionsPolicy{
		Enabled:     false,
		AllChannels: true,
	},
}

// 全局实例
var globalSettings = defaultOpenaiSettings

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("global", &globalSettings)
}

// GetGlobalSettings returns a pointer to the current runtime
// GlobalSettings instance.
func GetGlobalSettings() *GlobalSettings {
	return &globalSettings
}

// ShouldPreserveThinkingSuffix 判断模型是否配置为保留 thinking/-nothinking/-low/-high/-medium 后缀
func ShouldPreserveThinkingSuffix(modelName string) bool {
	target := strings.TrimSpace(modelName)
	if target == "" {
		return false
	}

	for _, entry := range globalSettings.ThinkingModelBlacklist {
		if strings.TrimSpace(entry) == target {
			return true
		}
	}
	return false
}
