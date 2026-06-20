package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ClientExclusive marks channels restricted to specific API clients.
type ClientExclusive string

const (
	ClientExclusiveNone       ClientExclusive = ""
	ClientExclusiveCodex      ClientExclusive = "codex"
	ClientExclusiveClaudeCode ClientExclusive = "claude_code"
)

// ClientType classifies the incoming request for routing.
type ClientType string

const (
	ClientTypeGeneric    ClientType = "generic"
	ClientTypeCodex      ClientType = "codex"
	ClientTypeClaudeCode ClientType = "claude_code"
)

var (
	ErrNonClaudeCodeClaudeChannel = errors.New("this model cannot use Claude Code-only channels from non-Claude Code clients")
)

// ExtractClientExclusive reads client_exclusive from channel.Setting JSON.
// Only the explicit client_exclusive field applies; key_group is pricing-only.
func ExtractClientExclusive(setting *string) ClientExclusive {
	if setting == nil || strings.TrimSpace(*setting) == "" {
		return ClientExclusiveNone
	}
	var s struct {
		ClientExclusive string `json:"client_exclusive"`
	}
	if err := json.Unmarshal([]byte(*setting), &s); err != nil {
		return ClientExclusiveNone
	}
	switch strings.ToLower(strings.TrimSpace(s.ClientExclusive)) {
	case string(ClientExclusiveCodex):
		return ClientExclusiveCodex
	case string(ClientExclusiveClaudeCode):
		return ClientExclusiveClaudeCode
	default:
		return ClientExclusiveNone
	}
}

// RequiresClaudeCodeChannelPolicy reports whether claude-* models need CC routing.
func RequiresClaudeCodeChannelPolicy(modelName string) bool {
	return strings.HasPrefix(strings.TrimSpace(modelName), "claude-")
}

// RequiresClientExclusivePolicy reports whether client↔channel isolation applies.
func RequiresClientExclusivePolicy(modelName string) bool {
	return RequiresCodexChannelPolicy(modelName) || RequiresClaudeCodeChannelPolicy(modelName)
}

// DetectClaudeCodeClient heuristically identifies Claude Code CLI callers.
func DetectClaudeCodeClient(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	h := c.Request.Header
	if strings.Contains(strings.ToLower(h.Get("User-Agent")), "claude-cli/") {
		return true
	}
	beta := strings.ToLower(h.Get("anthropic-beta"))
	if strings.Contains(beta, "claude-code") && strings.Contains(c.Request.URL.Path, "/v1/messages") {
		return true
	}
	return false
}

// DetectClientType classifies the caller for the requested model.
func DetectClientType(c *gin.Context, modelName string) ClientType {
	if RequiresCodexChannelPolicy(modelName) && DetectCodexClient(c) {
		return ClientTypeCodex
	}
	if RequiresClaudeCodeChannelPolicy(modelName) && DetectClaudeCodeClient(c) {
		return ClientTypeClaudeCode
	}
	return ClientTypeGeneric
}

// InitClientPolicyContext detects client type once per request when policy applies.
func InitClientPolicyContext(c *gin.Context, modelName string) {
	if c == nil || !RequiresClientExclusivePolicy(modelName) {
		return
	}
	if _, ok := common.GetContextKey(c, constant.ContextKeyClientType); ok {
		return
	}
	clientType := DetectClientType(c, modelName)
	common.SetContextKey(c, constant.ContextKeyClientType, string(clientType))
	common.SetContextKey(c, constant.ContextKeyIsCodexClient, clientType == ClientTypeCodex)
}

func clientTypeFromContext(c *gin.Context) ClientType {
	if c == nil {
		return ClientTypeGeneric
	}
	v, ok := common.GetContextKey(c, constant.ContextKeyClientType)
	if !ok {
		return ClientTypeGeneric
	}
	s, _ := v.(string)
	switch ClientType(s) {
	case ClientTypeCodex, ClientTypeClaudeCode:
		return ClientType(s)
	default:
		return ClientTypeGeneric
	}
}

