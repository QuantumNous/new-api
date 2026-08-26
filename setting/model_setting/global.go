package model_setting

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const ChatCompletionsToResponsesPolicyOptionKey = "global.chat_completions_to_responses_policy"

type ChatCompletionsToResponsesPolicy struct {
	// Enabled activates custom regex routing for the selected channels. When it
	// is false (or a channel is not selected), OpenAI channels use automatic
	// routing: mapped gpt-* models use Responses and all others use Chat.
	Enabled       bool     `json:"enabled"`
	AllChannels   bool     `json:"all_channels"`
	ChannelIDs    []int    `json:"channel_ids,omitempty"`
	ChannelTypes  []int    `json:"channel_types,omitempty"`
	ModelPatterns []string `json:"model_patterns,omitempty"`
}

func ValidateChatCompletionsToResponsesPolicy(value string) error {
	value = strings.TrimSpace(value)
	if value == "" {
		value = "{}"
	}
	if value == "null" {
		return fmt.Errorf("responses routing policy must be a JSON object")
	}

	var policy ChatCompletionsToResponsesPolicy
	decoder := json.NewDecoder(strings.NewReader(value))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&policy); err != nil {
		return fmt.Errorf("invalid Responses routing policy JSON: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("invalid Responses routing policy JSON: trailing data")
	}
	if policy.Enabled && !policy.AllChannels && len(policy.ChannelIDs) == 0 && len(policy.ChannelTypes) == 0 {
		return fmt.Errorf("enabled Responses routing policy must select all_channels, channel_ids, or channel_types")
	}
	for i, channelID := range policy.ChannelIDs {
		if channelID <= 0 {
			return fmt.Errorf("channel_ids[%d] must be greater than zero", i)
		}
	}
	for i, channelType := range policy.ChannelTypes {
		if channelType <= 0 {
			return fmt.Errorf("channel_types[%d] must be greater than zero", i)
		}
	}
	for i, pattern := range policy.ModelPatterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			return fmt.Errorf("model_patterns[%d] must not be empty", i)
		}
		if _, err := regexp.Compile(pattern); err != nil {
			return fmt.Errorf("invalid model_patterns[%d]: %w", i, err)
		}
	}
	return nil
}

func (p ChatCompletionsToResponsesPolicy) IsChannelEnabled(channelID int, channelType int) bool {
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

type GlobalSettings struct {
	PassThroughRequestEnabled        bool                             `json:"pass_through_request_enabled"`
	ThinkingModelBlacklist           []string                         `json:"thinking_model_blacklist"`
	ChatCompletionsToResponsesPolicy ChatCompletionsToResponsesPolicy `json:"chat_completions_to_responses_policy"`
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
}

// 全局实例
var globalSettings = defaultOpenaiSettings

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("global", &globalSettings)
}

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
