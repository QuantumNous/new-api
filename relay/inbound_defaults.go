package relay

import (
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
)

// applyInboundDefaults injects protocol-native defaults onto the inbound DTO
// only when the channel speaks the same protocol as the client. Cross-protocol
// traffic must not leak Claude max_tokens / thinking suffixes or Gemini
// includeThoughts into a foreign native body.
func applyInboundDefaults(info *relaycommon.RelayInfo, request any) {
	if info == nil || request == nil {
		return
	}
	if info.TextNative() != info.RelayFormat {
		return
	}
	switch req := request.(type) {
	case *dto.ClaudeRequest:
		applyClaudeNativeRequestDefaults(info, req)
	case *dto.GeminiChatRequest:
		if strings.Contains(info.RequestURLPath, ":countTokens") {
			return
		}
		if req.GenerationConfig.ThinkingConfig != nil {
			return
		}
		relayconvert.ApplyGeminiThinkingConfig(req, info)
	}
}