// ChannelMatchesClientPolicy applies one-way client-exclusive rules (Codex + Claude Code).
func ChannelMatchesClientPolicy(setting *string, clientType ClientType, modelName string) bool {
	exclusive := ExtractClientExclusive(setting)

	if RequiresCodexChannelPolicy(modelName) {
		if exclusive == ClientExclusiveCodex && clientType != ClientTypeCodex {
			return false
		}
	}

	if RequiresClaudeCodeChannelPolicy(modelName) {
		if exclusive == ClientExclusiveClaudeCode && clientType != ClientTypeClaudeCode {
			return false
		}
		if exclusive == ClientExclusiveCodex {
			return false
		}
	}

	return true
}

// ChannelPickFilter returns a filter when client-exclusive routing applies.
func ChannelPickFilter(c *gin.Context, modelName string) model.ChannelPickFilter {
	if !RequiresClientExclusivePolicy(modelName) {
		return nil
	}
	InitClientPolicyContext(c, modelName)
	clientType := clientTypeFromContext(c)
	return func(ch *model.Channel) bool {
		if ch == nil {
			return false
		}
		return ChannelMatchesClientPolicy(ch.Setting, clientType, modelName)
	}
}

// ValidateChannelClientPolicy rejects a pre-selected channel that violates isolation.
func ValidateChannelClientPolicy(c *gin.Context, channel *model.Channel, modelName string) error {
	if channel == nil || !RequiresClientExclusivePolicy(modelName) {
		return nil
	}
	InitClientPolicyContext(c, modelName)
	clientType := clientTypeFromContext(c)
	if ChannelMatchesClientPolicy(channel.Setting, clientType, modelName) {
		return nil
	}
	exclusive := ExtractClientExclusive(channel.Setting)
	if exclusive == ClientExclusiveClaudeCode && clientType != ClientTypeClaudeCode {
		return ErrNonClaudeCodeClaudeChannel
	}
	if exclusive == ClientExclusiveCodex && clientType != ClientTypeCodex {
		return ErrNonCodexCodexChannel
	}
	return ErrNonClaudeCodeClaudeChannel
}

// ClientPolicyChannelError maps empty post-filter selection to a user-facing error.
func ClientPolicyChannelError(c *gin.Context, modelName string) error {
	if !RequiresClientExclusivePolicy(modelName) {
		return nil
	}
	InitClientPolicyContext(c, modelName)
	clientType := clientTypeFromContext(c)
	if RequiresCodexChannelPolicy(modelName) {
		if clientType == ClientTypeCodex {
			return fmt.Errorf("%w (%s)", ErrCodexClientNoChannel, modelName)
		}
		return fmt.Errorf("no non-Codex channel available for %s", modelName)
	}
	if clientType != ClientTypeClaudeCode {
		return fmt.Errorf("no non-Claude Code-exclusive channel available for %s", modelName)
	}
	return fmt.Errorf("no channel available for %s", modelName)
}

// AppendClientExclusiveLogInfo adds client_type for routed models.
func AppendClientExclusiveLogInfo(c *gin.Context, modelName string, other map[string]interface{}) {
	if other == nil || !RequiresClientExclusivePolicy(modelName) {
		return
	}
	InitClientPolicyContext(c, modelName)
	clientType := clientTypeFromContext(c)
	switch {
	case RequiresCodexChannelPolicy(modelName):
		if clientType == ClientTypeCodex {
			other["client_type"] = "codex"
		} else {
			other["client_type"] = "openai_compatible"
		}
	case RequiresClaudeCodeChannelPolicy(modelName):
		if clientType == ClientTypeClaudeCode {
			other["client_type"] = "claude_code"
		} else {
			other["client_type"] = "anthropic_compatible"
		}
	}
}
