package service

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
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
)

// RequiresCodexChannelPolicy reports whether gpt-5.4/5.5 need Codex client ↔ channel routing.
func RequiresCodexChannelPolicy(modelName string) bool {
	switch strings.TrimSpace(modelName) {
	case codexPolicyModelGPT54, codexPolicyModelGPT55:
		return true
	default:
		return false
	}
}

// IsCodexKeyGroup is deprecated: client routing uses client_exclusive only.
// Kept for callers that still inspect pricing group names outside routing policy.
func IsCodexKeyGroup(keyGroup string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(keyGroup)), "codex")
}

// ChannelMatchesCodexPolicy checks one-way Codex isolation via client_exclusive.
func ChannelMatchesCodexPolicy(setting *string, isCodexClient bool) bool {
	clientType := ClientTypeGeneric
	if isCodexClient {
		clientType = ClientTypeCodex
	}
	modelName := codexPolicyModelGPT54
	return ChannelMatchesClientPolicy(setting, clientType, modelName)
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
	InitClientPolicyContext(c, modelName)
}

func isCodexClientFromContext(c *gin.Context) bool {
	return clientTypeFromContext(c) == ClientTypeCodex
}

// ValidateChannelCodexPolicy rejects a pre-selected channel that violates Codex isolation.
func ValidateChannelCodexPolicy(c *gin.Context, channel *model.Channel, modelName string) error {
	return ValidateChannelClientPolicy(c, channel, modelName)
}

// CodexPolicyChannelError maps empty post-filter selection to a user-facing error.
func CodexPolicyChannelError(c *gin.Context, modelName string) error {
	return ClientPolicyChannelError(c, modelName)
}

// AppendCodexClientLogInfo adds client_type for gpt-5.4/5.5 consume logs.
func AppendCodexClientLogInfo(c *gin.Context, modelName string, other map[string]interface{}) {
	AppendClientExclusiveLogInfo(c, modelName, other)
}
