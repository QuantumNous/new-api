package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	codexPolicyModelGPT54 = "gpt-5.4"
	codexPolicyModelGPT55 = "gpt-5.5"
)

var (
	ErrCodexClientNoChannel = errors.New("no codex-compatible channel available for this model")
	ErrNonCodexCodexChannel = errors.New("gpt-5.4/gpt-5.5 via non-Codex clients cannot use Codex-only channels")
	ErrCodexNonCodexChannel = errors.New("Codex clients must use channels whose site group contains codex")
)

// RequiresCodexChannelPolicy reports whether gpt-5.4/5.5 need Codex client ↔ key_group routing.
func RequiresCodexChannelPolicy(modelName string) bool {
	switch strings.TrimSpace(modelName) {
	case codexPolicyModelGPT54, codexPolicyModelGPT55:
		return true
	default:
		return false
	}
}

// IsCodexKeyGroup returns true when channel site group (key_group) contains "codex".
func IsCodexKeyGroup(keyGroup string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(keyGroup)), "codex")
}

// ChannelMatchesCodexPolicy checks bidirectional isolation:
// Codex client → codex key_group only; non-Codex → non-codex key_group only.
func ChannelMatchesCodexPolicy(setting *string, isCodexClient bool) bool {
	isCodexChannel := IsCodexKeyGroup(ExtractKeyGroup(setting))
	return isCodexClient == isCodexChannel
}

// DetectCodexClient heuristically identifies Codex CLI/Desktop callers.
func DetectCodexClient(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	h := c.Request.Header
	if strings.Contains(strings.ToLower(h.Get("Originator")), "codex") {
		return true
	}
	if h.Get("X-Codex-Beta-Features") != "" || h.Get("X-Codex-Turn-Metadata") != "" {
		return true
	}
	if !strings.Contains(c.Request.URL.Path, "/v1/responses") {
		return false
	}
	return responsesBodyHasPromptCacheKey(c)
}

func responsesBodyHasPromptCacheKey(c *gin.Context) bool {
	var payload map[string]any
	if err := common.UnmarshalBodyReusable(c, &payload); err != nil {
		return false
	}
	key, _ := payload["prompt_cache_key"].(string)
	return strings.TrimSpace(key) != ""
}

// InitCodexChannelPolicyContext detects Codex client once per request for gpt-5.4/5.5.
func InitCodexChannelPolicyContext(c *gin.Context, modelName string) {
	if c == nil || !RequiresCodexChannelPolicy(modelName) {
		return
	}
	if _, ok := common.GetContextKey(c, constant.ContextKeyIsCodexClient); ok {
		return
	}
	common.SetContextKey(c, constant.ContextKeyIsCodexClient, DetectCodexClient(c))
}

func isCodexClientFromContext(c *gin.Context) bool {
	if c == nil {
		return false
	}
	v, ok := common.GetContextKey(c, constant.ContextKeyIsCodexClient)
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}

// ChannelPickFilter returns a filter for gpt-5.4/5.5 routing; nil when policy does not apply.
func ChannelPickFilter(c *gin.Context, modelName string) model.ChannelPickFilter {
	if !RequiresCodexChannelPolicy(modelName) {
		return nil
	}
	InitCodexChannelPolicyContext(c, modelName)
	isCodex := isCodexClientFromContext(c)
	return func(ch *model.Channel) bool {
		if ch == nil {
			return false
		}
		return ChannelMatchesCodexPolicy(ch.Setting, isCodex)
	}
}

// ValidateChannelCodexPolicy rejects a pre-selected channel that violates Codex isolation.
func ValidateChannelCodexPolicy(c *gin.Context, channel *model.Channel, modelName string) error {
	if channel == nil || !RequiresCodexChannelPolicy(modelName) {
		return nil
	}
	InitCodexChannelPolicyContext(c, modelName)
	if ChannelMatchesCodexPolicy(channel.Setting, isCodexClientFromContext(c)) {
		return nil
	}
	if isCodexClientFromContext(c) {
		return ErrCodexNonCodexChannel
	}
	return ErrNonCodexCodexChannel
}

// CodexPolicyChannelError maps empty post-filter selection to a user-facing error.
func CodexPolicyChannelError(c *gin.Context, modelName string) error {
	if !RequiresCodexChannelPolicy(modelName) {
		return nil
	}
	InitCodexChannelPolicyContext(c, modelName)
	if isCodexClientFromContext(c) {
		return fmt.Errorf("%w (%s)", ErrCodexClientNoChannel, modelName)
	}
	return fmt.Errorf("no non-Codex channel available for %s", modelName)
}

// AppendCodexClientLogInfo adds client_type for gpt-5.4/5.5 consume logs.
func AppendCodexClientLogInfo(c *gin.Context, modelName string, other map[string]interface{}) {
	if other == nil || !RequiresCodexChannelPolicy(modelName) {
		return
	}
	InitCodexChannelPolicyContext(c, modelName)
	if isCodexClientFromContext(c) {
		other["client_type"] = "codex"
	} else {
		other["client_type"] = "openai_compatible"
	}
}
