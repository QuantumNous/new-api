package relay

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
)

// The three hwApply*ModelIdentity functions put service.HwModelIdentityLine in
// front of the customer's own system prompt of a request for a sold model,
// exactly once: a retry that sees the line already in front leaves it alone.
// The customer's own system prompt always stays, after the line.

func hwApplyChatModelIdentity(info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) {
	line := service.HwModelIdentityLine(info.OriginModelName, info.TokenKey)
	if line == "" || request == nil {
		return
	}
	// A Kimi K3 dynamic tool loading message ({"role":"system","tools":[...]})
	// declares tools rather than a system prompt and is never a target.
	if len(request.Messages) > 0 {
		first := &request.Messages[0]
		if (first.Role == "system" || first.Role == "developer") && len(first.Tools) == 0 {
			if first.IsStringContent() {
				existing := first.StringContent()
				if !strings.HasPrefix(existing, line) {
					first.SetStringContent(strings.TrimSpace(line + "\n\n" + existing))
				}
				return
			}
			contents := first.ParseContent()
			if len(contents) > 0 && contents[0].Type == dto.ContentTypeText && strings.HasPrefix(contents[0].Text, line) {
				return
			}
			first.SetMediaContent(append([]dto.MediaContent{{Type: dto.ContentTypeText, Text: line}}, contents...))
			return
		}
	}
	system := dto.Message{Role: request.GetSystemRoleName(), Content: line}
	request.Messages = append([]dto.Message{system}, request.Messages...)
}

func hwApplyClaudeModelIdentity(info *relaycommon.RelayInfo, request *dto.ClaudeRequest) {
	line := service.HwModelIdentityLine(info.OriginModelName, info.TokenKey)
	if line == "" || request == nil {
		return
	}
	if request.System == nil || request.IsStringSystem() {
		existing := request.GetStringSystem()
		if !strings.HasPrefix(existing, line) {
			request.SetStringSystem(strings.TrimSpace(line + "\n\n" + existing))
		}
		return
	}
	blocks := request.ParseSystem()
	if len(blocks) > 0 && blocks[0].Type == dto.ContentTypeText && strings.HasPrefix(blocks[0].GetText(), line) {
		return
	}
	block := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
	block.SetText(line)
	request.System = append([]dto.ClaudeMediaMessage{block}, blocks...)
}

func hwApplyResponsesModelIdentity(info *relaycommon.RelayInfo, request *dto.OpenAIResponsesRequest) {
	line := service.HwModelIdentityLine(info.OriginModelName, info.TokenKey)
	if line == "" || request == nil {
		return
	}
	existing := ""
	if len(request.Instructions) > 0 && string(request.Instructions) != "null" {
		// instructions is a string in the Responses API; any other shape is
		// passed on untouched rather than rewritten.
		if err := common.Unmarshal(request.Instructions, &existing); err != nil {
			return
		}
	}
	if strings.HasPrefix(existing, line) {
		return
	}
	encoded, err := common.Marshal(strings.TrimSpace(line + "\n\n" + existing))
	if err != nil {
		return
	}
	request.Instructions = encoded
}
