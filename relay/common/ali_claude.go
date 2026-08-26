package common

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/samber/lo"
)

const (
	aliAnthropicMessagesModelsEnv     = "ALI_ANTHROPIC_MESSAGES_MODELS"
	defaultAliAnthropicMessagesModels = "qwen,deepseek-v4,kimi,glm,minimax-m"
)

// AliSpeaksClaude reports whether this DashScope model accepts Anthropic
// Messages natively. Used by NativeTextFormat so Claude clients keep a Claude
// body and `/apps/anthropic/v1/messages` path instead of converting to Chat.
func AliSpeaksClaude(modelName string) bool {
	normalizedModelName := strings.ToLower(strings.TrimSpace(modelName))
	if normalizedModelName == "" {
		return false
	}
	return lo.SomeBy(aliAnthropicMessagesModelPatterns(), func(pattern string) bool {
		return strings.Contains(normalizedModelName, pattern)
	})
}

func aliAnthropicMessagesModelPatterns() []string {
	configuredModels := common.GetEnvOrDefaultString(aliAnthropicMessagesModelsEnv, defaultAliAnthropicMessagesModels)
	return lo.FilterMap(strings.Split(configuredModels, ","), func(item string, _ int) (string, bool) {
		pattern := strings.ToLower(strings.TrimSpace(item))
		return pattern, pattern != ""
	})
}
